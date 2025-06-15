"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { getLegsClient, type LegWithPosition } from "@/lib/supabase/queries"

export function useLegsData() {
  const [legs, setLegs] = useState<LegWithPosition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const fetchLegs = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getLegsClient()
      setLegs(data)
    } catch (err) {
      console.error("Error in fetchLegs:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLegs()

    // Set up real-time subscription for legs table
    const channel = supabase
      .channel("legs_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "legs",
        },
        () => {
          console.log("Legs data changed, refetching...")
          fetchLegs()
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "positions",
        },
        () => {
          console.log("Positions data changed, refetching...")
          fetchLegs()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  return { legs, loading, error, refetch: fetchLegs }
}
