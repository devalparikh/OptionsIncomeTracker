"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { updateMarketData } from "@/app/actions/market-data"
import { RefreshCw, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react"

export function MarketDataUpdater() {
  const [isUpdating, setIsUpdating] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [updateResult, setUpdateResult] = useState<any>(null)
  const [autoUpdate, setAutoUpdate] = useState(false)

  // Auto-update every 5 minutes during market hours
  useEffect(() => {
    if (!autoUpdate) return

    const interval = setInterval(
      async () => {
        const now = new Date()
        const hour = now.getHours()
        const day = now.getDay()

        // Only update during market hours (9:30 AM - 4:00 PM ET, Mon-Fri)
        // This is simplified - you might want to account for holidays and exact market hours
        if (day >= 1 && day <= 5 && hour >= 9 && hour <= 16) {
          await handleUpdate()
        }
      },
      5 * 60 * 1000,
    ) // 5 minutes

    return () => clearInterval(interval)
  }, [autoUpdate])

  const handleUpdate = async () => {
    setIsUpdating(true)
    try {
      const result = await updateMarketData()
      setUpdateResult(result)
      setLastUpdate(new Date())
    } catch (error) {
      setUpdateResult({
        success: false,
        error: error instanceof Error ? error.message : "Update failed",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const toggleAutoUpdate = () => {
    setAutoUpdate(!autoUpdate)
  }

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Market Data</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={autoUpdate ? "default" : "outline"} className="text-xs">
              {autoUpdate ? "Auto" : "Manual"}
            </Badge>
            <Button variant="ghost" size="sm" onClick={toggleAutoUpdate} className="h-7 px-2 text-xs">
              {autoUpdate ? "Disable Auto" : "Enable Auto"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {lastUpdate ? <>Last updated: {lastUpdate.toLocaleTimeString()}</> : "Never updated"}
          </div>
          <Button variant="outline" size="sm" onClick={handleUpdate} disabled={isUpdating} className="h-7 px-3">
            <RefreshCw className={`h-3 w-3 mr-1 ${isUpdating ? "animate-spin" : ""}`} />
            Update
          </Button>
        </div>

        {updateResult && (
          <Alert className={`${updateResult.success ? "border-green-500" : "border-red-500"}`}>
            <div className="flex items-center gap-2">
              {updateResult.success ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-600" />
              )}
              <AlertDescription className={updateResult.success ? "text-green-600" : "text-red-600"}>
                {updateResult.message || updateResult.error}
              </AlertDescription>
            </div>
            {updateResult.errors && (
              <div className="mt-2 text-xs text-muted-foreground">
                <details>
                  <summary>View errors ({updateResult.errors.length})</summary>
                  <ul className="mt-1 space-y-1">
                    {updateResult.errors.map((error: string, index: number) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </details>
              </div>
            )}
          </Alert>
        )}

        <div className="text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            Auto-updates during market hours (9:30 AM - 4:00 PM ET)
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
