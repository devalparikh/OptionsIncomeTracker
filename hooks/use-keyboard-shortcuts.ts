"use client"

import { useEffect } from "react"

interface KeyboardShortcut {
  key: string
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  callback: () => void
  description: string
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Skip if user is typing in an input field
      const target = event.target as HTMLElement
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.contentEditable === "true") {
        return
      }

      shortcuts.forEach((shortcut) => {
        // Safely handle the key comparison
        const eventKey = event.key || ""
        const shortcutKey = shortcut.key || ""

        const matchesKey = eventKey.toLowerCase() === shortcutKey.toLowerCase()
        const matchesCtrl = shortcut.ctrlKey ? event.ctrlKey : !event.ctrlKey
        const matchesMeta = shortcut.metaKey ? event.metaKey : !event.metaKey
        const matchesShift = shortcut.shiftKey ? event.shiftKey : !event.shiftKey
        const matchesAlt = shortcut.altKey ? event.altKey : !event.altKey

        if (matchesKey && matchesCtrl && matchesMeta && matchesShift && matchesAlt) {
          event.preventDefault()
          shortcut.callback()
        }
      })
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [shortcuts])
}
