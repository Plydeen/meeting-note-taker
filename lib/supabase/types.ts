export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type MeetingStatus =
  | "pending"
  | "scheduled"
  | "bot_queued"
  | "bot_joining"
  | "bot_joined"
  | "transcript_streaming"
  | "processing_summary"
  | "complete"
  | "failed"
  | "skipped";

export type MeetingPlatform = "zoom" | "google_meet" | "unknown";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          display_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      calendar_connections: {
        Row: {
          id: string;
          user_id: string;
          provider: string;
          account_email: string | null;
          access_token: string | null;
          refresh_token: string | null;
          expires_at: string | null;
          scopes: string[];
          sync_token: string | null;
          auto_join_enabled: boolean;
          auto_join_rules: Json;
          last_synced_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["calendar_connections"]["Row"]> & {
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["calendar_connections"]["Row"]>;
        Relationships: [];
      };
      meetings: {
        Row: {
          id: string;
          user_id: string;
          calendar_connection_id: string | null;
          external_calendar_id: string | null;
          title: string;
          description: string | null;
          meeting_url: string | null;
          platform: MeetingPlatform;
          starts_at: string;
          ends_at: string | null;
          timezone: string | null;
          organizer_email: string | null;
          status: MeetingStatus;
          auto_join_enabled: boolean;
          requires_approval: boolean;
          approved_at: string | null;
          raw_event: Json;
          error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["meetings"]["Row"]> & {
          user_id: string;
          title: string;
          starts_at: string;
        };
        Update: Partial<Database["public"]["Tables"]["meetings"]["Row"]>;
        Relationships: [];
      };
      meeting_participants: {
        Row: {
          id: string;
          meeting_id: string;
          name: string | null;
          email: string | null;
          response_status: string | null;
          is_organizer: boolean;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["meeting_participants"]["Row"]> & {
          meeting_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["meeting_participants"]["Row"]>;
        Relationships: [];
      };
      recall_bots: {
        Row: {
          id: string;
          meeting_id: string;
          recall_bot_id: string;
          status: string;
          bot_name: string | null;
          join_at: string | null;
          recording_config: Json;
          raw_response: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["recall_bots"]["Row"]> & {
          meeting_id: string;
          recall_bot_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["recall_bots"]["Row"]>;
        Relationships: [];
      };
      ingestion_events: {
        Row: {
          id: string;
          meeting_id: string | null;
          recall_bot_id: string | null;
          event_type: string;
          idempotency_key: string;
          payload: Json;
          received_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["ingestion_events"]["Row"]> & {
          event_type: string;
          idempotency_key: string;
          payload: Json;
        };
        Update: Partial<Database["public"]["Tables"]["ingestion_events"]["Row"]>;
        Relationships: [];
      };
      transcript_segments: {
        Row: {
          id: string;
          meeting_id: string;
          recall_bot_id: string | null;
          external_segment_id: string | null;
          speaker_name: string | null;
          speaker_id: string | null;
          text: string;
          starts_at_ms: number | null;
          ends_at_ms: number | null;
          is_final: boolean;
          raw_payload: Json;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["transcript_segments"]["Row"]> & {
          meeting_id: string;
          text: string;
        };
        Update: Partial<Database["public"]["Tables"]["transcript_segments"]["Row"]>;
        Relationships: [];
      };
      meeting_summaries: {
        Row: {
          id: string;
          meeting_id: string;
          provider: string;
          model: string;
          summary_markdown: string;
          summary_json: Json;
          transcript_hash: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["meeting_summaries"]["Row"]> & {
          meeting_id: string;
          provider: string;
          model: string;
          summary_markdown: string;
          summary_json: Json;
          transcript_hash: string;
        };
        Update: Partial<Database["public"]["Tables"]["meeting_summaries"]["Row"]>;
        Relationships: [];
      };
      meeting_embeddings: {
        Row: {
          id: string;
          meeting_id: string;
          source: string;
          content: string;
          content_hash: string;
          embedding: number[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          meeting_id: string;
          source?: string;
          content: string;
          content_hash: string;
          embedding: number[];
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["meeting_embeddings"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      match_meeting_embeddings: {
        Args: {
          query_embedding: number[];
          match_count?: number;
        };
        Returns: Array<{
          meeting_id: string;
          content: string;
          similarity: number;
        }>;
      };
    };
    Enums: {
      meeting_status: MeetingStatus;
      meeting_platform: MeetingPlatform;
    };
    CompositeTypes: Record<string, never>;
  };
};
