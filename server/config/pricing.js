export const PRICING_MAP = {
  'claude-opus-4':    { input_per_million: 15.00, output_per_million: 75.00 },
  'claude-sonnet-4':  { input_per_million: 3.00,  output_per_million: 15.00 },
  'claude-haiku-4-5': { input_per_million: 0.80,  output_per_million: 4.00  },
};

export function calculateCost(model, input_tokens, output_tokens) {
  const pricing = PRICING_MAP[model] ?? PRICING_MAP['claude-sonnet-4'];
  const cost =
    (input_tokens / 1_000_000) * pricing.input_per_million +
    (output_tokens / 1_000_000) * pricing.output_per_million;
  return Math.round(cost * 1_000_000) / 1_000_000;
}
