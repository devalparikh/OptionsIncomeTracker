"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2 } from "lucide-react"
import { createLeg } from "@/app/actions/legs"

interface ContractEntryFormProps {
  onSubmit?: () => void
}

export function ContractEntryForm({ onSubmit }: ContractEntryFormProps) {
  const [formData, setFormData] = useState({
    side: "SELL" as "SELL" | "BUY",
    type: "CALL" as "PUT" | "CALL",
    symbol: "",
    strike: "",
    expiry: "",
    openDate: new Date().toISOString().split("T")[0],
    openPrice: "",
    contracts: "1",
    shareCostBasis: "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const showShareCostBasis = formData.side === "SELL" && formData.type === "CALL"

  useEffect(() => {
    if (!showShareCostBasis) {
      setFormData(prev => ({ ...prev, shareCostBasis: "" }))
    }
  }, [formData.side, formData.type])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage(null)

    try {
      const result = await createLeg({
        symbol: formData.symbol.toUpperCase(),
        side: formData.side,
        type: formData.type,
        strike: Number.parseFloat(formData.strike),
        expiry: formData.expiry,
        open_date: formData.openDate,
        open_price: Number.parseFloat(formData.openPrice),
        contracts: Number.parseInt(formData.contracts),
        commissions: 0,
        share_cost_basis: showShareCostBasis ? Number.parseFloat(formData.shareCostBasis) : undefined,
      })

      if (result.success) {
        setMessage({ type: "success", text: "Contract added successfully!" })
        // Reset form
        setFormData({
          ...formData,
          symbol: "",
          strike: "",
          expiry: "",
          openPrice: "",
          contracts: "1",
          shareCostBasis: "",
        })
        onSubmit?.()
      } else {
        setMessage({ type: "error", text: result.error || "Failed to add contract" })
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "An unexpected error occurred",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-2xl border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-foreground">Add New Contract</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="side" className="text-foreground">
                Side
              </Label>
              <Select
                value={formData.side}
                onValueChange={(value: "SELL" | "BUY") => setFormData({ ...formData, side: value })}
                disabled={isLoading}
              >
                <SelectTrigger className="bg-background/50 border-border/50">
                  <SelectValue placeholder="Select side" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SELL">Sell</SelectItem>
                  <SelectItem value="BUY">Buy</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="type" className="text-foreground">
                Type
              </Label>
              <Select
                value={formData.type}
                onValueChange={(value: "PUT" | "CALL") => setFormData({ ...formData, type: value })}
                disabled={isLoading}
              >
                <SelectTrigger className="bg-background/50 border-border/50">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PUT">Put</SelectItem>
                  <SelectItem value="CALL">Call</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="symbol" className="text-foreground">
              Symbol
            </Label>
            <Input
              id="symbol"
              value={formData.symbol}
              onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
              placeholder="AAPL"
              className="bg-background/50 border-border/50"
              required
              disabled={isLoading}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="strike" className="text-foreground">
                Strike Price
              </Label>
              <Input
                id="strike"
                type="number"
                step="0.01"
                value={formData.strike}
                onChange={(e) => setFormData({ ...formData, strike: e.target.value })}
                placeholder="150.00"
                className="bg-background/50 border-border/50"
                required
                disabled={isLoading}
              />
            </div>
            <div>
              <Label htmlFor="expiry" className="text-foreground">
                Expiry Date
              </Label>
              <Input
                id="expiry"
                type="date"
                value={formData.expiry}
                onChange={(e) => setFormData({ ...formData, expiry: e.target.value })}
                min={formData.openDate}
                className="bg-background/50 border-border/50"
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="openDate" className="text-foreground">
                Open Date
              </Label>
              <Input
                id="openDate"
                type="date"
                value={formData.openDate}
                onChange={(e) => setFormData({ ...formData, openDate: e.target.value })}
                max={formData.expiry}
                className="bg-background/50 border-border/50"
                required
                disabled={isLoading}
              />
            </div>
            <div>
              <Label htmlFor="openPrice" className="text-foreground">
                Open Price
              </Label>
              <Input
                id="openPrice"
                type="number"
                step="0.01"
                value={formData.openPrice}
                onChange={(e) => setFormData({ ...formData, openPrice: e.target.value })}
                placeholder="2.50"
                className="bg-background/50 border-border/50"
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="contracts" className="text-foreground">
              Number of Contracts
            </Label>
            <Input
              id="contracts"
              type="number"
              min="1"
              value={formData.contracts}
              onChange={(e) => setFormData({ ...formData, contracts: e.target.value })}
              className="bg-background/50 border-border/50"
              required
              disabled={isLoading}
            />
          </div>

          {showShareCostBasis && (
            <div>
              <Label htmlFor="shareCostBasis" className="text-foreground">
                Share Cost Basis (per share)
              </Label>
              <Input
                id="shareCostBasis"
                type="number"
                step="0.01"
                value={formData.shareCostBasis}
                onChange={(e) => setFormData({ ...formData, shareCostBasis: e.target.value })}
                placeholder="150.00"
                className="bg-background/50 border-border/50"
                required={showShareCostBasis}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Enter the cost basis per share for the shares being used as collateral
              </p>
            </div>
          )}

          <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? "Adding Contract..." : "Add Contract"}
          </Button>

          {message && (
            <Alert className={`${message.type === "error" ? "border-red-500" : "border-green-500"}`}>
              <AlertDescription className={message.type === "error" ? "text-red-600" : "text-green-600"}>
                {message.text}
              </AlertDescription>
            </Alert>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
