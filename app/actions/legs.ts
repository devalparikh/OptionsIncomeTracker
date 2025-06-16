"use server"

import { createServerClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getAlphaVantageClient } from "@/lib/alpha-vantage"

export async function createLeg(legData: {
  symbol: string
  side: "SELL" | "BUY"
  type: "PUT" | "CALL"
  strike: number
  expiry: string
  open_date: string
  open_price: number
  contracts: number
  commissions?: number
  share_cost_basis?: number
}) {
  try {
    const supabase = await createServerClient()
    const alphaVantage = getAlphaVantageClient()

    // Get the authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      throw new Error("Not authenticated")
    }

    // First, ensure the user has a profile
    const { data: existingProfile, error: profileCheckError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle()

    if (profileCheckError) {
      console.error("Profile check error:", profileCheckError)
    }

    // Create profile if it doesn't exist
    if (!existingProfile) {
      const { error: profileError } = await supabase.from("profiles").insert({
        id: user.id,
        email: user.email || "",
        full_name: user.user_metadata?.full_name || null,
      })

      if (profileError) {
        console.error("Profile creation error:", profileError)
        // Continue anyway, as the profile might have been created by another process
      }
    }

    // Get or create the user's account
    const { data: accounts, error: accountError } = await supabase
      .from("accounts")
      .select("id")
      .eq("user_id", user.id)
      .limit(1)

    if (accountError) {
      console.error("Account error:", accountError)
      throw new Error("Error fetching accounts")
    }

    let account
    if (!accounts || accounts.length === 0) {
      // Create default account if none exists
      const { data: newAccount, error: createAccountError } = await supabase
        .from("accounts")
        .insert({
          user_id: user.id,
          name: "Default Account",
        })
        .select("id")
        .single()

      if (createAccountError) {
        console.error("Account creation error:", createAccountError)
        throw new Error(`Failed to create account: ${createAccountError.message}`)
      }
      account = newAccount
    } else {
      account = accounts[0]
    }

    // Get or create the user's portfolio
    const { data: portfolios, error: portfolioError } = await supabase
      .from("portfolios")
      .select("id")
      .eq("account_id", account.id)
      .limit(1)

    if (portfolioError) {
      console.error("Portfolio error:", portfolioError)
      throw new Error("Error fetching portfolios")
    }

    let portfolio
    if (!portfolios || portfolios.length === 0) {
      // Create default portfolio if none exists
      const { data: newPortfolio, error: createPortfolioError } = await supabase
        .from("portfolios")
        .insert({
          account_id: account.id,
          name: "Main Portfolio",
        })
        .select("id")
        .single()

      if (createPortfolioError) {
        console.error("Portfolio creation error:", createPortfolioError)
        throw new Error(`Failed to create portfolio: ${createPortfolioError.message}`)
      }
      portfolio = newPortfolio
    } else {
      portfolio = portfolios[0]
    }

    // Get current stock price for covered calls
    let currentPrice = null
    if (legData.type === "CALL" && legData.side === "SELL") {
      const quote = await alphaVantage.getQuote(legData.symbol)
      if (quote) {
        currentPrice = quote.price
      }
    }

    // Check if position exists for this symbol
    let { data: position, error: positionSelectError } = await supabase
      .from("positions")
      .select("id, quantity, cost_basis")
      .eq("portfolio_id", portfolio.id)
      .eq("symbol", legData.symbol)
      .eq("status", legData.type === "CALL" && legData.side === "SELL" ? "STOCK" : legData.type)
      .maybeSingle()

    if (positionSelectError) {
      console.error("Position select error:", positionSelectError)
      throw new Error("Error checking existing positions")
    }

    // For covered calls, calculate new quantity and weighted average cost basis
    if (legData.type === "CALL" && legData.side === "SELL") {
      const newQuantity = legData.contracts * 100
      
      if (!position) {
        // Create new position if it doesn't exist
        const { data: newPosition, error: positionError } = await supabase
          .from("positions")
          .insert({
            portfolio_id: portfolio.id,
            symbol: legData.symbol,
            status: "STOCK",
            quantity: newQuantity,
            cost_basis: legData.share_cost_basis,
            current_price: currentPrice,
          })
          .select("id")
          .single()

        if (positionError) {
          console.error("Position creation error:", positionError)
          throw new Error(`Failed to create position: ${positionError.message}`)
        }
        position = newPosition
      } else {
        // Update existing position with weighted average cost basis
        const existingQuantity = position.quantity || 0
        const existingCostBasis = position.cost_basis || 0
        const totalQuantity = existingQuantity + newQuantity
        
        // Calculate weighted average cost basis
        const weightedCostBasis = existingQuantity > 0
          ? ((existingQuantity * existingCostBasis) + (newQuantity * (legData.share_cost_basis || 0))) / totalQuantity
          : legData.share_cost_basis

        const { error: updateError } = await supabase
          .from("positions")
          .update({
            status: "STOCK",
            quantity: totalQuantity,
            cost_basis: weightedCostBasis,
            current_price: currentPrice,
          })
          .eq("id", position.id)

        if (updateError) {
          console.error("Position update error:", updateError)
          throw new Error(`Failed to update position: ${updateError.message}`)
        }
      }
    } else {
      // Handle non-covered call positions
      if (!position) {
        const { data: newPosition, error: positionError } = await supabase
          .from("positions")
          .insert({
            portfolio_id: portfolio.id,
            symbol: legData.symbol,
            status: legData.type,
            quantity: legData.contracts,
            cost_basis: null,
            current_price: null,
          })
          .select("id")
          .single()

        if (positionError) {
          console.error("Position creation error:", positionError)
          throw new Error(`Failed to create position: ${positionError.message}`)
        }
        position = newPosition
      }
    }

    // Create the leg
    const { error: legError } = await supabase.from("legs").insert({
      position_id: position.id,
      side: legData.side,
      type: legData.type,
      strike: legData.strike,
      expiry: legData.expiry,
      open_date: legData.open_date,
      open_price: legData.open_price,
      contracts: legData.contracts,
      commissions: legData.commissions || 0,
      share_cost_basis: legData.share_cost_basis || null,
    })

    if (legError) {
      console.error("Leg creation error:", legError)
      throw new Error(`Failed to create leg: ${legError.message}`)
    }

    revalidatePath("/")
    return { success: true }
  } catch (error) {
    console.error("Error creating leg:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    }
  }
}

export async function closeLeg(legId: string, closePrice: number, closeDate: string) {
  try {
    const supabase = await createServerClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      throw new Error("Not authenticated")
    }

    const { error } = await supabase
      .from("legs")
      .update({
        close_price: closePrice,
        close_date: closeDate,
      })
      .eq("id", legId)

    if (error) {
      throw new Error(`Failed to close leg: ${error.message}`)
    }

    revalidatePath("/")
    return { success: true }
  } catch (error) {
    console.error("Error closing leg:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    }
  }
}
