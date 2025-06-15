"use client"

import type React from "react"
import { useState } from "react"
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
    type: "PUT" as "PUT" | "CALL",
    symbol: "",
    strike: "",
    expiry: "",
    openDate: new Date().toISOString().split("T")[0],
    openPrice: "",
    contracts: "1",
  })
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

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
              >
                <SelectTrigger className="bg-background/50 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SELL">Sell</SelectItem>
                  <SelectItem value="BUY">Buy</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="type" className="text-foreground">
                Option Type
              </Label>
              <Select
                value={formData.type}
                onValueChange={(value: "PUT" | "CALL") => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger className="bg-background/50 border-border/50">
                  <SelectValue />
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
              onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
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
              <Label htmlFor="openPrice" className="text-foreground">
                Premium (per contract)
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="expiry" className="text-foreground">
                Expiry Date
              </Label>
              <Input
                id="expiry"
                type="date"
                value={formData.expiry}
                onChange={(e) => setFormData({ ...formData, expiry: e.target.value })}
                className="bg-background/50 border-border/50"
                required
                disabled={isLoading}
              />
            </div>

            <div>
              <Label htmlFor="openDate" className="text-foreground">
                Open Date
              </Label>
              <Input
                id="openDate"
                type="date"
                value={formData.openDate}
                onChange={(e) => setFormData({ ...formData, openDate: e.target.value })}
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
