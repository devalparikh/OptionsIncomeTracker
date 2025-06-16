"use server"

import { createServerClient } from "@/lib/supabase/server"

export async function purgeUserData() {
  try {
    const supabase = await createServerClient()
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: "Not authenticated" }
    }

    // Get user's accounts
    const { data: accounts } = await supabase
      .from("accounts")
      .select("id")
      .eq("user_id", user.id)

    if (!accounts || accounts.length === 0) {
      return { success: true, message: "No data to purge" }
    }

    const accountIds = accounts.map(a => a.id)

    // Get portfolios for these accounts
    const { data: portfolios } = await supabase
      .from("portfolios")
      .select("id")
      .in("account_id", accountIds)

    if (!portfolios || portfolios.length === 0) {
      return { success: true, message: "No data to purge" }
    }

    const portfolioIds = portfolios.map(p => p.id)

    // Get positions for these portfolios
    const { data: positions } = await supabase
      .from("positions")
      .select("id")
      .in("portfolio_id", portfolioIds)

    if (!positions || positions.length === 0) {
      return { success: true, message: "No data to purge" }
    }

    const positionIds = positions.map(p => p.id)

    // Delete in correct order due to foreign key constraints
    const { error: legsError } = await supabase
      .from("legs")
      .delete()
      .in("position_id", positionIds)

    if (legsError) {
      return { success: false, error: `Error deleting legs: ${legsError.message}` }
    }

    const { error: positionsError } = await supabase
      .from("positions")
      .delete()
      .in("portfolio_id", portfolioIds)

    if (positionsError) {
      return { success: false, error: `Error deleting positions: ${positionsError.message}` }
    }

    const { error: portfoliosError } = await supabase
      .from("portfolios")
      .delete()
      .in("account_id", accountIds)

    if (portfoliosError) {
      return { success: false, error: `Error deleting portfolios: ${portfoliosError.message}` }
    }

    // const { error: accountsError } = await supabase
    //   .from("accounts")
    //   .delete()
    //   .eq("user_id", user.id)

    // if (accountsError) {
    //   return { success: false, error: `Error deleting accounts: ${accountsError.message}` }
    // }

    return { 
      success: true, 
      message: "Successfully purged all user data",
      stats: {
        accountsDeleted: accounts.length,
        portfoliosDeleted: portfolios.length,
        positionsDeleted: positions.length
      }
    }
  } catch (error) {
    console.error("Error purging user data:", error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error occurred" 
    }
  }
} 