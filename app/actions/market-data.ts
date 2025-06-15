"use server"

import { createServerClient } from "@/lib/supabase/server"
import { getMarketDataService } from "@/lib/alpha-vantage"
import { analyzePosition, shouldAutoExercise, calculateAssignmentDetails } from "@/utils/option-calculations"
import { getLegsServer } from "@/lib/supabase/queries"
import { revalidatePath } from "next/cache"
import { MarketDataError } from "@/lib/services/market-data-service"

export async function updateMarketData() {
  try {
    const supabase = await createServerClient()
    const marketData = getMarketDataService()

    // Get all open positions
    const legs = await getLegsServer()
    const openLegs = legs.filter((leg) => !leg.close_date)

    // Get stock positions
    const { data: stockPositions } = await supabase.from("positions").select("*").eq("status", "STOCK")

    if (openLegs.length === 0 && (!stockPositions || stockPositions.length === 0)) {
      return { success: true, message: "No open positions to update" }
    }

    // Get unique symbols from both options and stocks
    const optionSymbols = [...new Set(openLegs.map((leg) => leg.symbol))]
    const stockSymbols = [...new Set((stockPositions || []).map((pos) => pos.symbol))]
    const allSymbols = [...new Set([...optionSymbols, ...stockSymbols])]

    // Fetch current market data
    const quotes = await marketData.getMultipleQuotes(allSymbols)

    let updatedPositions = 0
    let exercisedLegs = 0
    let updatedStocks = 0
    const errors: string[] = []

    // Update stock positions with current prices
    if (stockPositions) {
      for (const stockPos of stockPositions) {
        const quote = quotes.get(stockPos.symbol)
        if (quote) {
          await supabase.from("positions").update({ current_price: quote.price }).eq("id", stockPos.id)
          updatedStocks++
        }
      }
    }

    // Group legs by symbol and position
    const positionGroups = new Map<string, typeof openLegs>()
    openLegs.forEach((leg) => {
      const key = `${leg.symbol}-${leg.position_id}`
      if (!positionGroups.has(key)) {
        positionGroups.set(key, [])
      }
      positionGroups.get(key)!.push(leg)
    })

    // Process each position
    for (const [key, positionLegs] of positionGroups) {
      const symbol = positionLegs[0].symbol
      const quote = quotes.get(symbol)

      if (!quote) {
        errors.push(`No quote data available for ${symbol}`)
        continue
      }

      try {
        // Analyze the position
        const analysis = analyzePosition(positionLegs, quote.price)

        // Update position with current price
        await supabase.from("positions").update({ current_price: quote.price }).eq("id", positionLegs[0].position_id)

        // Check each leg for auto-exercise
        for (const leg of positionLegs) {
          const legAnalysis = analysis.legs.find((la) => la.id === leg.id)
          if (!legAnalysis) continue

          // Auto-exercise expired ITM options
          if (shouldAutoExercise(legAnalysis)) {
            if (leg.type === "PUT" && leg.side === "SELL") {
              // Handle PUT assignment
              const assignmentDetails = calculateAssignmentDetails(leg, quote.price)
              if (assignmentDetails) {
                // Mark leg as assigned
                await supabase
                  .from("legs")
                  .update({
                    is_assigned: true,
                    close_date: new Date().toISOString().split("T")[0],
                    close_price: legAnalysis.intrinsicValue,
                  })
                  .eq("id", leg.id)

                // Create stock position
                await supabase.from("positions").insert({
                  portfolio_id: (
                    await supabase.from("positions").select("portfolio_id").eq("id", leg.position_id).single()
                  ).data?.portfolio_id,
                  symbol: leg.symbol,
                  status: "STOCK",
                  quantity: assignmentDetails.sharesAssigned,
                  cost_basis: assignmentDetails.netCostBasis,
                  current_price: quote.price,
                })

                exercisedLegs++
              }
            } else if (leg.type === "CALL" && leg.side === "SELL") {
              // Handle CALL assignment (stock called away)
              await supabase
                .from("legs")
                .update({
                  is_assigned: true,
                  close_date: new Date().toISOString().split("T")[0],
                  close_price: legAnalysis.intrinsicValue,
                })
                .eq("id", leg.id)

              // Reduce or remove stock position
              const stockPosition = stockPositions?.find((pos) => pos.symbol === leg.symbol)
              if (stockPosition) {
                const sharesCallAway = leg.contracts * 100
                const newQuantity = stockPosition.quantity - sharesCallAway

                if (newQuantity <= 0) {
                  // Remove stock position entirely
                  await supabase.from("positions").delete().eq("id", stockPosition.id)
                } else {
                  // Reduce stock position
                  await supabase.from("positions").update({ quantity: newQuantity }).eq("id", stockPosition.id)
                }
              }

              exercisedLegs++
            }
          }
        }

        updatedPositions++
      } catch (error) {
        if (error instanceof MarketDataError) {
          errors.push(`Market data error for ${symbol}: ${error.message} (Source: ${error.source})`)
        } else {
          errors.push(`Error processing ${symbol}: ${error instanceof Error ? error.message : "Unknown error"}`)
        }
      }
    }

    revalidatePath("/")

    return {
      success: true,
      message: `Updated ${updatedPositions} option positions, ${updatedStocks} stock positions, exercised ${exercisedLegs} legs`,
      errors: errors.length > 0 ? errors : undefined,
    }
  } catch (error) {
    console.error("Error updating market data:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    }
  }
}

export async function getPositionAnalysis(positionId: string) {
  try {
    const supabase = await createServerClient()
    const marketData = getMarketDataService()

    // Get position legs
    const { data: legs, error } = await supabase
      .from("legs")
      .select(`
        *,
        positions!inner(symbol, portfolio_id)
      `)
      .eq("position_id", positionId)

    if (error || !legs || legs.length === 0) {
      throw new Error("Position not found")
    }

    const symbol = legs[0].positions.symbol
    const quote = await marketData.getQuote(symbol)

    if (!quote) {
      throw new Error(`No market data available for ${symbol}`)
    }

    // Transform data to match expected format
    const transformedLegs = legs.map((leg) => ({
      ...leg,
      symbol,
      expiry: new Date(leg.expiry),
      openDate: new Date(leg.open_date),
      closeDate: leg.close_date ? new Date(leg.close_date) : undefined,
    }))

    const analysis = analyzePosition(transformedLegs, quote.price)

    return { success: true, analysis, quote }
  } catch (error) {
    console.error("Error getting position analysis:", error)
    if (error instanceof MarketDataError) {
      return {
        success: false,
        error: `Market data error: ${error.message} (Source: ${error.source})`,
      }
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    }
  }
}
