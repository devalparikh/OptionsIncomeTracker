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
import { AIChatConfig, DEFAULT_CONFIG, AVAILABLE_MODELS, TEMPERATURE_PRESETS, SYSTEM_PROMPT_VARIANTS, modelSupportsWebSearch, estimateCost, OPENAI_PRICING } from "@/lib/ai-chat-config"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  sources?: Array<{
    title: string
    url: string
    snippet: string
    published_date?: string | null
    start_index?: number
    end_index?: number
  }>
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
  const [showConfig, setShowConfig] = useState(false)
  const [configError, setConfigError] = useState<string | null>(null)
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const [selectedPromptVariant, setSelectedPromptVariant] = useState("custom")
  const [totalTokensUsed, setTotalTokensUsed] = useState(0)
  const [totalCost, setTotalCost] = useState(0)
  const [config, setConfig] = useState<AIChatConfig>(DEFAULT_CONFIG)

  // Load config from localStorage on mount
  useEffect(() => {
    const savedConfig = localStorage.getItem("ai-chat-config")
    if (savedConfig) {
      try {
        const parsedConfig = JSON.parse(savedConfig)
        setConfig(parsedConfig)
        console.log("Loaded saved config:", { ...parsedConfig, apiKey: parsedConfig.apiKey ? parsedConfig.apiKey.substring(0, 10) + "..." : "" })
      } catch (error) {
        console.error("Error loading chat config:", error)
      }
    } else {
      console.log("No saved config found, using defaults")
    }
    
    // Load saved token usage
    const savedTokenUsage = localStorage.getItem("ai-chat-token-usage")
    if (savedTokenUsage) {
      try {
        const parsedTokenUsage = parseInt(savedTokenUsage, 10)
        setTotalTokensUsed(parsedTokenUsage)
      } catch (error) {
        console.error("Error loading token usage:", error)
      }
    }
    
    // Load saved cost
    const savedCost = localStorage.getItem("ai-chat-total-cost")
    if (savedCost) {
      try {
        const parsedCost = parseFloat(savedCost)
        setTotalCost(parsedCost)
      } catch (error) {
        console.error("Error loading cost:", error)
      }
    }
  }, [])

  // Save config to localStorage when it changes
  useEffect(() => {
    // Only save if we have a config with at least some non-default values
    if (config.apiKey || config.systemPrompt !== DEFAULT_CONFIG.systemPrompt || 
        config.model !== DEFAULT_CONFIG.model || config.temperature !== DEFAULT_CONFIG.temperature ||
        config.maxTokens !== DEFAULT_CONFIG.maxTokens || config.compressionLevel !== DEFAULT_CONFIG.compressionLevel ||
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
      console.log("Data:", data)
      
      // Update token usage if provided in response
      if (data.tokenUsage) {
        const newTotal = totalTokensUsed + data.tokenUsage
        const newCost = totalCost + parseFloat(data.estimatedCost || '0')
        setTotalTokensUsed(newTotal)
        setTotalCost(newCost)
        localStorage.setItem("ai-chat-token-usage", newTotal.toString())
        localStorage.setItem("ai-chat-total-cost", newCost.toString())
      }
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.content,
        timestamp: new Date(),
        sources: data.sources
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
    setTotalTokensUsed(0)
    setTotalCost(0)
    localStorage.removeItem("ai-chat-token-usage")
    localStorage.removeItem("ai-chat-total-cost")
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

  const estimateTokenUsage = (portfolioData: PortfolioData, compressionLevel: string) => {
    // Rough estimation based on data size and compression level
    const baseTokens = 1000; // Base system prompt and structure
    
    if (compressionLevel === 'none') {
      const openLegsTokens = (portfolioData.openLegs?.length || 0) * 200;
      const closedLegsTokens = (portfolioData.closedLegs?.length || 0) * 150;
      const stockTokens = (portfolioData.stockPositions?.length || 0) * 100;
      const quotesTokens = Object.keys(portfolioData.stockQuotes || {}).length * 50;
      return baseTokens + openLegsTokens + closedLegsTokens + stockTokens + quotesTokens;
    } else if (compressionLevel === 'basic') {
      return baseTokens + 2000; // ~10 positions * 200 tokens
    } else if (compressionLevel === 'aggressive') {
      return baseTokens + 1000; // ~5 positions * 200 tokens
    } else if (compressionLevel === 'minimal') {
      return baseTokens + 500; // ~2-3 positions * 200 tokens
    }
    
    return baseTokens + 1000; // Default estimate
  }

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm flex-1 min-h-0 flex flex-col w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center space-x-2">
          <Bot className="h-5 w-5 text-primary" />
          <CardTitle className="text-foreground">AI Investment Analyst</CardTitle>
        </div>
        <div className="flex items-center space-x-2">
          {totalTokensUsed > 0 && (
            <div 
              className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded cursor-help"
              title={`Total tokens used in this session: ${totalTokensUsed.toLocaleString()}\nActual cost: $${totalCost.toFixed(4)}`}
            >
              {totalTokensUsed.toLocaleString()} tokens • ${totalCost.toFixed(4)}
            </div>
          )}
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
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-foreground">Portfolio Summary</div>
            {config.compressionLevel && config.compressionLevel !== 'none' && (
              <div className="flex items-center space-x-2">
                <div className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                  Compression: {config.compressionLevel}
                </div>
                <div className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                  ~${estimateCost(estimateTokenUsage(portfolioData, 'none') - estimateTokenUsage(portfolioData, config.compressionLevel), config.model, config.webSearchEnabled)} saved
                </div>
              </div>
            )}
          </div>
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
                        
                        {/* Sources Section */}
                        {message.sources && message.sources.length > 0 && (
                          <div className="mt-4 pt-3 border-t border-border/30">
                            <div className="flex items-center gap-2 mb-2">
                              <Globe className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs font-medium text-muted-foreground">Sources</span>
                            </div>
                            <div className="space-y-2">
                              {message.sources.map((source, index) => (
                                <div key={index} className="text-xs">
                                  <a
                                    href={source.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline font-medium block mb-1"
                                  >
                                    {source.title}
                                  </a>
                                  {source.snippet ? (
                                    <p className="text-muted-foreground leading-relaxed">
                                      {source.snippet}
                                    </p>
                                  ) : (
                                    <p className="text-muted-foreground leading-relaxed">
                                      Cited in response (characters {source.start_index}-{source.end_index})
                                    </p>
                                  )}
                                  {source.published_date && (
                                    <span className="text-muted-foreground text-xs">
                                      {new Date(source.published_date).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
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
          <div className="flex-1 relative">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about your portfolio, risk analysis, or strategies..."
              disabled={isLoading || loading}
              className="flex-1"
            />
            {config.compressionLevel && config.compressionLevel !== 'none' && (
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-muted-foreground">
                ~{estimateTokenUsage(portfolioData, config.compressionLevel)} tokens • ~${estimateCost(estimateTokenUsage(portfolioData, config.compressionLevel), config.model, config.webSearchEnabled)}
              </div>
            )}
          </div>
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

        {/* Token Usage Summary */}
        {totalTokensUsed > 0 && (
          <div className="bg-muted/30 rounded-lg p-3">
            <Label className="text-sm font-medium">Current Session Usage</Label>
            <div className="text-xs text-muted-foreground mt-1 space-y-1">
              <div>Total tokens used: {totalTokensUsed.toLocaleString()}</div>
              <div>Actual cost: ${totalCost.toFixed(4)}</div>
              {config.webSearchEnabled && (
                <div className="text-xs text-blue-600">
                  Web search enabled: +${estimateCost(0, config.model, true)} per call
                </div>
              )}
              {/* <div className="text-xs text-orange-600">
                {config.webSearchEnabled 
                  ? `Web search: $${OPENAI_PRICING[config.model as keyof typeof OPENAI_PRICING]?.webSearchCost || 25}/1K calls`
                  : `GPT-4o: ~$0.0025/1K input tokens, GPT-4o-mini: ~$0.00015/1K input tokens`
                }
              </div> */}
            </div>
          </div>
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
              <Label htmlFor="compressionLevel">Data Compression Level</Label>
              <select
                id="compressionLevel"
                value={config.compressionLevel || 'none'}
                onChange={(e) => setConfig(prev => ({ ...prev, compressionLevel: e.target.value as any }))}
                className="w-full p-2 border rounded-md"
              >
                <option value="none">None - Full data (highest token usage)</option>
                <option value="basic">Basic - Top 10 positions (moderate compression)</option>
                <option value="aggressive">Aggressive - Top 5 positions (high compression)</option>
                <option value="minimal">Minimal - Top 2-3 positions (maximum compression)</option>
              </select>
              <div className="text-xs text-muted-foreground mt-1">
                Higher compression reduces API costs but may limit analysis detail
              </div>
              <div className="text-xs text-blue-600 mt-1">
                Estimated tokens: {estimateTokenUsage(portfolioData, config.compressionLevel || 'none')}
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