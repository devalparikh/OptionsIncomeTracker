import { createServerClient } from "./server"
import { createClient } from "./client"
import type { Database } from "./database.types"

type Leg = Database["public"]["Tables"]["legs"]["Row"]
type Position = Database["public"]["Tables"]["positions"]["Row"]
type Portfolio = Database["public"]["Tables"]["portfolios"]["Row"]
type Account = Database["public"]["Tables"]["accounts"]["Row"]

export interface LegWithPosition extends Omit<Leg, "expiry" | "open_date" | "close_date"> {
  symbol: string
  expiry: Date
  openDate: Date
  closeDate?: Date
}

// Server-side data fetching
export async function getLegsServer(): Promise<LegWithPosition[]> {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  try {
    // Step 1: Get user's accounts
    const { data: accounts, error: accountError } = await supabase.from("accounts").select("id").eq("user_id", user.id)

    if (accountError) {
      console.error("Error fetching accounts:", accountError)
      return []
    }

    if (!accounts || accounts.length === 0) {
      console.log("No accounts found for user")
      return []
    }

    const accountIds = accounts.map((a) => a.id)

    // Step 2: Get portfolios for those accounts
    const { data: portfolios, error: portfolioError } = await supabase
      .from("portfolios")
      .select("id")
      .in("account_id", accountIds)

    if (portfolioError) {
      console.error("Error fetching portfolios:", portfolioError)
      return []
    }

    if (!portfolios || portfolios.length === 0) {
      console.log("No portfolios found for accounts")
      return []
    }

    const portfolioIds = portfolios.map((p) => p.id)

    // Step 3: Get positions for those portfolios
    const { data: positions, error: positionError } = await supabase
      .from("positions")
      .select("id, symbol")
      .in("portfolio_id", portfolioIds)

    if (positionError) {
      console.error("Error fetching positions:", positionError)
      return []
    }

    if (!positions || positions.length === 0) {
      console.log("No positions found for portfolios")
      return []
    }

    const positionIds = positions.map((p) => p.id)

    // Step 4: Get legs for those positions
    const { data: legs, error: legError } = await supabase
      .from("legs")
      .select("*")
      .in("position_id", positionIds)
      .order("created_at", { ascending: false })

    if (legError) {
      console.error("Error fetching legs:", legError)
      return []
    }

    if (!legs) return []

    // Step 5: Combine legs with position symbols
    return legs.map((leg) => {
      const position = positions.find((p) => p.id === leg.position_id)
      return {
        ...leg,
        symbol: position?.symbol || "UNKNOWN",
        expiry: new Date(leg.expiry),
        openDate: new Date(leg.open_date),
        closeDate: leg.close_date ? new Date(leg.close_date) : undefined,
      }
    })
  } catch (error) {
    console.error("Error in getLegsServer:", error)
    return []
  }
}

// Client-side data fetching
export async function getLegsClient(): Promise<LegWithPosition[]> {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  try {
    // Step 1: Get user's accounts
    const { data: accounts, error: accountError } = await supabase.from("accounts").select("id").eq("user_id", user.id)

    if (accountError) {
      console.error("Error fetching accounts:", accountError)
      return []
    }

    if (!accounts || accounts.length === 0) {
      console.log("No accounts found for user")
      return []
    }

    const accountIds = accounts.map((a) => a.id)

    // Step 2: Get portfolios for those accounts
    const { data: portfolios, error: portfolioError } = await supabase
      .from("portfolios")
      .select("id")
      .in("account_id", accountIds)

    if (portfolioError) {
      console.error("Error fetching portfolios:", portfolioError)
      return []
    }

    if (!portfolios || portfolios.length === 0) {
      console.log("No portfolios found for accounts")
      return []
    }

    const portfolioIds = portfolios.map((p) => p.id)

    // Step 3: Get positions for those portfolios
    const { data: positions, error: positionError } = await supabase
      .from("positions")
      .select("id, symbol")
      .in("portfolio_id", portfolioIds)

    if (positionError) {
      console.error("Error fetching positions:", positionError)
      return []
    }

    if (!positions || positions.length === 0) {
      console.log("No positions found for portfolios")
      return []
    }

    const positionIds = positions.map((p) => p.id)

    // Step 4: Get legs for those positions
    const { data: legs, error: legError } = await supabase
      .from("legs")
      .select("*")
      .in("position_id", positionIds)
      .order("created_at", { ascending: false })

    if (legError) {
      console.error("Error fetching legs:", legError)
      return []
    }

    if (!legs) return []

    // Step 5: Combine legs with position symbols
    return legs.map((leg) => {
      const position = positions.find((p) => p.id === leg.position_id)
      return {
        ...leg,
        symbol: position?.symbol || "UNKNOWN",
        expiry: new Date(leg.expiry),
        openDate: new Date(leg.open_date),
        closeDate: leg.close_date ? new Date(leg.close_date) : undefined,
      }
    })
  } catch (error) {
    console.error("Error in getLegsClient:", error)
    return []
  }
}

export async function getUserProfile() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

  return profile
}

export async function getUserAccounts() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  // Get accounts first
  const { data: accounts, error: accountError } = await supabase.from("accounts").select("*").eq("user_id", user.id)

  if (accountError || !accounts) {
    console.error("Error fetching accounts:", accountError)
    return []
  }

  // Get portfolios for each account
  const accountsWithPortfolios = await Promise.all(
    accounts.map(async (account) => {
      const { data: portfolios } = await supabase.from("portfolios").select("*").eq("account_id", account.id)

      return {
        ...account,
        portfolios: portfolios || [],
      }
    }),
  )

  return accountsWithPortfolios
}
