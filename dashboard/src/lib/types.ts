// Session status enum
export enum SessionStatus {
  Running = "running",
  Completed = "completed",
  Failed = "failed",
  Terminated = "terminated",
}

// OpenJCK API payload schemas
export interface ClawSession {
  session_id: string;
  org_id: string;
  claw_name: string;
  project: string | null;
  environment: string;
  tags: string[];
  metadata: Record<string, unknown>;
  guard_config: Record<string, unknown> | null;
  status: SessionStatus;
  started_at: string | null;
  ended_at: string | null;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost_usd: number;
  steps: number;
  tool_calls: number;
  loop_detected: boolean;
  guard_triggered: boolean | null;
  failure_root_cause: string | null;
  created_at: string;
  updated_at: string;
  parent_session_id: string | null;
  has_recording: boolean;
  guard_strikes: Record<string, number> | null;
  guard_termination: {
    guard_type: string;
    detail: string;
    triggered_at: string;
    strike: number;
    current_value: number;
    threshold: number;
  } | null;
  // Replay fields (Phase 4)
  recording_step_count?: number;
}

export interface RecordingStatus {
  has_recording: boolean;
  step_count: number;
}

export interface StepPacket {
  schema_version: string;
  sdk: SDKInfo;
  session: SessionEvent;
  event: "step.started" | "step.completed" | "step.failed";
  request?: RequestData;
  usage?: UsageMetrics;
  tools?: ToolData[];
  guard?: GuardData;
  error?: ErrorData;
  recording?: RecordingInfo;
}

export interface SessionEvent {
  session_id: string;
  session_type: string;
  event: "session.started" | "session.ended" | "session.flag";
  timestamp: string; // ISO8601
  flag_type?: "loop_detected" | string;
}

export interface SDKInfo {
  name: string;
  version: string;
  language: string;
}

export interface RequestData {
  input: string;
  instructions?: string;
  model: string;
  provider: string;
}

export interface UsageMetrics {
  tokens_input: number;
  tokens_output: number;
  tokens_total: number;
  cost: number;
  model: string;
}

export interface ToolData {
  name: string;
  arguments: Record<string, unknown>;
}

export interface GuardData {
  type: string;
  triggered: boolean;
  threshold: number;
  current_value: number;
}

export interface ErrorData {
  type: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface RecordingInfo {
  browser_screen_url?: string;
  browser_viewport_url?: string;
  KonsistentlySessionID?: string;
}

// Fleet monitoring types (Phase 3)
export type FleetDensity = 'compact' | 'comfortable' | 'spacious';
export type TimeWindow = '1h' | '6h' | '24h' | '7d';

export interface FleetAgent {
  session_id: string;
  claw_name: string;
  status: SessionStatus;
  total_cost_usd: number;
  steps: number;
  tool_calls: number;
  loop_detected: boolean;
  started_at: string;
  ended_at: string | null;
  tags: string[];
  parent_session_id: string | null;
}

export interface FleetHealth {
  running: number;
  completed: number;
  failed: number;
  terminated: number;
  total_cost: number;
  total_tool_calls: number;
  status: 'healthy' | 'warning' | 'critical';
  agents: FleetAgent[];
}

export interface FleetActivityEvent {
  timestamp: string;
  session_id: string;
  claw_name: string;
  event_type: 'session_start' | 'session_end' | 'guard_triggered' | 'loop_detected' | 'step';
  detail: string;
}

// AI Fix result types
 export interface AiFixResult {
   root_cause: string;
   fix: string;
   fix_type: "prompt" | "tool_definition" | "guard_config" | "code" | "unknown";
   confidence: "high" | "medium" | "low";
   verification_test: string;
   analyzed_at: string;
   based_on_previous?: boolean; // Present on deeper analysis results
   _meta?: {
     key_mode: 'byok' | 'hosted';
   };
 }

export type AiFixState = 'idle' | 'loading' | 'result' | 'error' | 'rate_limited';

// Filters for sessions list query
export interface SessionFilters {
  status?: string;
  claw_name?: string;
  project?: string;
  limit?: number;
  offset?: number;
}

// Query key factory
export const queryKeys = {
  sessions: {
    all: ['sessions'] as const,
    list: (params?: SessionFilters) => ['sessions', 'list', params] as const,
    detail: (id: string) => ['sessions', id] as const,
    steps: (id: string) => ['sessions', id, 'steps'] as const,
    hasRecording: (id: string) => ['sessions', id, 'recording'] as const,
  },
   fleet: {
     health: (orgId: string) => ['fleet', 'health', orgId] as const,
     agents: (orgId: string, window: TimeWindow) => ['fleet', 'agents', orgId, window] as const,
     activity: (limit: number) => ['fleet', 'activity', limit] as const,
   },
  apiKeys: {
    all: ['api-keys'] as const,
    list: (orgId: string) => ['api-keys', 'list', orgId] as const,
  },
  org: {
    detail: (orgId: string) => ['org', orgId] as const,
    members: (orgId: string) => ['org', 'members', orgId] as const,
  },
  alerts: { all: ['alerts'] as const },
  billing: { usage: (orgId: string) => ['billing', 'usage', orgId] as const },
};
