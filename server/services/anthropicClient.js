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
 * @param {Object} [customClient] - Optional Anthropic client (for BYOK)
 * @returns {Promise<Object>} - Claude's response parsed as JSON
 */
export async function analyzeSession(systemPrompt, userPrompt, customClient = null) {
  const client = customClient || anthropic;

  if (!client) {
    if (process.env.NODE_ENV !== 'production') {
      return getMockResult(userPrompt);
    }
    throw new Error('Anthropic API key not configured. Set ANTHROPIC_API_KEY environment variable.');
  }

  try {
    const response = await client.messages.create({
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

function getMockResult(userPrompt) {
  const hasLoop = userPrompt.includes('loop') || userPrompt.includes('Loop');
  return {
    root_cause: hasLoop
      ? 'The agent prompt lacks a termination condition for pagination, causing it to repeatedly navigate to the same URL when no next page exists. The browser.navigate tool returns the same DOM, but the agent interprets it as a new page.'
      : 'The agent encountered an API rate limit because it was making requests without exponential backoff or retry logic.',
    fix: hasLoop
      ? 'Add a pagination guard to the prompt: "Before navigating to the next page, verify the next page URL differs from the current URL. If the URL is the same, stop and return results." Also add a loop guard config: { "loop_threshold": 2 } to terminate after 2 consecutive identical tool calls.'
      : 'Add retry logic with exponential backoff to the tool definition. Set the rate_limit guard config to detect 429 responses and wait before retrying.',
    fix_type: hasLoop ? 'prompt' : 'tool_definition',
    confidence: hasLoop ? 'high' : 'medium',
    verification_test: hasLoop
      ? 'assert session.loop_detected == False\nassert session.steps <= expected_steps + 1'
      : 'assert session.status != "failed" or "rate limit" not in session.failure_root_cause',
  };
}