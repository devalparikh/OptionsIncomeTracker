"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown, Database, User, RefreshCw } from "lucide-react"

export function DebugPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [debugData, setDebugData] = useState<any>({})
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const fetchDebugData = async () => {
    setLoading(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setDebugData({ error: "No authenticated user" })
        return
      }

      // Get accounts
      const { data: accounts, error: accountError } = await supabase.from("accounts").select("*").eq("user_id", user.id)

      // Get portfolios
      const { data: portfolios, error: portfolioError } = await supabase.from("portfolios").select("*")

      // Get positions
      const { data: positions, error: positionError } = await supabase.from("positions").select("*")

      // Get legs
      const { data: legs, error: legError } = await supabase.from("legs").select("*")

      // Get profiles
      const { data: profiles, error: profileError } = await supabase.from("profiles").select("*").eq("id", user.id)

      setDebugData({
        user: {
          id: user.id,
          email: user.email,
        },
        profiles: {
          data: profiles,
          error: profileError,
          count: profiles?.length || 0,
        },
        accounts: {
          data: accounts,
          error: accountError,
          count: accounts?.length || 0,
        },
        portfolios: {
          data: portfolios,
          error: portfolioError,
          count: portfolios?.length || 0,
        },
        positions: {
          data: positions,
          error: positionError,
          count: positions?.length || 0,
        },
        legs: {
          data: legs,
          error: legError,
          count: legs?.length || 0,
        },
      })
    } catch (error) {
      setDebugData({ error: error instanceof Error ? error.message : "Unknown error" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchDebugData()
    }
  }, [isOpen])

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm" className="bg-background/80 backdrop-blur-sm">
            <Database className="h-4 w-4 mr-2" />
            Debug
            <ChevronDown className="h-4 w-4 ml-2" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Card className="w-96 mt-2 bg-background/95 backdrop-blur-sm border-border/50 max-h-96 overflow-y-auto">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Database Debug Panel</CardTitle>
                <Button variant="ghost" size="sm" onClick={fetchDebugData} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              {debugData.user && (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <User className="h-3 w-3" />
                    <span className="font-medium">User</span>
                  </div>
                  <div className="pl-5 text-muted-foreground">
                    <div>ID: {debugData.user.id}</div>
                    <div>Email: {debugData.user.email}</div>
                  </div>
                </div>
              )}

              {Object.entries(debugData)
                .filter(([key]) => key !== "user" && key !== "error")
                .map(([key, value]: [string, any]) => (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium capitalize">{key}</span>
                      <Badge variant={value.error ? "destructive" : "secondary"}>
                        {value.count} {value.error ? "ERROR" : ""}
                      </Badge>
                    </div>
                    {value.error && <div className="pl-2 text-red-600 text-xs">{value.error.message}</div>}
                    {value.data && value.data.length > 0 && (
                      <div className="pl-2 text-muted-foreground space-y-1">
                        {value.data.slice(0, 2).map((item: any, idx: number) => (
                          <div key={idx} className="text-xs bg-muted/20 p-1 rounded">
                            <pre className="whitespace-pre-wrap break-all">
                              {JSON.stringify(item, null, 2).slice(0, 200)}
                              {JSON.stringify(item).length > 200 ? "..." : ""}
                            </pre>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

              {debugData.error && (
                <div className="text-red-600">
                  <strong>Error:</strong> {debugData.error}
                </div>
              )}
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
