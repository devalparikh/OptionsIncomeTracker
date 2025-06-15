"use server"

import { createServerClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

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
}) {
  try {
    const supabase = await createServerClient()

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

    // Check if position exists for this symbol
    let { data: position, error: positionSelectError } = await supabase
      .from("positions")
      .select("id")
      .eq("portfolio_id", portfolio.id)
      .eq("symbol", legData.symbol)
      .maybeSingle()

    if (positionSelectError) {
      console.error("Position select error:", positionSelectError)
      throw new Error("Error checking existing positions")
    }

    // Create position if it doesn't exist
    if (!position) {
      const { data: newPosition, error: positionError } = await supabase
        .from("positions")
        .insert({
          portfolio_id: portfolio.id,
          symbol: legData.symbol,
          status: legData.type,
          quantity: legData.contracts,
        })
        .select("id")
        .single()

      if (positionError) {
        console.error("Position creation error:", positionError)
        throw new Error(`Failed to create position: ${positionError.message}`)
      }
      position = newPosition
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
