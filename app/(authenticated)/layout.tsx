"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Navbar } from "@/components/navbar"
import { ThemeProvider } from "@/components/theme-provider"
import type { User } from "@supabase/supabase-js"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ContractEntryForm } from "@/components/contract-entry-form"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isContractModalOpen, setIsContractModalOpen] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // Add keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: "n",
      ctrlKey: true,
      callback: () => setIsContractModalOpen(true),
      description: "Create new contract entry",
    },
  ])

  useEffect(() => {
    // Get initial user
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      setLoading(false)
      if (!user) {
        router.push("/")
      }
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
      if (!session?.user) {
        router.push("/")
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase.auth, router])

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
    return null
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <Navbar onNewEntry={() => setIsContractModalOpen(true)} />
        {children}
        <Dialog open={isContractModalOpen} onOpenChange={setIsContractModalOpen}>
          <DialogContent className="sm:max-w-2xl bg-background/95 backdrop-blur-sm border-border/50">
            <DialogHeader>
              <DialogTitle>Add New Contract</DialogTitle>
            </DialogHeader>
            <ContractEntryForm onSubmit={() => setIsContractModalOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>
    </ThemeProvider>
  )
} 