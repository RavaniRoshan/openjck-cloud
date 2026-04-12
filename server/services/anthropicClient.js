import Anthropic from '@anthropic-ai/sdk';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

let anthropic = null;

if (ANTHROPIC_API_KEY) {
  anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
}

/**
 * Analyze a failed session using Claude
 * @param {string} systemPrompt - The system prompt (verbatim from spec)
 * @param {string} userPrompt - The user prompt (dynamically built)
 * @returns {Promise<Object>} - Claude's response parsed as JSON
 */
export async function analyzeSession(systemPrompt, userPrompt) {
  if (!anthropic) {
    throw new Error('Anthropic API key not configured. Set ANTHROPIC_API_KEY environment variable.');
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6-20250319',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.0,
    });

    // Extract text from response content
    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Anthropic');
    }

    // Parse JSON from the response text
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in Anthropic response');
    }

    const result = JSON.parse(jsonMatch[0]);

    // Validate required fields
    const requiredFields = ['root_cause', 'fix', 'fix_type', 'confidence', 'verification_test'];
    for (const field of requiredFields) {
      if (!(field in result)) {
        throw new Error(`Missing required field '${field}' in response`);
      }
    }

    // Validate fix_type enum
    const validFixTypes = ['prompt', 'tool_definition', 'guard_config', 'code', 'unknown'];
    if (!validFixTypes.includes(result.fix_type)) {
      throw new Error(`Invalid fix_type: ${result.fix_type}. Must be one of: ${validFixTypes.join(', ')}`);
    }

    // Validate confidence enum
    const validConfidence = ['high', 'medium', 'low'];
    if (!validConfidence.includes(result.confidence)) {
      throw new Error(`Invalid confidence: ${result.confidence}. Must be one of: ${validConfidence.join(', ')}`);
    }

    return result;
  } catch (err) {
    if (err.name === 'ApiError') {
      throw new Error(`Anthropic API error: ${err.message}`);
    }
    throw err;
  }
}