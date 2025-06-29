import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

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
  webSearchEnabled: boolean
  compressionLevel: string
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
  webSearchResults?: any[]
}

// Enhanced portfolio data compression function
function compressPortfolioData(portfolioData: PortfolioData, level: string): Record<string, any> {
  const { openLegs, closedLegs, stockPositions, portfolioMetrics, stockQuotes } = portfolioData;
  
  // Determine limits based on compression level
  const limits = {
    basic: { openPositions: 10, closedPositions: 10, stockPositions: 5 },
    aggressive: { openPositions: 5, closedPositions: 5, stockPositions: 3 },
    minimal: { openPositions: 3, closedPositions: 3, stockPositions: 2 }
  };
  
  const currentLimits = limits[level as keyof typeof limits] || limits.basic;
  
  // Compress stock quotes to essential data only
  const compressedQuotes: Record<string, any> = {};
  if (stockQuotes instanceof Map) {
    for (const [symbol, quote] of stockQuotes) {
      compressedQuotes[symbol] = {
        price: (quote as any).price,
        change: (quote as any).change,
        changePercent: (quote as any).changePercent
      };
    }
  } else if (typeof stockQuotes === 'object') {
    for (const [symbol, quote] of Object.entries(stockQuotes)) {
      compressedQuotes[symbol] = {
        price: (quote as any).price,
        change: (quote as any).change,
        changePercent: (quote as any).changePercent
      };
    }
  }

  // Compress open legs - keep only essential fields and top positions
  const compressedOpenLegs = (openLegs || [])
    .map(leg => ({
      symbol: leg.symbol,
      type: leg.type,
      side: leg.side,
      strike: leg.strike,
      expiry: leg.expiry,
      contracts: leg.contracts,
      open_price: leg.open_price,
      unrealized_pnl: leg.unrealized_pnl,
      days_to_expiry: Math.max(0, Math.ceil((new Date(leg.expiry).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))
    }))
    .sort((a, b) => Math.abs(b.unrealized_pnl || 0) - Math.abs(a.unrealized_pnl || 0))
    .slice(0, currentLimits.openPositions);

  // Compress closed legs - aggregate by symbol and keep top performers
  const closedBySymbol = new Map<string, any>();
  (closedLegs || []).forEach(leg => {
    const key = leg.symbol;
    if (!closedBySymbol.has(key)) {
      closedBySymbol.set(key, {
        symbol: leg.symbol,
        total_realized_pnl: 0,
        total_premium_collected: 0,
        trade_count: 0,
        avg_days_held: 0,
        total_days: 0
      });
    }
    const entry = closedBySymbol.get(key);
    entry.total_realized_pnl += leg.realized_pnl || 0;
    entry.total_premium_collected += (leg.open_price * leg.contracts * 100) || 0;
    entry.trade_count += 1;
    
    const daysHeld = leg.closeDate ? 
      Math.ceil((new Date(leg.closeDate).getTime() - new Date(leg.openDate).getTime()) / (1000 * 60 * 60 * 24)) : 0;
    entry.total_days += daysHeld;
  });

  // Calculate averages and sort by performance
  const compressedClosedLegs = Array.from(closedBySymbol.values())
    .map(entry => ({
      ...entry,
      avg_days_held: entry.trade_count > 0 ? Math.round(entry.total_days / entry.trade_count) : 0
    }))
    .sort((a, b) => b.total_realized_pnl - a.total_realized_pnl)
    .slice(0, currentLimits.closedPositions);

  // Compress stock positions - keep essential data only
  const compressedStockPositions = (stockPositions || [])
    .map(stock => ({
      symbol: stock.symbol,
      quantity: stock.quantity,
      cost_basis: stock.cost_basis,
      current_price: stock.current_price,
      unrealized_pl: stock.unrealized_pl,
      unrealized_pl_percent: stock.unrealized_pl_percent
    }))
    .sort((a, b) => Math.abs(b.unrealized_pl || 0) - Math.abs(a.unrealized_pl || 0))
    .slice(0, currentLimits.stockPositions);

  // Compress portfolio metrics - keep only essential metrics
  const compressedMetrics = {
    netPL: portfolioMetrics?.netPL,
    totalPremiumCollected: portfolioMetrics?.totalPremiumCollected,
    totalCapitalAtRisk: portfolioMetrics?.totalCapitalAtRisk,
    totalSharesAtRisk: portfolioMetrics?.totalSharesAtRisk,
    totalSharesAtRiskValue: portfolioMetrics?.totalSharesAtRiskValue,
    projectedMonthlyIncome: portfolioMetrics?.projectedMonthlyIncome,
    historicalAverageMonthlyIncome: portfolioMetrics?.historicalAverageMonthlyIncome,
    totalOpenPositions: openLegs?.length || 0,
    totalClosedPositions: closedLegs?.length || 0,
    totalStockPositions: stockPositions?.length || 0
  };

  // Create summary statistics
  const summary = {
    totalOpenValue: compressedOpenLegs.reduce((sum, leg) => sum + (leg.open_price * leg.contracts * 100), 0),
    totalUnrealizedPL: compressedOpenLegs.reduce((sum, leg) => sum + (leg.unrealized_pnl || 0), 0),
    totalRealizedPL: compressedClosedLegs.reduce((sum, leg) => sum + leg.total_realized_pnl, 0),
    totalStockValue: compressedStockPositions.reduce((sum, stock) => sum + (stock.quantity * stock.current_price), 0),
    totalStockPL: compressedStockPositions.reduce((sum, stock) => sum + (stock.unrealized_pl || 0), 0),
    avgDaysToExpiry: compressedOpenLegs.length > 0 ? 
      Math.round(compressedOpenLegs.reduce((sum, leg) => sum + leg.days_to_expiry, 0) / compressedOpenLegs.length) : 0
  };

  // For minimal compression, only include the most essential data
  if (level === 'minimal') {
    return {
      summary: {
        netPL: portfolioMetrics?.netPL,
        totalPremiumCollected: portfolioMetrics?.totalPremiumCollected,
        totalCapitalAtRisk: portfolioMetrics?.totalCapitalAtRisk,
        totalOpenPositions: openLegs?.length || 0,
        totalClosedPositions: closedLegs?.length || 0
      },
      topOpenPositions: compressedOpenLegs.slice(0, 2),
      topClosedPositions: compressedClosedLegs.slice(0, 2),
      topStockPositions: compressedStockPositions.slice(0, 1)
    };
  }

  return {
    summary,
    metrics: compressedMetrics,
    topOpenPositions: compressedOpenLegs,
    topClosedPositions: compressedClosedLegs,
    topStockPositions: compressedStockPositions,
    quotes: compressedQuotes
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { messages, portfolioData, config, webSearchResults } = body

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
    let portfolioContext: Record<string, any> = {};
    let systemPrompt = config.systemPrompt;
    if (config.compressionLevel && config.compressionLevel !== 'none') {
      // Enhanced compression strategy based on level
      const compressedData = compressPortfolioData(portfolioData, config.compressionLevel);
      portfolioContext = compressedData;
      systemPrompt =
        config.systemPrompt +
        `\n\n[Compression Level: ${config.compressionLevel} - Data has been compressed to optimize token usage while preserving key metrics and top positions.]`
    } else {
      portfolioContext = {
        openLegs: portfolioData.openLegs || [],
        closedLegs: portfolioData.closedLegs || [],
        stockPositions: portfolioData.stockPositions || [],
        coveredCallPositions: portfolioData.coveredCallPositions || [],
        stockQuotes: portfolioData.stockQuotes instanceof Map ? Object.fromEntries(portfolioData.stockQuotes) : (portfolioData.stockQuotes || {}),
        portfolioMetrics: portfolioData.portfolioMetrics || {}
      };
      systemPrompt =
        config.systemPrompt +
        (webSearchResults && webSearchResults.length > 0 ? '\n\n[Web search results are included below.]' : '');
    }

    // Prepare messages for OpenAI API
    const openAIMessages = [
      {
        role: "system" as const,
        content: `${systemPrompt}\n\nPORTFOLIO DATA:\n${JSON.stringify(portfolioContext, null, 2)}\n\nUse this portfolio data to provide specific, relevant advice. Always reference actual positions and metrics when possible.`
      },
      ...messages.map((msg: any) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content
      }))
    ]

    // If web search is enabled and the model supports it, use OpenAI tools
    const WEB_SEARCH_MODELS = ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini"];
    let openaiResponse
    if (config.webSearchEnabled && WEB_SEARCH_MODELS.includes(config.model)) {
      const client = new OpenAI({ apiKey: config.apiKey })
      const contextInput = `${systemPrompt}\n\nPORTFOLIO DATA:\n${JSON.stringify(portfolioContext, null, 2)}\n\nUse this portfolio data to provide specific, relevant advice. Always reference actual positions and metrics when possible.\n\n${messages[messages.length - 1]?.content || ""}`
      openaiResponse = await client.responses.create({
        model: config.model,
        input: contextInput,
        tools: [
          {
            type: "web_search_preview",
            user_location: { type: "approximate" },
            search_context_size: "medium"
          }
        ],
        text: { format: { type: "text" } },
        reasoning: {},
        temperature: config.temperature,
        max_output_tokens: config.maxTokens,
        top_p: 1,
        store: false
      })
    } else {
      // ...existing OpenAI call logic...
      openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
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
      if (!openaiResponse.ok) {
        const errorData = await openaiResponse.json()
        console.error("OpenAI API error:", errorData)
        return NextResponse.json(
          { error: `OpenAI API error: ${errorData.error?.message || openaiResponse.statusText}` },
          { status: openaiResponse.status }
        )
      }
      openaiResponse = await openaiResponse.json()
    }

    // Parse the response
    let content
    let sources: any[] = []
    
    console.log("Full OpenAI response structure:", JSON.stringify(openaiResponse, null, 2))
    
    if (config.webSearchEnabled && WEB_SEARCH_MODELS.includes(config.model)) {
      // For web search models, extract content and sources from the response structure
      if (openaiResponse.output && Array.isArray(openaiResponse.output)) {
        // Find the message content in the output array
        const messageOutput = openaiResponse.output.find((item: any) => item.type === 'message')
        if (messageOutput && messageOutput.content && Array.isArray(messageOutput.content)) {
          const outputText = messageOutput.content.find((item: any) => item.type === 'output_text')
          if (outputText) {
            content = outputText.text
            
            // Extract sources from annotations
            if (outputText.annotations && Array.isArray(outputText.annotations)) {
              const urlCitations = outputText.annotations.filter((annotation: any) => annotation.type === 'url_citation')
              sources = urlCitations.map((citation: any) => ({
                title: citation.title || 'Untitled',
                url: citation.url || '',
                snippet: '', // OpenAI doesn't provide snippets in annotations
                start_index: citation.start_index,
                end_index: citation.end_index
              }))
            }
          }
        }
      }
      
      // Fallback to output_text if the above structure doesn't work
      if (!content && openaiResponse.output_text) {
        content = openaiResponse.output_text
      }
    } else if (openaiResponse.choices) {
      content = openaiResponse.choices[0]?.message?.content
    } else if (openaiResponse.choices && openaiResponse.choices[0]?.output_text) {
      content = openaiResponse.choices[0].output_text
    }
    
    if (!content) {
      return NextResponse.json(
        { error: "No response content from OpenAI" },
        { status: 500 }
      )
    }
    
    console.log("Extracted content length:", content?.length)
    console.log("Extracted sources:", sources)
    
    return NextResponse.json({ 
      content,
      sources: sources.length > 0 ? sources : undefined
    })

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