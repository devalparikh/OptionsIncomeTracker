export enum OpenAIModel {
  // Legacy models
  GPT_4 = "gpt-4",
  GPT_4_TURBO = "gpt-4-turbo",
  GPT_3_5_TURBO = "gpt-3.5-turbo",
  
  // GPT-4o family
  GPT_4O = "gpt-4o",
  GPT_4O_MINI = "gpt-4o-mini",
  GPT_4O_AUDIO_PREVIEW = "gpt-4o-audio-preview",
  GPT_4O_REALTIME_PREVIEW = "gpt-4o-realtime-preview",
  GPT_4O_MINI_AUDIO_PREVIEW = "gpt-4o-mini-audio-preview",
  GPT_4O_MINI_REALTIME_PREVIEW = "gpt-4o-mini-realtime-preview",
  GPT_4O_MINI_SEARCH_PREVIEW = "gpt-4o-mini-search-preview",
  GPT_4O_SEARCH_PREVIEW = "gpt-4o-search-preview",
  
  // GPT-4.1 family
  GPT_4_1 = "gpt-4.1",
  GPT_4_1_MINI = "gpt-4.1-mini",
  GPT_4_1_NANO = "gpt-4.1-nano",
  
  // GPT-4.5 family
  GPT_4_5_PREVIEW = "gpt-4.5-preview",
  
  // GPT-5 family
  GPT_5 = "gpt-5",
  GPT_5_TURBO = "gpt-5-turbo",
  GPT_5O = "gpt-5o",
  GPT_5O_MINI = "gpt-5o-mini",
  GPT_5O_PREVIEW = "gpt-5o-preview",
  GPT_5O_MINI_PREVIEW = "gpt-5o-mini-preview",
  GPT_5_1 = "gpt-5.1",
  GPT_5_1_MINI = "gpt-5.1-mini",
  
  // O1 family
  O1 = "o1",
  O1_PRO = "o1-pro",
  O1_MINI = "o1-mini",
  
  // O3 family
  O3 = "o3",
  O3_PRO = "o3-pro",
  O3_MINI = "o3-mini",
  O3_DEEP_RESEARCH = "o3-deep-research",
  
  // O4 family
  O4_MINI = "o4-mini",
  O4_MINI_DEEP_RESEARCH = "o4-mini-deep-research",
  
  // TTS models
  GPT_4O_MINI_TTS = "gpt-4o-mini-tts",
  
  // Special models
  COMPUTER_USE_PREVIEW = "computer-use-preview",
  CODEX_MINI_LATEST = "codex-mini-latest",
  GPT_IMAGE_1 = "gpt-image-1"
}

export class ModelConfig {
  static readonly WEB_SEARCH_ENABLED = new Set<OpenAIModel>([
    OpenAIModel.GPT_4O,
    OpenAIModel.GPT_4O_MINI,
    OpenAIModel.GPT_4_1,
    OpenAIModel.GPT_4_1_MINI,
    OpenAIModel.GPT_4O_MINI_SEARCH_PREVIEW,
    OpenAIModel.GPT_4O_SEARCH_PREVIEW,
    OpenAIModel.O1,
    OpenAIModel.O1_PRO,
    OpenAIModel.O1_MINI,
    OpenAIModel.O3,
    OpenAIModel.O3_PRO,
    OpenAIModel.O3_MINI,
    OpenAIModel.O3_DEEP_RESEARCH,
    OpenAIModel.O4_MINI,
    OpenAIModel.O4_MINI_DEEP_RESEARCH,
    OpenAIModel.GPT_5O,
    OpenAIModel.GPT_5O_MINI,
    OpenAIModel.GPT_5O_PREVIEW,
    OpenAIModel.GPT_5O_MINI_PREVIEW,
    OpenAIModel.GPT_5_1,
    OpenAIModel.GPT_5_1_MINI
  ])

