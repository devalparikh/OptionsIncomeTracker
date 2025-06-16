"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { purgeUserData } from "@/app/actions/purge-data"
import { Trash2 } from "lucide-react"

export function PurgeDataButton() {
  const [isPurging, setIsPurging] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message?: string; error?: string; stats?: { accountsDeleted: number; portfoliosDeleted: number; positionsDeleted: number } } | null>(null)

  const handlePurge = async () => {
    setIsPurging(true)
    try {
      const result = await purgeUserData()
      setResult(result)
    } catch (error) {
      setResult({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error occurred" 
      })
    } finally {
      setIsPurging(false)
    }
  }

  return (
    <div className="space-y-4">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" disabled={isPurging}>
            <Trash2 className="h-4 w-4 mr-2" />
            {isPurging ? "Purging..." : "Purge All Data"}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete all your positions, legs, portfolios, and accounts.
              Your profile will remain intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePurge} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Yes, purge all data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {result && (
        <Alert className={result.success ? "border-green-500" : "border-red-500"}>
          <AlertDescription className={result.success ? "text-green-600" : "text-red-600"}>
            {result.message || result.error}
            {result.stats && (
              <div className="mt-2 text-sm">
                <div>Accounts deleted: {result.stats.accountsDeleted}</div>
                <div>Portfolios deleted: {result.stats.portfoliosDeleted}</div>
                <div>Positions deleted: {result.stats.positionsDeleted}</div>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
} 