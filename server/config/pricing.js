/**
 * Multi-provider pricing registry for OpenJCK.
 * 
 * Prices are per 1M tokens (input/output) in USD.
 * Keys format: "provider:model"
 * 
 * Sources:
 * - Anthropic: https://www.anthropic.com/pricing
 * - OpenAI: https://openai.com/pricing
 * - Groq: https://groq.com/pricing
 */

export const PRICING_MAP = {
  // Anthropic Claude
  'anthropic:claude-opus-4': { input_per_million: 15.00, output_per_million: 75.00 },
  'anthropic:claude-opus-4-20250514': { input_per_million: 15.00, output_per_million: 75.00 },
  'anthropic:claude-sonnet-4': { input_per_million: 3.00, output_per_million: 15.00 },
  'anthropic:claude-sonnet-4-20250514': { input_per_million: 3.00, output_per_million: 15.00 },
  'anthropic:claude-haiku-4-5': { input_per_million: 0.80, output_per_million: 4.00 },
  'anthropic:claude-haiku-4-5-20250331': { input_per_million: 0.80, output_per_million: 4.00 },
  'anthropic:claude-3-opus-20240229': { input_per_million: 15.00, output_per_million: 75.00 },
  'anthropic:claude-3-5-sonnet-20241022': { input_per_million: 3.00, output_per_million: 15.00 },
  'anthropic:claude-3-5-haiku-20241022': { input_per_million: 0.80, output_per_million: 4.00 },
  'anthropic:claude-3-haiku-20240307': { input_per_million: 0.25, output_per_million: 1.25 },

  // OpenAI GPT
  'openai:gpt-4o': { input_per_million: 2.50, output_per_million: 10.00 },
  'openai:gpt-4o-20240806': { input_per_million: 2.50, output_per_million: 10.00 },
  'openai:gpt-4o-mini': { input_per_million: 0.15, output_per_million: 0.60 },
  'openai:gpt-4o-mini-20240718': { input_per_million: 0.15, output_per_million: 0.60 },
  'openai:gpt-4-turbo': { input_per_million: 10.00, output_per_million: 30.00 },
  'openai:gpt-4': { input_per_million: 30.00, output_per_million: 60.00 },
  'openai:gpt-3.5-turbo': { input_per_million: 0.50, output_per_million: 1.50 },

  // Groq
  'groq:llama-3.3-70b-versatile': { input_per_million: 0.59, output_per_million: 0.79 },
  'groq:llama-3.1-70b-versatile': { input_per_million: 0.59, output_per_million: 0.79 },
  'groq:llama-3.1-8b-instant': { input_per_million: 0.08, output_per_million: 0.24 },
  'groq:mixtral-8x7b-32768': { input_per_million: 0.24, output_per_million: 0.24 },
  'groq:gemma2-9b-it': { input_per_million: 0.20, output_per_million: 0.20 },

  // Together.ai
  'together:meta-llama/Llama-3-70b-chat-hf': { input_per_million: 0.70, output_per_million: 0.70 },
  'together:meta-llama/Llama-3-8b-chat-hf': { input_per_million: 0.20, output_per_million: 0.20 },

  // DeepSeek (via OpenAI-compatible)
  'openai:deepseek-chat': { input_per_million: 0.27, output_per_million: 1.10 },

  // Perplexity
  'openai:sonar': { input_per_million: 1.00, output_per_million: 1.00 },
  'openai:sonar-pro': { input_per_million: 3.00, output_per_million: 3.00 },

  // Default fallback (if provider unknown)
  'default': { input_per_million: 1.00, output_per_million: 3.00 },
};

/**
 * Get pricing for a provider and model.
 * Looks up exact match first, then provider wildcard, then default.
 */
export function getPricing(provider, model) {
  // Try exact: "provider:model"
  const exactKey = `${provider}:${model}`;
  if (PRICING_MAP[exactKey]) {
    return PRICING_MAP[exactKey];
  }
  
  // Try provider wildcard: "provider:*"
  const wildcardKey = `${provider}:*`;
  if (PRICING_MAP[wildcardKey]) {
    return PRICING_MAP[wildcardKey];
  }
  
  // Default
  return PRICING_MAP['default'];
}

/**
 * Calculate cost in USD for given tokens.
 * @param {string} provider - Provider name (anthropic, openai, groq, etc.)
 * @param {string} model - Model identifier
 * @param {number} input_tokens
 * @param {number} output_tokens
 */
export function calculateCost(provider, model, input_tokens, output_tokens) {
  const pricing = getPricing(provider, model);
  const inputCost = (input_tokens / 1_000_000) * pricing.input_per_million;
  const outputCost = (output_tokens / 1_000_000) * pricing.output_per_million;
  const total = inputCost + outputCost;
  return Math.round(total * 1_000_000) / 1_000_000; // Round to 6 decimal places
}

/**
 * Backward compatible: calculate cost using only model (infers provider from model name heuristics).
 * This is for backward compatibility when provider is not explicitly provided.
 */
export function calculateCostLegacy(model, input_tokens, output_tokens) {
  let provider = 'anthropic'; // default fallback
  
  const m = model.toLowerCase();
  if (m.includes('claude')) provider = 'anthropic';
  else if (m.includes('gpt-') || m.includes('text-')) provider = 'openai';
  else if (m.includes('llama') || m.includes('mixtral') || m.includes('gemma')) provider = 'groq'; // likely Groq
  
  return calculateCost(provider, model, input_tokens, output_tokens);
}
