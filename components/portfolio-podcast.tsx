"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { 
  Loader2, 
  Play, 
  Pause, 
  Download, 
  Settings, 
  AlertCircle, 
  Mic, 
  Headphones,
  RefreshCw,
  Volume2,
  Globe
} from "lucide-react"
import { AIChatConfig, DEFAULT_CONFIG, AVAILABLE_MODELS, TEMPERATURE_PRESETS, SYSTEM_PROMPT_VARIANTS } from "@/lib/ai-chat-config"

interface PortfolioData {
  openLegs: any[]
  closedLegs: any[]
  stockPositions: any[]
  portfolioMetrics: any
  coveredCallPositions: any[]
  stockQuotes: Map<string, any>
}

interface PortfolioPodcastProps {
  portfolioData: PortfolioData
  loading?: boolean
}

interface PodcastEpisode {
  id: string
  title: string
  content: string
  audioUrl?: string
  timestamp: Date
  duration?: number
  tokenUsage?: number
  estimatedCost?: string
}

const PODCAST_SYSTEM_PROMPT = `You are a professional financial news podcast host specializing in portfolio analysis and market commentary. Your task is to create engaging podcast content about the user's investment portfolio.

PORTFOLIO CONTEXT:
You have access to the user's portfolio data including:
- Stock positions and their performance
- Options positions (puts and calls)
- Portfolio metrics and P&L
- Current market quotes

PODCAST REQUIREMENTS:
1. Create a 3-5 minute podcast script (approximately 450-750 words)
2. Focus on the companies the user owns shares in
3. IMPORTANT: Use web search to find and include the LATEST news and market developments for those companies
4. Provide portfolio performance commentary
5. Use a conversational, engaging tone suitable for audio
6. Structure as a news-style podcast with clear sections
7. Include specific data points from the portfolio
8. Make it informative but accessible to retail investors

FORMAT:
- Start with a brief introduction
- Cover major holdings and their recent news (use web search for current events)
- Discuss portfolio performance
- End with a brief market outlook
- Use natural speech patterns and transitions

TONE:
- Professional but conversational
- Engaging and informative
- Avoid overly technical jargon
- Include some personality and enthusiasm
- Make it sound natural when spoken aloud

NEWS REQUIREMENTS:
- Always search for and include the most recent news about companies in the portfolio
- Focus on earnings reports, product launches, market moves, analyst ratings, and other significant developments
- Cite specific news sources and dates when possible
- Prioritize news that could impact stock prices or portfolio performance

IMPORTANT: This content will be converted to speech, so write it to be spoken, not read. Use natural speech patterns, clear transitions, and avoid complex sentence structures that might be difficult to pronounce.`

const AVAILABLE_VOICES = [
  { value: "alloy", label: "Alloy" },
  { value: "echo", label: "Echo" },
  { value: "fable", label: "Fable" },
  { value: "onyx", label: "Onyx" },
  { value: "nova", label: "Nova" },
  { value: "shimmer", label: "Shimmer" }
]

