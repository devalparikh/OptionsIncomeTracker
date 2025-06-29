import { NextRequest, NextResponse } from "next/server"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

interface ChatConfig {
  apiKey: string
  systemPrompt: string
  model: string
  temperature: number
  maxTokens: number
  budgetMode: boolean
}

interface PortfolioData {
  openLegs: any[]
  closedLegs: any[]
  stockPositions: any[]
  portfolioMetrics: any
  coveredCallPositions: any[]
  stockQuotes: Map<string, any>
}

interface RequestBody {
  messages: Message[]
  portfolioData: PortfolioData
  config: ChatConfig
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json()
    const { messages, portfolioData, config } = body

    if (!config.apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key is required" },
        { status: 400 }
      )
    }

    console.log("Processing AI chat request with:", {
      messageCount: messages.length,
      openLegsCount: portfolioData.openLegs?.length || 0,
      closedLegsCount: portfolioData.closedLegs?.length || 0,
      stockPositionsCount: portfolioData.stockPositions?.length || 0,
      stockQuotesType: typeof portfolioData.stockQuotes,
      stockQuotesIsMap: portfolioData.stockQuotes instanceof Map
    })

    // Budget mode: compress context
    let portfolioContext = {};
    let systemPrompt = config.systemPrompt;
    if (config.budgetMode) {
      // Top 3 open by value
      const topOpen = (portfolioData.openLegs || [])
        .slice()
        .sort((a, b) => (b.open_price * b.contracts) - (a.open_price * a.contracts))
        .slice(0, 3);
      // Top 3 closed by realized P/L
      const topClosed = (portfolioData.closedLegs || [])
        .slice()
        .sort((a, b) => (b.realized_pnl || 0) - (a.realized_pnl || 0))
        .slice(0, 3);
      portfolioContext = {
        summary: {
          totalOpen: portfolioData.openLegs?.length || 0,
          totalClosed: portfolioData.closedLegs?.length || 0,
          totalStocks: portfolioData.stockPositions?.length || 0,
          metrics: portfolioData.portfolioMetrics || {},
        },
        topOpenPositions: topOpen,
        topClosedPositions: topClosed,
      };
      systemPrompt =
        config.systemPrompt +
        '\n\n[Budget Mode: Only summary and top positions are included to optimize token usage.]';
    } else {
      portfolioContext = {
        openLegs: portfolioData.openLegs || [],
        closedLegs: portfolioData.closedLegs || [],
        stockPositions: portfolioData.stockPositions || [],
        coveredCallPositions: portfolioData.coveredCallPositions || [],
        stockQuotes: portfolioData.stockQuotes instanceof Map ? Object.fromEntries(portfolioData.stockQuotes) : (portfolioData.stockQuotes || {}),
        portfolioMetrics: portfolioData.portfolioMetrics || {}
      };
      systemPrompt = config.systemPrompt;
    }

    // Prepare messages for OpenAI API
    const openAIMessages = [
      {
        role: "system" as const,
        content: `${systemPrompt}\n\nPORTFOLIO DATA:\n${JSON.stringify(portfolioContext, null, 2)}\n\nUse this portfolio data to provide specific, relevant advice. Always reference actual positions and metrics when possible.`
      },
      ...messages.map(msg => ({
        role: msg.role as "user" | "assistant",
        content: msg.content
      }))
    ]

    // Call OpenAI API
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        messages: openAIMessages,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        stream: false
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error("OpenAI API error:", errorData)
      return NextResponse.json(
        { error: `OpenAI API error: ${errorData.error?.message || response.statusText}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      return NextResponse.json(
        { error: "No response content from OpenAI" },
        { status: 500 }
      )
    }

    return NextResponse.json({ content })

  } catch (error) {
    console.error("AI chat error:", error)
    
    // Provide more specific error messages
    let errorMessage = "Internal server error"
    if (error instanceof Error) {
      errorMessage = error.message
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
} 