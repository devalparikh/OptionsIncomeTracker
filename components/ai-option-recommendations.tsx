"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Loader2, Sparkles, AlertCircle, TrendingUp, TrendingDown, Target, Edit, Lock } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { AIChatConfig, DEFAULT_CONFIG, OpenAIModel } from "@/lib/ai-chat-config"

interface LegWithPosition {
  id: string
  symbol: string
  type: "PUT" | "CALL"
  side: "SELL" | "BUY"
  strike: number
  expiry: Date
  openDate: Date
  closeDate?: Date
  open_price: number
  close_price?: number
  realized_pnl?: number
  contracts: number
  close_type?: "BTC" | "EXPIRED" | "ASSIGNED" | "EXERCISED" | null
}

interface AIRecommendation {
  symbol: string
  type: "PUT" | "CALL"
  strike: number
  expiry: string
  reason: string
  riskLevel: "LOW" | "MEDIUM" | "HIGH"
  expectedPremium: string
}

interface AIOptionRecommendationsProps {
  closedLegs: LegWithPosition[]
  loading?: boolean
}

function buildSystemPrompt(monthlyIncomeTarget: number, riskAppetite: string): string {
  return `You are a professional options trading analyst specializing in providing specific contract recommendations based on trading history and risk preferences.

Your task is to analyze the user's recent closed/expired options contracts and recommend 3-5 new option contracts they should consider.

USER PREFERENCES:
- Monthly Income Target: $${monthlyIncomeTarget.toFixed(2)}
- Risk Appetite: ${riskAppetite}

REQUIREMENTS:
1. Analyze the last 5 closed/expired contracts provided
2. Use web search to find current market conditions, stock prices, and recent news for relevant symbols
3. Recommend specific option contracts (symbol, type, strike, expiry) that align with their monthly income target and risk appetite
4. Provide clear reasoning for each recommendation, explaining how it fits their income goal and risk profile
5. Assess risk level (LOW, MEDIUM, HIGH) based on both the contract characteristics AND the user's indicated risk appetite
6. Estimate expected premium range that contributes toward the monthly income target
7. ${riskAppetite === "CONSERVATIVE" ? "Prioritize lower-risk contracts with stable premiums. Focus on blue-chip stocks, further out-of-the-money strikes, and longer expiration dates." : riskAppetite === "MODERATE" ? "Balance risk and reward. Mix of moderate-risk contracts with some higher-risk opportunities. Focus on quality stocks with reasonable premium potential." : "Prioritize higher premium potential contracts that can achieve the income target. Accept higher risk for higher returns, including closer-to-the-money strikes and shorter expiration dates."}

RESPONSE FORMAT (JSON only, no other text):
{
  "recommendations": [
    {
      "symbol": "AAPL",
      "type": "PUT",
      "strike": 150.00,
      "expiry": "2024-01-19",
      "reason": "Brief explanation of why this contract is recommended based on their history, current market conditions, and how it aligns with their ${monthlyIncomeTarget > 0 ? `$${monthlyIncomeTarget.toFixed(2)} monthly income target and ` : ""}${riskAppetite.toLowerCase()} risk appetite",
      "riskLevel": "MEDIUM",
      "expectedPremium": "$200-300"
    }
  ]
}

IMPORTANT:
- Return ONLY valid JSON, no markdown formatting, no code blocks
- Symbol must be a valid stock ticker
- Type must be either "PUT" or "CALL"
- Strike must be a number with 2 decimal places
- Expiry must be in YYYY-MM-DD format (must be a valid future expiry date)
- RiskLevel must be exactly "LOW", "MEDIUM", or "HIGH"
- ExpectedPremium should be a dollar range like "$200-300" or single value like "$250"
- Base recommendations on their trading patterns, current market conditions, monthly income target, and risk appetite`
}

function buildDefaultUserPrompt(): string {
  return `Based on my trading history, recommend specific option contracts I should consider next.`
}

function formatContractData(contracts: LegWithPosition[]): string {
  return contracts.slice(0, 5).map((contract, index) => {
    const openPremium = contract.open_price * 100 * contract.contracts
    const closeInfo = contract.closeDate 
      ? `Closed: ${contract.closeDate.toLocaleDateString()} at $${contract.close_price?.toFixed(2) || '0.00'}, Type: ${contract.close_type || 'N/A'}, P/L: $${(contract.realized_pnl || 0).toFixed(2)}`
      : `Expired: ${contract.expiry.toLocaleDateString()}, P/L: $${(contract.realized_pnl || 0).toFixed(2)}`
    
    return `Contract ${index + 1}:
- Symbol: ${contract.symbol}
- Type: ${contract.type} ${contract.side}
- Strike: $${contract.strike.toFixed(2)}
- Expiry: ${contract.expiry.toLocaleDateString()}
- Open Date: ${contract.openDate.toLocaleDateString()}
- Open Price: $${contract.open_price.toFixed(2)} (Premium: $${openPremium.toFixed(2)})
- Contracts: ${contract.contracts}
- ${closeInfo}`
  }).join('\n\n')
}