export function PortfolioPodcast({ portfolioData, loading }: PortfolioPodcastProps) {
  const [episodes, setEpisodes] = useState<PodcastEpisode[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [isConvertingToSpeech, setIsConvertingToSpeech] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [configError, setConfigError] = useState<string | null>(null)
  const [config, setConfig] = useState<AIChatConfig>({
    ...DEFAULT_CONFIG,
    systemPrompt: PODCAST_SYSTEM_PROMPT,
    maxTokens: 1500,
    model: "gpt-4o",
    webSearchEnabled: true
  })
  const [voice, setVoice] = useState("alloy")
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [totalTokensUsed, setTotalTokensUsed] = useState(0)
  const [totalCost, setTotalCost] = useState(0)
  const [expandedEpisodes, setExpandedEpisodes] = useState<Set<string>>(new Set())
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  // Load config from localStorage on mount
  useEffect(() => {
    const savedConfig = localStorage.getItem("portfolio-podcast-config")
    if (savedConfig) {
      try {
        const parsedConfig = JSON.parse(savedConfig)
        setConfig(parsedConfig)
        console.log("Loaded saved podcast config:", { ...parsedConfig, apiKey: parsedConfig.apiKey ? parsedConfig.apiKey.substring(0, 10) + "..." : "" })
      } catch (error) {
        console.error("Error loading podcast config:", error)
      }
    } else {
      console.log("No saved podcast config found, using defaults")
    }
    
    const savedVoice = localStorage.getItem("portfolio-podcast-voice")
    if (savedVoice) {
      setVoice(savedVoice)
    }
    
    // Load saved token usage
    const savedTokenUsage = localStorage.getItem("portfolio-podcast-token-usage")
    if (savedTokenUsage) {
      try {
        const parsedTokenUsage = parseInt(savedTokenUsage, 10)
        setTotalTokensUsed(parsedTokenUsage)
      } catch (error) {
        console.error("Error loading podcast token usage:", error)
      }
    }
    
    // Load saved cost
    const savedCost = localStorage.getItem("portfolio-podcast-total-cost")
    if (savedCost) {
      try {
        const parsedCost = parseFloat(savedCost)
        setTotalCost(parsedCost)
      } catch (error) {
        console.error("Error loading podcast cost:", error)
      }
    }
  }, [])

  // Save config to localStorage when it changes
  useEffect(() => {
    // Only save if we have a config with at least some non-default values
    if (config.apiKey || config.systemPrompt !== PODCAST_SYSTEM_PROMPT || 
        config.model !== "gpt-4o" || config.temperature !== DEFAULT_CONFIG.temperature ||
        config.maxTokens !== 1500 || config.webSearchEnabled !== true) {
      console.log("Saving podcast config to localStorage:", { ...config, apiKey: config.apiKey ? config.apiKey.substring(0, 10) + "..." : "" })
      localStorage.setItem("portfolio-podcast-config", JSON.stringify(config))
    }
  }, [config])

  // Save voice to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("portfolio-podcast-voice", voice)
  }, [voice])

  const generatePodcastContent = async () => {
    if (!config.apiKey) {
      setConfigError("Please configure your OpenAI API key in settings")
      setShowConfig(true)
      return
    }

    setIsGenerating(true)
    setConfigError(null)

    try {
      // Create a programmatic prompt for the podcast with emphasis on current news
      const podcastPrompt = "Generate a podcast script about my portfolio holdings. Use web search to find the LATEST news and developments about the companies I own shares in. Include recent earnings reports, product launches, market moves, analyst ratings, and other significant developments. Make it engaging and suitable for a 3-5 minute podcast episode with current, relevant information."

      const response = await fetch("/api/ai-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [{
            id: Date.now().toString(),
            role: "user",
            content: podcastPrompt,
            timestamp: new Date()
          }],
          portfolioData,
          config: {
            ...config,
            systemPrompt: PODCAST_SYSTEM_PROMPT,
            webSearchEnabled: true,
            model: config.model
          }
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      // Update token usage if provided in response
      if (data.tokenUsage) {
        const newTotal = totalTokensUsed + data.tokenUsage
        const newCost = totalCost + parseFloat(data.estimatedCost || '0')
        setTotalTokensUsed(newTotal)
        setTotalCost(newCost)
        localStorage.setItem("portfolio-podcast-token-usage", newTotal.toString())
        localStorage.setItem("portfolio-podcast-total-cost", newCost.toString())
      }

      const newEpisode: PodcastEpisode = {
        id: Date.now().toString(),
        title: `Portfolio Update - ${new Date().toLocaleDateString()}`,
        content: data.content,
        timestamp: new Date(),
        tokenUsage: data.tokenUsage,
        estimatedCost: data.estimatedCost
      }

      setEpisodes(prev => [newEpisode, ...prev])
    } catch (error) {
      console.error("Error generating podcast content:", error)
      setConfigError(error instanceof Error ? error.message : "Failed to generate podcast content")
    } finally {
      setIsGenerating(false)
    }
  }

  const convertToSpeech = async (episode: PodcastEpisode) => {
    if (!config.apiKey) {
      setConfigError("Please configure your OpenAI API key in settings")
      setShowConfig(true)
      return
    }

    setIsConvertingToSpeech(true)
    setConfigError(null)

    try {
      const response = await fetch("/api/portfolio-podcast/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: episode.content,
          voice: voice,
          apiKey: config.apiKey
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
      }

      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)

      // Update episode with audio URL
      setEpisodes(prev => prev.map(ep => 
        ep.id === episode.id 
          ? { ...ep, audioUrl, duration: Math.ceil(audioBlob.size / 16000) } // Rough estimate: 16KB per second
          : ep
      ))
    } catch (error) {
      console.error("Error converting to speech:", error)
      setConfigError(error instanceof Error ? error.message : "Failed to convert to speech")
    } finally {
      setIsConvertingToSpeech(false)
    }
  }

  const playAudio = (audioUrl: string) => {
    if (currentAudio) {
      currentAudio.pause()
      currentAudio.currentTime = 0
    }

    const audio = new Audio(audioUrl)
    
    // Add event listeners for time tracking
    audio.addEventListener('loadedmetadata', () => {
      setDuration(audio.duration)
    })
    
    audio.addEventListener('timeupdate', () => {
      setCurrentTime(audio.currentTime)
    })
    
    audio.addEventListener('ended', () => {
      setIsPlaying(false)
      setCurrentTime(0)
    })
    
    audio.addEventListener('pause', () => {
      setIsPlaying(false)
    })
    
    audio.addEventListener('play', () => {
      setIsPlaying(true)
    })
    
    audio.play()
    setCurrentAudio(audio)
    setIsPlaying(true)
  }

  const pauseAudio = () => {
    if (currentAudio) {
      currentAudio.pause()
      setIsPlaying(false)
    }
  }

  const handleScrubberChange = (newTime: number) => {
    if (currentAudio) {
      currentAudio.currentTime = newTime
      setCurrentTime(newTime)
    }
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const toggleEpisodeExpansion = (episodeId: string) => {
    setExpandedEpisodes(prev => {
      const newSet = new Set(prev)
      if (newSet.has(episodeId)) {
        newSet.delete(episodeId)
      } else {
        newSet.add(episodeId)
      }
      return newSet
    })
  }

  const downloadAudio = (audioUrl: string, title: string) => {
    const link = document.createElement('a')
    link.href = audioUrl
    link.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp3`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const clearEpisodes = () => {
    setEpisodes([])
    setTotalTokensUsed(0)
    setTotalCost(0)
    localStorage.removeItem("portfolio-podcast-token-usage")
    localStorage.removeItem("portfolio-podcast-total-cost")
  }

  const clearSettings = () => {
    setConfig({
      ...DEFAULT_CONFIG,
      systemPrompt: PODCAST_SYSTEM_PROMPT,
      maxTokens: 1500,
      model: "gpt-4o",
      webSearchEnabled: true
    })
    setVoice("alloy")
    localStorage.removeItem("portfolio-podcast-config")
    localStorage.removeItem("portfolio-podcast-voice")
  }

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm flex-1 min-h-0 flex flex-col w-full">
      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: hsl(var(--primary));
          cursor: pointer;
          border: 2px solid hsl(var(--background));
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        
        .slider::-moz-range-thumb {
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: hsl(var(--primary));
          cursor: pointer;
          border: 2px solid hsl(var(--background));
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        
        .slider:focus {
          outline: none;
        }
      `}</style>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center space-x-2">
          <Headphones className="h-5 w-5 text-primary" />
          <CardTitle className="text-foreground">Portfolio Podcast</CardTitle>
        </div>
        <div className="flex items-center space-x-2">
          {totalTokensUsed > 0 && (
            <div 
              className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded cursor-help"
              title={`Total tokens used: ${totalTokensUsed.toLocaleString()}\nActual cost: $${totalCost.toFixed(4)}`}
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
            onClick={clearEpisodes}
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

        {/* Generate Button */}
        <div className="flex justify-center">
          <Button
            onClick={generatePodcastContent}
            disabled={isGenerating || loading}
            size="lg"
            className="px-8"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating Podcast...
              </>
            ) : (
              <>
                <Mic className="h-4 w-4 mr-2" />
                Generate Portfolio Podcast
              </>
            )}
          </Button>
        </div>

        {/* Web Search Indicator */}
        <div className="flex justify-center">
          <div className="flex items-center space-x-2 text-sm text-blue-600 bg-blue-50 px-3 py-2 rounded-lg">
            <Globe className="h-4 w-4" />
            <span>Web search enabled - fetching latest news about your holdings</span>
          </div>
        </div>

        {/* Episodes */}
        <div className="flex-1 min-h-0 flex flex-col">
          <ScrollArea className="flex-1 min-h-0 overflow-y-auto border rounded-lg p-4 bg-background/50">
            {episodes.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <Headphones className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">Generate a podcast episode about your portfolio holdings.</p>
                <p className="text-xs mt-2">I'll create engaging content about your investments and convert it to speech.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {episodes.map((episode) => (
                  <div
                    key={episode.id}
                    className="bg-muted/30 rounded-lg p-4 border border-border/50 animate-in fade-in-0 slide-in-from-bottom-2 duration-300"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-medium text-foreground">{episode.title}</h3>
                        <p className="text-xs text-muted-foreground">
                          {episode.timestamp.toLocaleString()}
                          {episode.tokenUsage && (
                            <span className="ml-2">
                              • {episode.tokenUsage.toLocaleString()} tokens • ${episode.estimatedCost}
                            </span>
                          )}
                          {episode.duration && (
                            <span className="ml-2">
                              • ~{Math.round(episode.duration / 60)} min
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        {episode.audioUrl ? (
                          <>
                            <Button
                              variant="default"
                              size="lg"
                              onClick={() => isPlaying ? pauseAudio() : playAudio(episode.audioUrl!)}
                              className="px-6"
                            >
                              {isPlaying ? (
                                <>
                                  <Pause className="h-5 w-5 mr-2" />
                                  Pause
                                </>
                              ) : (
                                <>
                                  <Play className="h-5 w-5 mr-2" />
                                  Play
                                </>
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => downloadAudio(episode.audioUrl!, episode.title)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="outline"
                            size="lg"
                            onClick={() => convertToSpeech(episode)}
                            disabled={isConvertingToSpeech}
                            className="px-6"
                          >
                            {isConvertingToSpeech ? (
                              <>
                                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                Converting...
                              </>
                            ) : (
                              <>
                                <Volume2 className="h-5 w-5 mr-2" />
                                Convert to Speech
                              </>
                            )}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleEpisodeExpansion(episode.id)}
                        >
                          {expandedEpisodes.has(episode.id) ? "Hide Text" : "Show Text"}
                        </Button>
                      </div>
                    </div>

                    {/* Audio Player with Scrubber */}
                    {episode.audioUrl && (
                      <div className="mb-4 p-3 bg-background/50 rounded-lg border">
                        <div className="flex items-center space-x-3 mb-2">
                          <div className="text-xs text-muted-foreground min-w-[40px]">
                            {formatTime(currentTime)}
                          </div>
                          <div className="flex-1">
                            <input
                              type="range"
                              min="0"
                              max={duration || 0}
                              value={currentTime}
                              onChange={(e) => handleScrubberChange(parseFloat(e.target.value))}
                              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer slider"
                              style={{
                                background: `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${(currentTime / (duration || 1)) * 100}%, hsl(var(--muted)) ${(currentTime / (duration || 1)) * 100}%, hsl(var(--muted)) 100%)`
                              }}
                            />
                          </div>
                          <div className="text-xs text-muted-foreground min-w-[40px]">
                            {formatTime(duration)}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Collapsible Content */}
                    {expandedEpisodes.has(episode.id) && (
                      <div className="prose prose-sm max-w-none text-foreground border-t pt-4">
                        <div className="whitespace-pre-wrap text-sm leading-relaxed">
                          {episode.content}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
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
            </div>
          </div>
        )}
      </CardContent>

      {/* Configuration Dialog */}
      <Dialog open={showConfig} onOpenChange={setShowConfig}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Podcast Configuration</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
              Settings are automatically saved to your browser. Your API key and preferences will be remembered.
            </div>
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
              <div className="text-xs text-muted-foreground mt-1">
                Web search models (GPT-4o, GPT-4.1) are recommended for current news
              </div>
            </div>
            <div>
              <Label htmlFor="voice">TTS Voice</Label>
              <select
                id="voice"
                value={voice}
                onChange={(e) => setVoice(e.target.value)}
                className="w-full p-2 border rounded-md"
              >
                {AVAILABLE_VOICES.map(voiceOption => (
                  <option key={voiceOption.value} value={voiceOption.value}>
                    {voiceOption.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={config.webSearchEnabled}
                  onChange={(e) => setConfig(prev => ({ ...prev, webSearchEnabled: e.target.checked }))}
                  className="rounded"
                />
                <span>Enable Web Search</span>
              </Label>
              <div className="text-xs text-muted-foreground mt-1">
                Required for fetching current news about your portfolio holdings
              </div>
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
                min="500"
                max="3000"
                value={config.maxTokens}
                onChange={(e) => setConfig(prev => ({ ...prev, maxTokens: parseInt(e.target.value) }))}
              />
            </div>
            <div>
              <Label htmlFor="systemPrompt">System Prompt</Label>
              <Textarea
                id="systemPrompt"
                value={config.systemPrompt}
                onChange={(e) => setConfig(prev => ({ ...prev, systemPrompt: e.target.value }))}
                rows={8}
                placeholder="Customize the podcast generation behavior..."
              />
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setConfig({ 
                  ...DEFAULT_CONFIG, 
                  systemPrompt: PODCAST_SYSTEM_PROMPT, 
                  maxTokens: 1500,
                  model: "gpt-4o",
                  webSearchEnabled: true
                })}
              >
                Reset to Default
              </Button>
              <Button
                variant="outline"
                onClick={clearSettings}
              >
                Clear All Settings
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