"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Loader2, Send, Bot, User, Settings, AlertCircle, Globe, Search, Copy, Check } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { AIChatConfig, DEFAULT_CONFIG, AVAILABLE_MODELS, TEMPERATURE_PRESETS, SYSTEM_PROMPT_VARIANTS, modelSupportsWebSearch } from "@/lib/ai-chat-config"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

interface PortfolioData {
  openLegs: any[]
  closedLegs: any[]
  stockPositions: any[]
  portfolioMetrics: any
  coveredCallPositions: any[]
  stockQuotes: Map<string, any>
}

interface AIChatProps {
  portfolioData: PortfolioData
  loading?: boolean
}

export function AIInvestmentChat({ portfolioData, loading }: AIChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [config, setConfig] = useState<AIChatConfig>(DEFAULT_CONFIG)
  const [showConfig, setShowConfig] = useState(false)
  const [configError, setConfigError] = useState("")
  const [selectedPromptVariant, setSelectedPromptVariant] = useState("custom")
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)

  // Load config from localStorage on mount
  useEffect(() => {
    const savedConfig = localStorage.getItem("ai-chat-config")
    console.log("Loading saved config:", savedConfig)
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig)
        console.log("Parsed config:", parsed)
        // Only merge non-empty values to preserve existing API key
        const mergedConfig = { ...DEFAULT_CONFIG }
        Object.keys(parsed).forEach(key => {
          if (key === 'apiKey') {
            // Only set API key if it exists and is not empty
            if (parsed.apiKey && parsed.apiKey.trim() !== '') {
              mergedConfig.apiKey = parsed.apiKey
              console.log("Loaded API key:", parsed.apiKey.substring(0, 10) + "...")
            }
          } else if (parsed[key] !== undefined && parsed[key] !== null) {
            ;(mergedConfig as any)[key] = parsed[key]
          }
        })
        console.log("Final merged config:", mergedConfig)
        setConfig(mergedConfig)
        
        // Set the selected prompt variant based on the loaded system prompt
        const systemPrompt = mergedConfig.systemPrompt
        const variant = Object.entries(SYSTEM_PROMPT_VARIANTS).find(([_, prompt]) => prompt === systemPrompt)
        if (variant) {
          setSelectedPromptVariant(variant[0])
        }
      } catch (error) {
        console.error("Error loading chat config:", error)
      }
    } else {
      console.log("No saved config found, using defaults")
    }
  }, [])

  // Save config to localStorage when it changes
  useEffect(() => {
    // Only save if we have a config with at least some non-default values
    if (config.apiKey || config.systemPrompt !== DEFAULT_CONFIG.systemPrompt || 
        config.model !== DEFAULT_CONFIG.model || config.temperature !== DEFAULT_CONFIG.temperature ||
        config.maxTokens !== DEFAULT_CONFIG.maxTokens || config.budgetMode !== DEFAULT_CONFIG.budgetMode ||
        config.webSearchEnabled !== DEFAULT_CONFIG.webSearchEnabled) {
      console.log("Saving config to localStorage:", { ...config, apiKey: config.apiKey ? config.apiKey.substring(0, 10) + "..." : "" })
      localStorage.setItem("ai-chat-config", JSON.stringify(config))
    }
  }, [config])

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    if (!config.apiKey) {
      setConfigError("Please configure your OpenAI API key in settings")
      setShowConfig(true)
      return
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputValue,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue("")
    setIsLoading(true)

    try {
      const response = await fetch("/api/ai-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          portfolioData,
          config
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.content,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error("Error sending message:", error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: error instanceof Error ? error.message : "Sorry, I encountered an error while processing your request. Please check your API key and try again.",
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const clearChat = () => {
    setMessages([])
  }

  const handlePromptVariantChange = (variant: string) => {
    setSelectedPromptVariant(variant)
    setConfig(prev => ({
      ...prev,
      systemPrompt: SYSTEM_PROMPT_VARIANTS[variant as keyof typeof SYSTEM_PROMPT_VARIANTS] || SYSTEM_PROMPT_VARIANTS.custom
    }))
  }

  const copyMessage = async (messageId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedMessageId(messageId)
      setTimeout(() => setCopiedMessageId(null), 2000)
    } catch (error) {
      console.error("Failed to copy message:", error)
    }
  }

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm flex-1 min-h-0 flex flex-col w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center space-x-2">
          <Bot className="h-5 w-5 text-primary" />
          <CardTitle className="text-foreground">AI Investment Analyst</CardTitle>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowConfig(true)}
          >
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={clearChat}
          >
            Clear
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 min-h-0 flex flex-col space-y-4 overflow-hidden p-4 md:p-6">
        {/* Portfolio Summary */}
        <div className="bg-muted/30 rounded-lg p-3 mb-2">
          <div className="text-sm font-medium text-foreground mb-2">Portfolio Summary</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Open:</span> {portfolioData.openLegs.length}
            </div>
            <div>
              <span className="text-muted-foreground">Closed:</span> {portfolioData.closedLegs.length}
            </div>
            <div>
              <span className="text-muted-foreground">Stocks:</span> {portfolioData.stockPositions.length}
            </div>
            <div>
              <span className="text-muted-foreground">Net P/L:</span> 
              <span className={portfolioData.portfolioMetrics?.netPL >= 0 ? "text-green-600" : "text-red-600"}>
                ${portfolioData.portfolioMetrics?.netPL?.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 min-h-0 flex flex-col">
          <ScrollArea className="flex-1 min-h-0 overflow-y-auto border rounded-lg p-4 bg-background/50">
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">Ask me about your portfolio performance, risk analysis, or options strategies.</p>
                <p className="text-xs mt-2">I have access to all your positions and can provide personalized insights.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in-0 slide-in-from-bottom-2 duration-300`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg p-3 relative group ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground border border-border/50"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          {message.role === "user" ? (
                            <User className="h-3 w-3" />
                          ) : (
                            <Bot className="h-3 w-3" />
                          )}
                          <span className="text-xs opacity-70">
                            {message.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                        {message.role === "assistant" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyMessage(message.id, message.content)}
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            {copiedMessageId === message.id ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        )}
                      </div>
                      <div className={`text-sm ${message.role === "user" ? "" : "prose-custom"}`}>
                        {message.role === "user" ? (
                          <div className="whitespace-pre-wrap">{message.content}</div>
                        ) : (
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                          >
                            {message.content}
                          </ReactMarkdown>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
                    <div className="bg-muted rounded-lg p-3 border border-border/50">
                      <div className="flex items-center space-x-2">
                        <Bot className="h-4 w-4 text-primary" />
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-primary rounded-full typing-dot"></div>
                          <div className="w-2 h-2 bg-primary rounded-full typing-dot"></div>
                          <div className="w-2 h-2 bg-primary rounded-full typing-dot"></div>
                        </div>
                        <span className="text-sm text-muted-foreground">Analyzing...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Input */}
        <div className="flex space-x-2 pt-2 items-center">
          <Button
            type="button"
            variant={config.webSearchEnabled ? "default" : "outline"}
            size="icon"
            onClick={() => {
              if (!config.webSearchEnabled) {
                setConfig(prev => ({ ...prev, webSearchEnabled: true, model: "gpt-4o" }))
              } else {
                setConfig(prev => ({ ...prev, webSearchEnabled: false }))
              }
            }}
            title="Enable Web Search (uses GPT-4o)"
            aria-label="Enable Web Search (uses GPT-4o)"
          >
            <Globe className={config.webSearchEnabled ? "text-blue-600" : "text-muted-foreground"} />
          </Button>
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about your portfolio, risk analysis, or strategies..."
            disabled={isLoading || loading}
            className="flex-1"
          />
          <Button
            onClick={sendMessage}
            disabled={!inputValue.trim() || isLoading || loading}
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        {configError && (
          <Alert className="border-red-500 mt-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-red-600">
              {configError}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>

      {/* Configuration Dialog */}
      <Dialog open={showConfig} onOpenChange={setShowConfig}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>AI Chat Configuration</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="apiKey">OpenAI API Key</Label>
              <Input
                id="apiKey"
                type="password"
                value={config.apiKey}
                onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                placeholder="sk-..."
              />
            </div>
            <div>
              <Label htmlFor="model">Model</Label>
              <select
                id="model"
                value={config.model}
                onChange={(e) => setConfig(prev => ({ ...prev, model: e.target.value }))}
                className="w-full p-2 border rounded-md"
              >
                {AVAILABLE_MODELS.map(model => (
                  <option key={model.value} value={model.value}>
                    {model.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="temperature">Temperature</Label>
              <Input
                id="temperature"
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={config.temperature}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
              />
              <div className="text-xs text-muted-foreground mt-1">
                {config.temperature} (0 = focused, 2 = creative)
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {TEMPERATURE_PRESETS.map(preset => (
                  <Button
                    key={preset.value}
                    variant={config.temperature === preset.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setConfig(prev => ({ ...prev, temperature: preset.value }))}
                    className="text-xs"
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="maxTokens">Max Tokens</Label>
              <Input
                id="maxTokens"
                type="number"
                min="100"
                max="4000"
                value={config.maxTokens}
                onChange={(e) => setConfig(prev => ({ ...prev, maxTokens: parseInt(e.target.value) }))}
              />
            </div>
            <div>
              <Label>System Prompt Style</Label>
              <div className="flex flex-wrap gap-1">
                {Object.keys(SYSTEM_PROMPT_VARIANTS).map(variant => (
                  <Button
                    key={variant}
                    variant={selectedPromptVariant === variant ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePromptVariantChange(variant)}
                    className="text-xs capitalize"
                  >
                    {variant}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="systemPrompt">Custom System Prompt</Label>
              <Textarea
                id="systemPrompt"
                value={config.systemPrompt}
                onChange={(e) => setConfig(prev => ({ ...prev, systemPrompt: e.target.value }))}
                rows={6}
                placeholder="Customize the AI's role and behavior..."
              />
            </div>
            <div>
              <Label htmlFor="budgetMode">Budget Mode</Label>
              <div className="flex items-center space-x-2">
                <input
                  id="budgetMode"
                  type="checkbox"
                  checked={!!config.budgetMode}
                  onChange={e => setConfig(prev => ({ ...prev, budgetMode: e.target.checked }))}
                  className="form-checkbox h-4 w-4 text-primary border-gray-300 rounded"
                />
                <span className="text-xs text-muted-foreground">Optimize for lower token usage</span>
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setConfig(DEFAULT_CONFIG)}
              >
                Reset to Default
              </Button>
              <Button onClick={() => setShowConfig(false)}>
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
} 