function parseAIResponse(content: string): AIRecommendation[] {
  try {
    const cleaned = content.trim().replace(/^```json\s*|\s*```$/g, '').replace(/^```\s*|\s*```$/g, '')
    const parsed = JSON.parse(cleaned)
    
    if (parsed.recommendations && Array.isArray(parsed.recommendations)) {
      return parsed.recommendations.map((rec: any) => ({
        symbol: rec.symbol || '',
        type: rec.type === 'PUT' || rec.type === 'CALL' ? rec.type : 'PUT',
        strike: parseFloat(rec.strike) || 0,
        expiry: rec.expiry || '',
        reason: rec.reason || '',
        riskLevel: rec.riskLevel === 'LOW' || rec.riskLevel === 'MEDIUM' || rec.riskLevel === 'HIGH' 
          ? rec.riskLevel 
          : 'MEDIUM',
        expectedPremium: rec.expectedPremium || '$0'
      }))
    }
    return []
  } catch (error) {
    console.error('Error parsing AI response:', error)
    return []
  }
}

function getRiskColor(riskLevel: string): string {
  switch (riskLevel) {
    case 'LOW':
      return 'bg-green-100 text-green-800 border-green-200'
    case 'MEDIUM':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    case 'HIGH':
      return 'bg-red-100 text-red-800 border-red-200'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

async function fetchRecommendations(
  contracts: LegWithPosition[], 
  config: AIChatConfig,
  monthlyIncomeTarget: number,
  riskAppetite: string,
  customUserPrompt?: string
): Promise<AIRecommendation[]> {
  const systemPrompt = buildSystemPrompt(monthlyIncomeTarget, riskAppetite)
  
  const userPrompt = customUserPrompt || buildDefaultUserPrompt()

  const response = await fetch("/api/ai-chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: [{
        id: Date.now().toString(),
        role: "user",
        content: userPrompt,
        timestamp: new Date()
      }],
      portfolioData: {
        openLegs: [],
        closedLegs: contracts.slice(0, 5),
        stockPositions: [],
        portfolioMetrics: {},
        coveredCallPositions: [],
        stockQuotes: new Map()
      },
      config: {
        ...config,
        systemPrompt: systemPrompt,
        webSearchEnabled: true,
        model: config.model || OpenAIModel.GPT_4O
      }
    })
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
  }

  const data = await response.json()
  return parseAIResponse(data.content)
}

function calculateHistoricalMonthlyIncome(closedLegs: LegWithPosition[]): number {
  if (closedLegs.length === 0) return 0

  const closedDates = closedLegs
    .map(leg => leg.closeDate || leg.expiry)
    .filter((date): date is Date => date !== undefined)
  
  if (closedDates.length === 0) return 0

  const earliestDate = new Date(Math.min(...closedDates.map(d => d.getTime())))
  const latestDate = new Date(Math.max(...closedDates.map(d => d.getTime())))
  
  const monthsDiff = (latestDate.getFullYear() - earliestDate.getFullYear()) * 12 + 
                    (latestDate.getMonth() - earliestDate.getMonth()) + 1
  
  const totalMonths = Math.max(1, monthsDiff)
  
  const totalRealizedPnL = closedLegs.reduce((sum, leg) => {
    return sum + (leg.realized_pnl || 0)
  }, 0)
  
  return totalRealizedPnL / totalMonths
}

function calculateRiskAppetite(monthlyIncomeTarget: number, baselineIncome: number): string {
  if (baselineIncome === 0) return "MODERATE"
  
  const ratio = monthlyIncomeTarget / baselineIncome
  
  if (ratio <= 0.8) return "CONSERVATIVE"
  if (ratio <= 1.3) return "MODERATE"
  return "AGGRESSIVE"
}

function getRiskColorClass(riskAppetite: string): string {
  switch (riskAppetite) {
    case "CONSERVATIVE":
      return "bg-green-100 text-green-800 border-green-200"
    case "MODERATE":
      return "bg-yellow-100 text-yellow-800 border-yellow-200"
    case "AGGRESSIVE":
      return "bg-red-100 text-red-800 border-red-200"
    default:
      return "bg-gray-100 text-gray-800 border-gray-200"
  }
}