  static supportsWebSearch(model: OpenAIModel | string): boolean {
    if (typeof model === 'string') {
      return this.WEB_SEARCH_ENABLED.has(model as OpenAIModel)
    }
    return this.WEB_SEARCH_ENABLED.has(model)
  }

  static getDisplayName(model: OpenAIModel): string {
    const displayNames: Record<OpenAIModel, string> = {
      [OpenAIModel.GPT_4]: "GPT-4",
      [OpenAIModel.GPT_4_TURBO]: "GPT-4 Turbo",
      [OpenAIModel.GPT_3_5_TURBO]: "GPT-3.5 Turbo",
      [OpenAIModel.GPT_4O]: "GPT-4o (Web Search)",
      [OpenAIModel.GPT_4O_MINI]: "GPT-4o Mini (Web Search)",
      [OpenAIModel.GPT_4O_AUDIO_PREVIEW]: "GPT-4o Audio Preview",
      [OpenAIModel.GPT_4O_REALTIME_PREVIEW]: "GPT-4o Realtime Preview",
      [OpenAIModel.GPT_4O_MINI_AUDIO_PREVIEW]: "GPT-4o Mini Audio Preview",
      [OpenAIModel.GPT_4O_MINI_REALTIME_PREVIEW]: "GPT-4o Mini Realtime Preview",
      [OpenAIModel.GPT_4O_MINI_SEARCH_PREVIEW]: "GPT-4o Mini Search Preview",
      [OpenAIModel.GPT_4O_SEARCH_PREVIEW]: "GPT-4o Search Preview",
      [OpenAIModel.GPT_4_1]: "GPT-4.1 (Web Search)",
      [OpenAIModel.GPT_4_1_MINI]: "GPT-4.1 Mini (Web Search)",
      [OpenAIModel.GPT_4_1_NANO]: "GPT-4.1 Nano",
      [OpenAIModel.GPT_4_5_PREVIEW]: "GPT-4.5 Preview (Web Search)",
      [OpenAIModel.GPT_5]: "GPT-5",
      [OpenAIModel.GPT_5_TURBO]: "GPT-5 Turbo",
      [OpenAIModel.GPT_5O]: "GPT-5o (Web Search)",
      [OpenAIModel.GPT_5O_MINI]: "GPT-5o Mini (Web Search)",
      [OpenAIModel.GPT_5O_PREVIEW]: "GPT-5o Preview (Web Search)",
      [OpenAIModel.GPT_5O_MINI_PREVIEW]: "GPT-5o Mini Preview (Web Search)",
      [OpenAIModel.GPT_5_1]: "GPT-5.1 (Web Search)",
      [OpenAIModel.GPT_5_1_MINI]: "GPT-5.1 Mini (Web Search)",
      [OpenAIModel.O1]: "O1 (Web Search)",
      [OpenAIModel.O1_PRO]: "O1 Pro (Web Search)",
      [OpenAIModel.O1_MINI]: "O1 Mini (Web Search)",
      [OpenAIModel.O3]: "O3 (Web Search)",
      [OpenAIModel.O3_PRO]: "O3 Pro (Web Search)",
      [OpenAIModel.O3_MINI]: "O3 Mini (Web Search)",
      [OpenAIModel.O3_DEEP_RESEARCH]: "O3 Deep Research (Web Search)",
      [OpenAIModel.O4_MINI]: "O4 Mini (Web Search)",
      [OpenAIModel.O4_MINI_DEEP_RESEARCH]: "O4 Mini Deep Research (Web Search)",
      [OpenAIModel.GPT_4O_MINI_TTS]: "GPT-4o Mini TTS",
      [OpenAIModel.COMPUTER_USE_PREVIEW]: "Computer Use Preview",
      [OpenAIModel.CODEX_MINI_LATEST]: "Codex Mini Latest",
      [OpenAIModel.GPT_IMAGE_1]: "GPT Image 1"
    }
    return displayNames[model] || model
  }
}

