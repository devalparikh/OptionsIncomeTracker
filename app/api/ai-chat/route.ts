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
    if (config.budgetMode) {
      // Top 3 open by value
      const topOpen = (portfolioData.openLegs || [])
        .slice()
        .sort((a: any, b: any) => (b.open_price * b.contracts) - (a.open_price * a.contracts))
        .slice(0, 3);
      // Top 3 closed by realized P/L
      const topClosed = (portfolioData.closedLegs || [])
        .slice()
        .sort((a: any, b: any) => (b.realized_pnl || 0) - (a.realized_pnl || 0))
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
        '\n\n[Budget Mode: Only summary and top positions are included to optimize token usage.]'
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