export function AIOptionRecommendations({ closedLegs, loading: parentLoading }: AIOptionRecommendationsProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([])
  const [configError, setConfigError] = useState<string | null>(null)
  const [config, setConfig] = useState<AIChatConfig>({
    ...DEFAULT_CONFIG,
    model: OpenAIModel.GPT_4O,
    webSearchEnabled: true
  })
  
  const baselineMonthlyIncome = useMemo(() => calculateHistoricalMonthlyIncome(closedLegs), [closedLegs])
  const [monthlyIncomeTarget, setMonthlyIncomeTarget] = useState<number>(() => {
    const baseline = calculateHistoricalMonthlyIncome(closedLegs)
    return baseline > 0 ? baseline : 1000
  })
  const [hasInitialized, setHasInitialized] = useState(false)
  const [isPromptEditable, setIsPromptEditable] = useState(false)
  const [customUserPrompt, setCustomUserPrompt] = useState<string>("")
  
  const riskAppetite = useMemo(() => 
    calculateRiskAppetite(monthlyIncomeTarget, baselineMonthlyIncome),
    [monthlyIncomeTarget, baselineMonthlyIncome]
  )

  const recentContracts = closedLegs.slice(0, 5)
  const defaultUserPrompt = buildDefaultUserPrompt()

  useEffect(() => {
    if (!customUserPrompt && defaultUserPrompt) {
      setCustomUserPrompt(defaultUserPrompt)
    }
  }, [defaultUserPrompt])
  
  useEffect(() => {
    if (hasInitialized) return
    
    if (baselineMonthlyIncome > 0) {
      const savedIncomeTarget = localStorage.getItem("ai-recommendations-income-target")
      
      if (savedIncomeTarget) {
        try {
          const parsed = parseFloat(savedIncomeTarget)
          if (!isNaN(parsed) && parsed > 0) {
            setMonthlyIncomeTarget(parsed)
            setHasInitialized(true)
            return
          }
        } catch (error) {
          console.error("Error loading saved income target:", error)
        }
      }
      
      setMonthlyIncomeTarget(baselineMonthlyIncome)
      setHasInitialized(true)
    } else {
      const savedIncomeTarget = localStorage.getItem("ai-recommendations-income-target")
      if (savedIncomeTarget) {
        try {
          const parsed = parseFloat(savedIncomeTarget)
          if (!isNaN(parsed) && parsed > 0) {
            setMonthlyIncomeTarget(parsed)
          }
        } catch (error) {
          console.error("Error loading saved income target:", error)
        }
      }
      setHasInitialized(true)
    }
  }, [baselineMonthlyIncome, hasInitialized])

  useEffect(() => {
    const aiChatConfig = localStorage.getItem("ai-chat-config")
    const podcastConfig = localStorage.getItem("portfolio-podcast-config")
    const recommendationsConfig = localStorage.getItem("ai-recommendations-config")
    
    let loadedConfig = null
    
    if (recommendationsConfig) {
      try {
        loadedConfig = JSON.parse(recommendationsConfig)
      } catch (error) {
        console.error("Error loading recommendations config:", error)
      }
    }
    
    if (!loadedConfig?.apiKey) {
      if (aiChatConfig) {
        try {
          const parsed = JSON.parse(aiChatConfig)
          if (parsed.apiKey) {
            loadedConfig = { ...loadedConfig, apiKey: parsed.apiKey }
          }
        } catch (error) {
          console.error("Error loading AI chat config:", error)
        }
      }
      
      if (!loadedConfig?.apiKey && podcastConfig) {
        try {
          const parsed = JSON.parse(podcastConfig)
          if (parsed.apiKey) {
            loadedConfig = { ...loadedConfig, apiKey: parsed.apiKey }
          }
        } catch (error) {
          console.error("Error loading podcast config:", error)
        }
      }
    }
    
    if (loadedConfig) {
      setConfig(prev => ({ ...prev, ...loadedConfig }))
    }
  }, [])

  useEffect(() => {
    if (config.apiKey || config.systemPrompt !== DEFAULT_CONFIG.systemPrompt || 
        config.model !== OpenAIModel.GPT_4O || config.temperature !== DEFAULT_CONFIG.temperature ||
        config.maxTokens !== DEFAULT_CONFIG.maxTokens || config.webSearchEnabled !== true) {
      localStorage.setItem("ai-recommendations-config", JSON.stringify(config))
    }
  }, [config])
  
  useEffect(() => {
    if (monthlyIncomeTarget > 0) {
      localStorage.setItem("ai-recommendations-income-target", monthlyIncomeTarget.toString())
    }
  }, [monthlyIncomeTarget])

  const hasEnoughContracts = recentContracts.length >= 1

  const handleGenerateRecommendations = async () => {
    if (!config.apiKey) {
      setConfigError("Please configure your OpenAI API key in settings")
      return
    }

    if (!hasEnoughContracts) {
      setConfigError("Need at least 1 closed/expired contract to generate recommendations")
      return
    }

    setIsGenerating(true)
    setConfigError(null)

    try {
      const promptToUse = customUserPrompt || defaultUserPrompt
      const recs = await fetchRecommendations(recentContracts, config, monthlyIncomeTarget, riskAppetite, promptToUse)
      setRecommendations(recs)
    } catch (error) {
      console.error("Error generating recommendations:", error)
      setConfigError(error instanceof Error ? error.message : "Failed to generate recommendations")
    } finally {
      setIsGenerating(false)
    }
  }
  
  const minIncomeTarget = Math.max(100, baselineMonthlyIncome * 0.5)
  const maxIncomeTarget = Math.max(baselineMonthlyIncome * 2, 5000)

  if (parentLoading) {
    return null
  }

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Contract Recommendations
          </CardTitle>
          <Button
            onClick={handleGenerateRecommendations}
            disabled={isGenerating || !hasEnoughContracts}
            size="sm"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Recommendations
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {configError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{configError}</AlertDescription>
          </Alert>
        )}

        {!hasEnoughContracts && !configError && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Need at least 1 closed/expired contract to generate recommendations. Based on: {recentContracts.length} recent contracts.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Monthly Income Target</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">${monthlyIncomeTarget.toFixed(2)}</span>
                {baselineMonthlyIncome > 0 && (
                  <span className="text-xs text-muted-foreground">
                    Baseline: ${baselineMonthlyIncome.toFixed(2)} (historical average)
                  </span>
                )}
              </div>
            </div>
            <Badge variant="outline" className={getRiskColorClass(riskAppetite)}>
              {riskAppetite} Risk
            </Badge>
          </div>
          
          <div className="space-y-2">
            <Slider
              value={[monthlyIncomeTarget]}
              onValueChange={(value) => setMonthlyIncomeTarget(value[0])}
              min={minIncomeTarget}
              max={maxIncomeTarget}
              step={50}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>${minIncomeTarget.toFixed(0)}</span>
              <span>${maxIncomeTarget.toFixed(0)}</span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              {monthlyIncomeTarget > (baselineMonthlyIncome || 0) ? (
                <TrendingUp className="h-4 w-4 text-orange-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-green-600" />
              )}
              <div>
                <div className="text-muted-foreground">vs Baseline</div>
                <div className={`font-medium ${monthlyIncomeTarget > (baselineMonthlyIncome || 0) ? 'text-orange-600' : 'text-green-600'}`}>
                  {baselineMonthlyIncome > 0 
                    ? `${((monthlyIncomeTarget / baselineMonthlyIncome - 1) * 100).toFixed(0)}%`
                    : 'N/A'}
                </div>
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Risk Profile</div>
              <div className="font-medium capitalize">{riskAppetite.toLowerCase()}</div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Custom Prompt</label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (!isPromptEditable && !customUserPrompt && defaultUserPrompt) {
                  setCustomUserPrompt(defaultUserPrompt)
                }
                setIsPromptEditable(!isPromptEditable)
              }}
              className="gap-2"
            >
              {isPromptEditable ? (
                <>
                  <Lock className="h-3 w-3" />
                  Lock Prompt
                </>
              ) : (
                <>
                  <Edit className="h-3 w-3" />
                  Customize Prompt
                </>
              )}
            </Button>
          </div>
          <Textarea
            value={customUserPrompt}
            onChange={(e) => setCustomUserPrompt(e.target.value)}
            disabled={!isPromptEditable}
            placeholder="Enter your custom prompt..."
            className="min-h-[120px] font-mono text-sm"
          />
          {!isPromptEditable && (
            <p className="text-xs text-muted-foreground">
              Click "Customize Prompt" to modify the default prompt
            </p>
          )}
        </div>

        {recommendations.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recommendations.map((rec, index) => (
              <Card key={index} className="border-border/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{rec.symbol}</CardTitle>
                    <Badge 
                      variant="outline" 
                      className={getRiskColor(rec.riskLevel)}
                    >
                      {rec.riskLevel}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Type:</span>
                      <div className="font-medium">{rec.type}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Strike:</span>
                      <div className="font-medium">${rec.strike.toFixed(2)}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Expiry:</span>
                      <div className="font-medium">{rec.expiry}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Premium:</span>
                      <div className="font-medium">{rec.expectedPremium}</div>
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-sm">Reason:</span>
                    <p className="text-sm mt-1">{rec.reason}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {recommendations.length === 0 && !isGenerating && !configError && hasEnoughContracts && (
          <div className="text-center py-8 text-muted-foreground">
            Click "Generate Recommendations" to get AI-powered contract suggestions based on your trading history.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
