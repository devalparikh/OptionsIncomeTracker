"use client"

import { useState } from "react"
import { Dashboard } from "@/components/dashboard"
import { DebugPanel } from "@/components/debug-panel"

export default function DashboardPage() {
  const [newEntryRequested, setNewEntryRequested] = useState(false)

  const handleNewEntry = () => {
    setNewEntryRequested(true)
    setTimeout(() => setNewEntryRequested(false), 100)
  }

  return (
    <div className="min-h-screen bg-background">
      <Dashboard onNewEntryRequest={() => setNewEntryRequested(true)} />
      <DebugPanel />
    </div>
  )
} 