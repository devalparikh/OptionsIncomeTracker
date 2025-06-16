"use client"

import { Button } from "@/components/ui/button"
import { Moon, Sun, TrendingUp, Plus, Menu, X, Upload } from "lucide-react"
import { useTheme } from "next-themes"
import { Badge } from "@/components/ui/badge"
import { useEffect, useState } from "react"
import { KeyboardShortcutsHelp } from "./keyboard-shortcuts-help"
import { UserProfile } from "./auth/user-profile"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"
import Link from "next/link"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

interface NavbarProps {
  onNewEntry?: () => void
}

export function Navbar({ onNewEntry }: NavbarProps) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
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
      <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          {/* Logo and Title */}
          <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/10 border border-primary/20">
                <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
              </div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg sm:text-xl font-bold text-foreground">Options Wheel</h1>
                <Badge variant="outline" className="text-xs hidden sm:inline-flex">
                  MVP
                </Badge>
              </div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-4">
            <div className="flex items-center space-x-6 text-sm">
              {/* <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
                Dashboard
              </Link> */}
              {/* <a href="#positions" className="text-muted-foreground hover:text-foreground transition-colors">
                Positions
              </a>
              <a href="#analytics" className="text-muted-foreground hover:text-foreground transition-colors">
                Analytics
              </a> */}
            </div>

            {/* Quick Actions */}
            <div className="flex items-center space-x-2">
              {/* New Entry Button */}
              <Button
                variant="default"
                size="sm"
                onClick={onNewEntry}
                className="flex items-center gap-2 bg-primary hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden lg:inline">New Entry</span>
                <Badge variant="secondary" className="text-xs font-mono ml-1">
                  Ctrl+N
                </Badge>
              </Button>

              {/* CSV Upload Button */}
              <Link href="/settings">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2 border-border/50 hover:bg-muted/50"
                >
                  <Upload className="h-4 w-4" />
                  <span className="hidden lg:inline">Upload CSV</span>
                </Button>
              </Link>

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

          {/* Mobile Navigation */}
          <div className="flex md:hidden items-center space-x-2">
            {/* New Entry Button */}
            <Button variant="default" size="icon" onClick={onNewEntry} className="h-9 w-9 rounded-lg">
              <Plus className="h-4 w-4" />
              <span className="sr-only">New Entry</span>
            </Button>

            {/* CSV Upload Button */}
            <Link href="/settings">
              <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg">
                <Upload className="h-4 w-4" />
                <span className="sr-only">Upload CSV</span>
              </Button>
            </Link>

            {/* Mobile Menu */}
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg">
                  <Menu className="h-4 w-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[240px] sm:w-[280px]">
                <div className="flex flex-col h-full">
                  <div className="flex-1 py-4">
                    <div className="flex flex-col space-y-4">
                      <Link 
                        href="/dashboard" 
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        Dashboard
                      </Link>
                      <a 
                        href="#positions" 
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        Positions
                      </a>
                      <a 
                        href="#analytics" 
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        Analytics
                      </a>
                      <Link 
                        href="/settings" 
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        Upload CSV
                      </Link>
                    </div>
                  </div>
                  <div className="border-t border-border/40 py-4">
                    <div className="flex items-center justify-between px-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                        className="w-full justify-start"
                      >
                        {theme === "dark" ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
                        {theme === "dark" ? "Light Mode" : "Dark Mode"}
                      </Button>
                    </div>
                    {user && (
                      <div className="mt-2 px-2">
                        <UserProfile user={user} />
                      </div>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  )
}