export interface AIChatConfig {
  apiKey: string
  systemPrompt: string
  model: OpenAIModel | string
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
  model: OpenAIModel.GPT_4,
  temperature: 0.7,
  maxTokens: 1000,
  budgetMode: false,
  compressionLevel: 'none',
  webSearchEnabled: false
}

export const AVAILABLE_MODELS = [
  // Legacy models
  { value: OpenAIModel.GPT_4, label: ModelConfig.getDisplayName(OpenAIModel.GPT_4) },
  { value: OpenAIModel.GPT_4_TURBO, label: ModelConfig.getDisplayName(OpenAIModel.GPT_4_TURBO) },
  { value: OpenAIModel.GPT_3_5_TURBO, label: ModelConfig.getDisplayName(OpenAIModel.GPT_3_5_TURBO) },
  
  // GPT-4o family
  { value: OpenAIModel.GPT_4O, label: ModelConfig.getDisplayName(OpenAIModel.GPT_4O) },
  { value: OpenAIModel.GPT_4O_MINI, label: ModelConfig.getDisplayName(OpenAIModel.GPT_4O_MINI) },
  { value: OpenAIModel.GPT_4O_SEARCH_PREVIEW, label: ModelConfig.getDisplayName(OpenAIModel.GPT_4O_SEARCH_PREVIEW) },
  { value: OpenAIModel.GPT_4O_MINI_SEARCH_PREVIEW, label: ModelConfig.getDisplayName(OpenAIModel.GPT_4O_MINI_SEARCH_PREVIEW) },
  
  // GPT-4.1 family
  { value: OpenAIModel.GPT_4_1, label: ModelConfig.getDisplayName(OpenAIModel.GPT_4_1) },
  { value: OpenAIModel.GPT_4_1_MINI, label: ModelConfig.getDisplayName(OpenAIModel.GPT_4_1_MINI) },
  { value: OpenAIModel.GPT_4_1_NANO, label: ModelConfig.getDisplayName(OpenAIModel.GPT_4_1_NANO) },
  
  // GPT-4.5 family
  { value: OpenAIModel.GPT_4_5_PREVIEW, label: ModelConfig.getDisplayName(OpenAIModel.GPT_4_5_PREVIEW) },
  
  // GPT-5 family
  { value: OpenAIModel.GPT_5, label: ModelConfig.getDisplayName(OpenAIModel.GPT_5) },
  { value: OpenAIModel.GPT_5_TURBO, label: ModelConfig.getDisplayName(OpenAIModel.GPT_5_TURBO) },
  { value: OpenAIModel.GPT_5O, label: ModelConfig.getDisplayName(OpenAIModel.GPT_5O) },
  { value: OpenAIModel.GPT_5O_MINI, label: ModelConfig.getDisplayName(OpenAIModel.GPT_5O_MINI) },
  { value: OpenAIModel.GPT_5O_PREVIEW, label: ModelConfig.getDisplayName(OpenAIModel.GPT_5O_PREVIEW) },
  { value: OpenAIModel.GPT_5O_MINI_PREVIEW, label: ModelConfig.getDisplayName(OpenAIModel.GPT_5O_MINI_PREVIEW) },
  { value: OpenAIModel.GPT_5_1, label: ModelConfig.getDisplayName(OpenAIModel.GPT_5_1) },
  { value: OpenAIModel.GPT_5_1_MINI, label: ModelConfig.getDisplayName(OpenAIModel.GPT_5_1_MINI) },
  
  // O1 family
  { value: OpenAIModel.O1, label: ModelConfig.getDisplayName(OpenAIModel.O1) },
  { value: OpenAIModel.O1_PRO, label: ModelConfig.getDisplayName(OpenAIModel.O1_PRO) },
  { value: OpenAIModel.O1_MINI, label: ModelConfig.getDisplayName(OpenAIModel.O1_MINI) },
  
  // O3 family
  { value: OpenAIModel.O3, label: ModelConfig.getDisplayName(OpenAIModel.O3) },
  { value: OpenAIModel.O3_PRO, label: ModelConfig.getDisplayName(OpenAIModel.O3_PRO) },
  { value: OpenAIModel.O3_MINI, label: ModelConfig.getDisplayName(OpenAIModel.O3_MINI) },
  { value: OpenAIModel.O3_DEEP_RESEARCH, label: ModelConfig.getDisplayName(OpenAIModel.O3_DEEP_RESEARCH) },
  
  // O4 family
  { value: OpenAIModel.O4_MINI, label: ModelConfig.getDisplayName(OpenAIModel.O4_MINI) },
  { value: OpenAIModel.O4_MINI_DEEP_RESEARCH, label: ModelConfig.getDisplayName(OpenAIModel.O4_MINI_DEEP_RESEARCH) }
]

