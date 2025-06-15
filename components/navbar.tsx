"use client"

import { Button } from "@/components/ui/button"
import { Moon, Sun, TrendingUp, Plus } from "lucide-react"
import { useTheme } from "next-themes"
import { Badge } from "@/components/ui/badge"
import { useEffect, useState } from "react"
import { KeyboardShortcutsHelp } from "./keyboard-shortcuts-help"
import { UserProfile } from "./auth/user-profile"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"

interface NavbarProps {
  onNewEntry?: () => void
}

export function Navbar({ onNewEntry }: NavbarProps) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const supabase = createClient()

  useEffect(() => {
    setMounted(true)

    // Get initial user
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [supabase.auth])

  if (!mounted) {
    return null
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/40 supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo and Title */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 border border-primary/20">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-foreground">Options Wheel Tracker</h1>
              <Badge variant="outline" className="text-xs">
                MVP
              </Badge>
            </div>
          </div>

          {/* Navigation Items */}
          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center space-x-6 text-sm">
              <a href="#dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
                Dashboard
              </a>
              <a href="#positions" className="text-muted-foreground hover:text-foreground transition-colors">
                Positions
              </a>
              <a href="#analytics" className="text-muted-foreground hover:text-foreground transition-colors">
                Analytics
              </a>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center space-x-2">
              {/* New Entry Button */}
              <Button
                variant="default"
                size="sm"
                onClick={onNewEntry}
                className="hidden sm:flex items-center gap-2 bg-primary hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden lg:inline">New Entry</span>
                <Badge variant="secondary" className="text-xs font-mono ml-1">
                  Ctrl+N
                </Badge>
              </Button>

              {/* Mobile New Entry Button */}
              <Button variant="default" size="icon" onClick={onNewEntry} className="sm:hidden h-9 w-9 rounded-lg">
                <Plus className="h-4 w-4" />
                <span className="sr-only">New Entry</span>
              </Button>

              {/* Keyboard Shortcuts Help */}
              <KeyboardShortcutsHelp />

              {/* Theme Toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="h-9 w-9 rounded-lg bg-background/50 hover:bg-background/80 border border-border/40"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                <span className="sr-only">Toggle theme</span>
              </Button>

              {/* User Profile */}
              {user && <UserProfile user={user} />}
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}
