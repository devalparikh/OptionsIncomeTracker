"use client"

import { useState, useEffect } from "react"
import { Navbar } from "@/components/navbar"
import { Dashboard } from "@/components/dashboard"
import { AuthForm } from "@/components/auth/auth-form"
import { ThemeProvider } from "@/components/theme-provider"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"
import { Loader2 } from "lucide-react"
import { DebugPanel } from "@/components/debug-panel"

export default function Page() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [newEntryRequested, setNewEntryRequested] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    // Get initial user
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [supabase.auth])

  const handleNewEntry = () => {
    setNewEntryRequested(true)
    setTimeout(() => setNewEntryRequested(false), 100)
  }

  if (loading) {
    return (
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </ThemeProvider>
    )
  }

  if (!user) {
    return (
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <AuthForm />
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <Navbar onNewEntry={handleNewEntry} />
        <Dashboard onNewEntryRequest={() => setNewEntryRequested(true)} />
        <DebugPanel />
      </div>
    </ThemeProvider>
  )
}