export function modelSupportsWebSearch(model: string) {
  return ModelConfig.supportsWebSearch(model)
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
export const OPENAI_PRICING: Record<OpenAIModel | string, { input: number; cached: number | null; output: number | null; webSearchCost: number }> = {
  // GPT-4.1 models
  [OpenAIModel.GPT_4_1]: { input: 2.00, cached: 0.50, output: 8.00, webSearchCost: 25.00 },
  [OpenAIModel.GPT_4_1_MINI]: { input: 0.40, cached: 0.10, output: 1.60, webSearchCost: 25.00 },
  [OpenAIModel.GPT_4_1_NANO]: { input: 0.10, cached: 0.025, output: 0.40, webSearchCost: 25.00 },
  
  // GPT-4.5 models
  [OpenAIModel.GPT_4_5_PREVIEW]: { input: 75.00, cached: 37.50, output: 150.00, webSearchCost: 25.00 },
  
  // GPT-5 models
  [OpenAIModel.GPT_5]: { input: 20.00, cached: null, output: 80.00, webSearchCost: 25.00 },
  [OpenAIModel.GPT_5_TURBO]: { input: 15.00, cached: 7.50, output: 60.00, webSearchCost: 25.00 },
  [OpenAIModel.GPT_5O]: { input: 3.00, cached: 1.50, output: 12.00, webSearchCost: 25.00 },
  [OpenAIModel.GPT_5O_MINI]: { input: 0.20, cached: 0.10, output: 0.80, webSearchCost: 25.00 },
  [OpenAIModel.GPT_5O_PREVIEW]: { input: 3.00, cached: null, output: 12.00, webSearchCost: 25.00 },
  [OpenAIModel.GPT_5O_MINI_PREVIEW]: { input: 0.20, cached: null, output: 0.80, webSearchCost: 25.00 },
  [OpenAIModel.GPT_5_1]: { input: 2.50, cached: 0.625, output: 10.00, webSearchCost: 25.00 },
  [OpenAIModel.GPT_5_1_MINI]: { input: 0.50, cached: 0.125, output: 2.00, webSearchCost: 25.00 },
  
  // GPT-4o models
  [OpenAIModel.GPT_4O]: { input: 2.50, cached: 1.25, output: 10.00, webSearchCost: 25.00 },
  [OpenAIModel.GPT_4O_MINI]: { input: 0.15, cached: 0.075, output: 0.60, webSearchCost: 25.00 },
  [OpenAIModel.GPT_4O_AUDIO_PREVIEW]: { input: 2.50, cached: null, output: 10.00, webSearchCost: 25.00 },
  [OpenAIModel.GPT_4O_REALTIME_PREVIEW]: { input: 5.00, cached: 2.50, output: 20.00, webSearchCost: 25.00 },
  [OpenAIModel.GPT_4O_MINI_AUDIO_PREVIEW]: { input: 0.15, cached: null, output: 0.60, webSearchCost: 25.00 },
  [OpenAIModel.GPT_4O_MINI_REALTIME_PREVIEW]: { input: 0.60, cached: 0.30, output: 2.40, webSearchCost: 25.00 },
  [OpenAIModel.GPT_4O_MINI_SEARCH_PREVIEW]: { input: 0.15, cached: null, output: 0.60, webSearchCost: 25.00 },
  [OpenAIModel.GPT_4O_SEARCH_PREVIEW]: { input: 2.50, cached: null, output: 10.00, webSearchCost: 25.00 },
  
  // O1 models
  [OpenAIModel.O1]: { input: 15.00, cached: 7.50, output: 60.00, webSearchCost: 10.00 },
  [OpenAIModel.O1_PRO]: { input: 150.00, cached: null, output: 600.00, webSearchCost: 10.00 },
  [OpenAIModel.O1_MINI]: { input: 1.10, cached: 0.55, output: 4.40, webSearchCost: 10.00 },
  
  // O3 models
  [OpenAIModel.O3]: { input: 2.00, cached: 0.50, output: 8.00, webSearchCost: 10.00 },
  [OpenAIModel.O3_PRO]: { input: 20.00, cached: null, output: 80.00, webSearchCost: 10.00 },
  [OpenAIModel.O3_MINI]: { input: 1.10, cached: 0.55, output: 4.40, webSearchCost: 10.00 },
  [OpenAIModel.O3_DEEP_RESEARCH]: { input: 10.00, cached: 2.50, output: 40.00, webSearchCost: 10.00 },
  
  // O4 models
  [OpenAIModel.O4_MINI]: { input: 1.10, cached: 0.275, output: 4.40, webSearchCost: 10.00 },
  [OpenAIModel.O4_MINI_DEEP_RESEARCH]: { input: 2.00, cached: 0.50, output: 8.00, webSearchCost: 10.00 },
  
  // Legacy models (fallback pricing)
  [OpenAIModel.GPT_4]: { input: 30.00, cached: null, output: 60.00, webSearchCost: 25.00 },
  [OpenAIModel.GPT_4_TURBO]: { input: 10.00, cached: null, output: 30.00, webSearchCost: 25.00 },
  [OpenAIModel.GPT_3_5_TURBO]: { input: 1.50, cached: null, output: 2.00, webSearchCost: 25.00 },
  
  // Special models
  [OpenAIModel.COMPUTER_USE_PREVIEW]: { input: 3.00, cached: null, output: 12.00, webSearchCost: 25.00 },
  [OpenAIModel.CODEX_MINI_LATEST]: { input: 1.50, cached: 0.375, output: 6.00, webSearchCost: 25.00 },
  [OpenAIModel.GPT_IMAGE_1]: { input: 5.00, cached: 1.25, output: null, webSearchCost: 25.00 }
} as const;

// Helper function to calculate cost based on model and token usage
export function calculateOpenAICost(
  model: string, 
  inputTokens: number, 
  outputTokens: number,
  cachedTokens: number = 0,
  webSearchEnabled: boolean = false
): number {
  const pricing = OPENAI_PRICING[model as keyof typeof OPENAI_PRICING];
  
  if (!pricing) {
    // Fallback to GPT-4o pricing if model not found
    const fallbackPricing = OPENAI_PRICING[OpenAIModel.GPT_4O];
    return (
      (inputTokens / 1_000_000) * fallbackPricing.input +
      (outputTokens / 1_000_000) * (fallbackPricing.output || 0)
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
  
  // Add web search cost if enabled
  if (webSearchEnabled && pricing.webSearchCost) {
    // Web search cost is per call, not per token
    // For GPT-4o and GPT-4.1 models: $25.00 per 1K calls
    // For O3 and O4-mini models: $10.00 per 1K calls
    cost += (pricing.webSearchCost / 1000); // Convert to per-call cost
  }
  
  return cost;
}

// Simplified cost estimation for UI display (without cached tokens)
export function estimateCost(tokens: number, model: string, webSearchEnabled: boolean = false): string {
  const cost = calculateOpenAICost(model, tokens, 0, 0, webSearchEnabled);
  return cost.toFixed(4);
} 