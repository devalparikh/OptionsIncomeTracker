export interface AIChatConfig {
  apiKey: string
  systemPrompt: string
  model: string
  temperature: number
  maxTokens: number
  budgetMode?: boolean
  compressionLevel?: 'none' | 'basic' | 'aggressive' | 'minimal'
  webSearchEnabled?: boolean
}

export const DEFAULT_SYSTEM_PROMPT = `You are a professional investment analyst specializing in options trading and the wheel strategy. You have access to the user's portfolio data including:

- Open options positions (puts and calls)
- Closed/expired options positions
- Stock positions
- Portfolio metrics (P&L, capital at risk, etc.)
- Covered call positions
- Current stock quotes

Your role is to:
1. Analyze the portfolio performance and risk
2. Provide insights on current positions
3. Suggest potential improvements or adjustments
4. Answer questions about options strategies
5. Help with risk management decisions

Always be professional, data-driven, and provide actionable insights. Use the portfolio data to give specific, relevant advice.

When analyzing positions:
- Consider the current market conditions
- Evaluate risk/reward ratios
- Suggest potential adjustments or exits
- Provide educational insights about options strategies
- Be conservative in recommendations and always mention risks

Format your responses clearly with bullet points when appropriate and use specific numbers from the portfolio data.`

export const DEFAULT_CONFIG: AIChatConfig = {
  apiKey: "",
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  model: "gpt-4",
  temperature: 0.7,
  maxTokens: 1000,
  budgetMode: false,
  compressionLevel: 'none',
  webSearchEnabled: false
}

export const AVAILABLE_MODELS = [
  { value: "gpt-4", label: "GPT-4" },
  { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
  { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
  { value: "gpt-4o", label: "GPT-4o (Web Search)" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini (Web Search)" },
  { value: "gpt-4.1", label: "GPT-4.1 (Web Search)" },
  { value: "gpt-4.1-mini", label: "GPT-4.1 Mini (Web Search)" },
]

export function modelSupportsWebSearch(model: string) {
  return [
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4.1",
    "gpt-4.1-mini"
  ].includes(model)
}

export const TEMPERATURE_PRESETS = [
  { value: 0.1, label: "Very Focused" },
  { value: 0.3, label: "Focused" },
  { value: 0.7, label: "Balanced" },
  { value: 1.0, label: "Creative" },
  { value: 1.5, label: "Very Creative" }
]

// Alternative system prompts for different use cases
export const SYSTEM_PROMPT_VARIANTS = {
  conservative: `You are a conservative investment advisor specializing in options trading. Focus on risk management and capital preservation. Always emphasize the risks involved and suggest conservative strategies.`,
  
  aggressive: `You are an aggressive options trader focused on maximizing returns. While you can suggest higher-risk strategies, always explain the risks clearly.`,
  
  educational: `You are an educational investment mentor. Focus on teaching concepts and explaining why certain strategies work or don't work. Use the portfolio data as real-world examples.`,
  
  technical: `You are a technical analyst specializing in options. Focus on technical indicators, Greeks, and quantitative analysis of positions.`,
  
  custom: DEFAULT_SYSTEM_PROMPT
}

// OpenAI pricing per 1M tokens (as of 2024-2025)
export const OPENAI_PRICING = {
  // GPT-4.1 models
  'gpt-4.1': { input: 2.00, cached: 0.50, output: 8.00 },
  'gpt-4.1-mini': { input: 0.40, cached: 0.10, output: 1.60 },
  'gpt-4.1-nano': { input: 0.10, cached: 0.025, output: 0.40 },
  
  // GPT-4.5 models
  'gpt-4.5-preview': { input: 75.00, cached: 37.50, output: 150.00 },
  
  // GPT-4o models
  'gpt-4o': { input: 2.50, cached: 1.25, output: 10.00 },
  'gpt-4o-mini': { input: 0.15, cached: 0.075, output: 0.60 },
  'gpt-4o-audio-preview': { input: 2.50, cached: null, output: 10.00 },
  'gpt-4o-realtime-preview': { input: 5.00, cached: 2.50, output: 20.00 },
  'gpt-4o-mini-audio-preview': { input: 0.15, cached: null, output: 0.60 },
  'gpt-4o-mini-realtime-preview': { input: 0.60, cached: 0.30, output: 2.40 },
  'gpt-4o-mini-search-preview': { input: 0.15, cached: null, output: 0.60 },
  'gpt-4o-search-preview': { input: 2.50, cached: null, output: 10.00 },
  
  // O1 models
  'o1': { input: 15.00, cached: 7.50, output: 60.00 },
  'o1-pro': { input: 150.00, cached: null, output: 600.00 },
  'o1-mini': { input: 1.10, cached: 0.55, output: 4.40 },
  
  // O3 models
  'o3': { input: 2.00, cached: 0.50, output: 8.00 },
  'o3-pro': { input: 20.00, cached: null, output: 80.00 },
  'o3-mini': { input: 1.10, cached: 0.55, output: 4.40 },
  'o3-deep-research': { input: 10.00, cached: 2.50, output: 40.00 },
  
  // O4 models
  'o4-mini': { input: 1.10, cached: 0.275, output: 4.40 },
  'o4-mini-deep-research': { input: 2.00, cached: 0.50, output: 8.00 },
  
  // Legacy models (fallback pricing)
  'gpt-4': { input: 30.00, cached: null, output: 60.00 },
  'gpt-4-turbo': { input: 10.00, cached: null, output: 30.00 },
  'gpt-3.5-turbo': { input: 1.50, cached: null, output: 2.00 },
  
  // Special models
  'computer-use-preview': { input: 3.00, cached: null, output: 12.00 },
  'codex-mini-latest': { input: 1.50, cached: 0.375, output: 6.00 },
  'gpt-image-1': { input: 5.00, cached: 1.25, output: null }
} as const;

// Helper function to calculate cost based on model and token usage
export function calculateOpenAICost(
  model: string, 
  inputTokens: number, 
  outputTokens: number,
  cachedTokens: number = 0
): number {
  const pricing = OPENAI_PRICING[model as keyof typeof OPENAI_PRICING];
  
  if (!pricing) {
    // Fallback to GPT-4o pricing if model not found
    const fallbackPricing = OPENAI_PRICING['gpt-4o'];
    return (
      (inputTokens / 1_000_000) * fallbackPricing.input +
      (outputTokens / 1_000_000) * fallbackPricing.output
    );
  }
  
  let cost = 0;
  
  // Calculate input token cost (including cached tokens if available)
  if (pricing.cached !== null && cachedTokens > 0) {
    const nonCachedTokens = inputTokens - cachedTokens;
    cost += (cachedTokens / 1_000_000) * pricing.cached;
    cost += (nonCachedTokens / 1_000_000) * pricing.input;
  } else {
    cost += (inputTokens / 1_000_000) * pricing.input;
  }
  
  // Calculate output token cost
  if (pricing.output !== null) {
    cost += (outputTokens / 1_000_000) * pricing.output;
  }
  
  return cost;
}

// Simplified cost estimation for UI display (without cached tokens)
export function estimateCost(tokens: number, model: string): string {
  const cost = calculateOpenAICost(model, tokens, 0);
  return cost.toFixed(4);
} 