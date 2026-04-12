export const DEFAULT_GUARD_CONFIG = {
  max_cost_usd: 1.00,
  max_steps: 100,
  max_tool_calls: 50,
  max_duration_seconds: 3600,
  loop_detection: {
    window_size: 10,
    threshold: 3,
  },
};

export const GUARD_STRIKE_ACTIONS = {
  1: 'warned',
  2: 'terminated',
};
