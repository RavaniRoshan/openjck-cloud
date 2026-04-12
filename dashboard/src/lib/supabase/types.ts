export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_by?: string;
          created_at?: string;
        };
      };
      organization_members: {
        Row: {
          id: string;
          user_id: string;
          org_id: string;
          role: 'owner' | 'member' | 'admin';
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          org_id: string;
          role?: 'owner' | 'member' | 'admin';
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          org_id?: string;
          role?: 'owner' | 'member' | 'admin';
          created_at?: string;
        };
      };
      claw_sessions: {
        Row: {
          session_id: string;
          org_id: string;
          claw_name: string;
          project?: string;
          environment?: string;
          started_at: string;
          ended_at?: string;
          status: 'running' | 'completed' | 'failed' | 'terminated';
          total_input_tokens: number;
          total_output_tokens: number;
          total_cost_usd: number;
          tool_calls: number;
          steps: number;
          failure_root_cause?: string;
          loop_detected: boolean;
          tags?: string[];
          metadata?: Json;
          guard_config?: Json;
          guard_strikes?: Json;
          guard_termination?: Json;
          parent_session_id?: string;
        };
        Insert: {
          session_id?: string;
          org_id: string;
          claw_name: string;
          project?: string;
          environment?: string;
          started_at?: string;
          ended_at?: string;
          status?: 'running' | 'completed' | 'failed' | 'terminated';
          total_input_tokens?: number;
          total_output_tokens?: number;
          total_cost_usd?: number;
          tool_calls?: number;
          steps?: number;
          failure_root_cause?: string;
          loop_detected?: boolean;
          tags?: string[];
          metadata?: Json;
          guard_config?: Json;
          guard_strikes?: Json;
          guard_termination?: Json;
          parent_session_id?: string;
        };
        Update: {
          session_id?: string;
          org_id?: string;
          claw_name?: string;
          project?: string;
          environment?: string;
          started_at?: string;
          ended_at?: string;
          status?: 'running' | 'completed' | 'failed' | 'terminated';
          total_input_tokens?: number;
          total_output_tokens?: number;
          total_cost_usd?: number;
          tool_calls?: number;
          steps?: number;
          failure_root_cause?: string;
          loop_detected?: boolean;
          tags?: string[];
          metadata?: Json;
          guard_config?: Json;
          guard_strikes?: Json;
          guard_termination?: Json;
          parent_session_id?: string;
        };
      };
      step_packets: {
        Row: {
          event_id: string;
          session_id: string;
          schema_version: string;
          sdk: {
            name: string;
            version: string;
            language: string;
          };
          session_event: {
            session_id: string;
            session_type: string;
            event: string;
            timestamp: string;
            flag_type?: string;
          };
          event_type: 'step.started' | 'step.completed' | 'step.failed';
          step_number: number;
          request?: {
            input: string;
            instructions?: string;
            model: string;
            provider: string;
          };
          usage?: {
            input_tokens: number;
            output_tokens: number;
            tool_call_count: number;
            step_cost_usd: number;
            session_total_input_tokens: number;
            session_total_output_tokens: number;
            session_total_cost_usd: number;
          };
          tools?: Array<{
            tool_name: string;
            tool_input: Record<string, unknown>;
            fingerprint: string;
          }>;
          guard?: {
            triggered: boolean;
            events: Array<{
              guard_type: string;
              detail: string;
              current_value: number;
              threshold: number;
              strike: 1 | 2;
              action_taken: 'warned' | 'terminated';
              timestamp: string;
            }>;
          };
          error?: {
            type: string;
            message: string;
            details?: Record<string, unknown>;
          };
          recording?: {
            record: boolean;
            trace_path?: string;
            KonsistentlySessionID?: string;
            browser_screen_url?: string;
            browser_viewport_url?: string;
          };
          timestamp: string;
          created_at: string;
        };
        Insert: {
          event_id?: string;
          session_id: string;
          schema_version: string;
          sdk: {
            name: string;
            version: string;
            language: string;
          };
          session_event: {
            session_id: string;
            session_type: string;
            event: string;
            timestamp: string;
            flag_type?: string;
          };
          event_type: 'step.started' | 'step.completed' | 'step.failed';
          step_number: number;
          request?: {
            input: string;
            instructions?: string;
            model: string;
            provider: string;
          };
          usage?: {
            input_tokens: number;
            output_tokens: number;
            tool_call_count: number;
            step_cost_usd: number;
            session_total_input_tokens: number;
            session_total_output_tokens: number;
            session_total_cost_usd: number;
          };
          tools?: Array<{
            tool_name: string;
            tool_input: Record<string, unknown>;
            fingerprint: string;
          }>;
          guard?: {
            triggered: boolean;
            events: Array<{
              guard_type: string;
              detail: string;
              current_value: number;
              threshold: number;
              strike: 1 | 2;
              action_taken: 'warned' | 'terminated';
              timestamp: string;
            }>;
          };
          error?: {
            type: string;
            message: string;
            details?: Record<string, unknown>;
          };
          recording?: {
            record: boolean;
            trace_path?: string;
            KonsistentlySessionID?: string;
            browser_screen_url?: string;
            browser_viewport_url?: string;
          };
          timestamp?: string;
          created_at?: string;
        };
        Update: {
          event_id?: string;
          session_id?: string;
          schema_version?: string;
          sdk?: {
            name: string;
            version: string;
            language: string;
          };
          session_event?: {
            session_id: string;
            session_type: string;
            event: string;
            timestamp: string;
            flag_type?: string;
          };
          event_type?: 'step.started' | 'step.completed' | 'step.failed';
          step_number?: number;
          request?: {
            input: string;
            instructions?: string;
            model: string;
            provider: string;
          };
          usage?: {
            input_tokens: number;
            output_tokens: number;
            tool_call_count: number;
            step_cost_usd: number;
            session_total_input_tokens: number;
            session_total_output_tokens: number;
            session_total_cost_usd: number;
          };
          tools?: Array<{
            tool_name: string;
            tool_input: Record<string, unknown>;
            fingerprint: string;
          }>;
          guard?: {
            triggered: boolean;
            events: Array<{
              guard_type: string;
              detail: string;
              current_value: number;
              threshold: number;
              strike: 1 | 2;
              action_taken: 'warned' | 'terminated';
              timestamp: string;
            }>;
          };
          error?: {
            type: string;
            message: string;
            details?: Record<string, unknown>;
          };
          recording?: {
            record: boolean;
            trace_path?: string;
            KonsistentlySessionID?: string;
            browser_screen_url?: string;
            browser_viewport_url?: string;
          };
          timestamp?: string;
          created_at?: string;
        };
      };
    };
    Functions: Record<string, any>;
    Enums: {
      // No enums defined yet
    };
  };
}
