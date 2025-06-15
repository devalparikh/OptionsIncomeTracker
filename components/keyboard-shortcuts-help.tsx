"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Keyboard, Plus, Search, BarChart3 } from "lucide-react"

const shortcuts = [
  {
    keys: ["Ctrl", "N"],
    description: "Create new contract entry",
    icon: <Plus className="h-4 w-4" />,
  },
  {
    keys: ["Ctrl", "K"],
    description: "Quick search positions",
    icon: <Search className="h-4 w-4" />,
  },
  {
    keys: ["Ctrl", "D"],
    description: "Go to dashboard",
    icon: <BarChart3 className="h-4 w-4" />,
  },
  {
    keys: ["?"],
    description: "Show keyboard shortcuts",
    icon: <Keyboard className="h-4 w-4" />,
  },
]

export function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-lg bg-background/50 hover:bg-background/80 border border-border/40"
        >
          <Keyboard className="h-4 w-4" />
          <span className="sr-only">Keyboard shortcuts</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {shortcuts.map((shortcut, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {shortcut.icon}
                <span className="text-sm text-foreground">{shortcut.description}</span>
              </div>
              <div className="flex items-center gap-1">
                {shortcut.keys.map((key, keyIndex) => (
                  <Badge key={keyIndex} variant="outline" className="text-xs font-mono">
                    {key}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
