export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Table<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      personal_details: Table<
        { user_id: string; details: Json; updated_at: string },
        { user_id: string; details?: Json; updated_at?: string },
        { details?: Json; updated_at?: string }
      >;
      tracked_sites: Table<
        {
          id: string;
          user_id: string;
          label: string;
          url: string;
          hostname: string;
          favicon_url: string | null;
          last_visited_at: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        },
        {
          id?: string;
          user_id: string;
          label: string;
          url: string;
          hostname: string;
          favicon_url?: string | null;
          last_visited_at?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        },
        {
          label?: string;
          url?: string;
          hostname?: string;
          favicon_url?: string | null;
          last_visited_at?: string | null;
          updated_at?: string;
          deleted_at?: string | null;
        }
      >;
      saved_pages: Table<
        {
          id: string;
          user_id: string;
          title: string;
          url: string;
          selected_text: string | null;
          collection: "read_later" | "keep_forever";
          saved_at: string;
          expires_at: string | null;
          updated_at: string;
          deleted_at: string | null;
        },
        {
          id?: string;
          user_id: string;
          title: string;
          url: string;
          selected_text?: string | null;
          collection?: "read_later" | "keep_forever";
          saved_at?: string;
          expires_at?: string | null;
          updated_at?: string;
          deleted_at?: string | null;
        },
        {
          title?: string;
          url?: string;
          selected_text?: string | null;
          collection?: "read_later" | "keep_forever";
          expires_at?: string | null;
          updated_at?: string;
          deleted_at?: string | null;
        }
      >;
      sync_tombstones: Table<
        {
          user_id: string;
          record_type: "personal_details" | "tracked_sites" | "saved_pages";
          record_id: string;
          deleted_at: string;
        },
        {
          user_id: string;
          record_type: "personal_details" | "tracked_sites" | "saved_pages";
          record_id: string;
          deleted_at?: string;
        },
        {
          user_id?: string;
          record_type?: "personal_details" | "tracked_sites" | "saved_pages";
          record_id?: string;
          deleted_at?: string;
        }
      >;
      push_subscriptions: Table<
        {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          daily_checkins_enabled: boolean;
          daily_checkin_time: string;
          timezone: string;
          last_sent_local_date: string | null;
          claimed_until: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          daily_checkins_enabled?: boolean;
          daily_checkin_time?: string;
          timezone?: string;
          last_sent_local_date?: string | null;
          claimed_until?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        {
          endpoint?: string;
          p256dh?: string;
          auth?: string;
          daily_checkins_enabled?: boolean;
          daily_checkin_time?: string;
          timezone?: string;
          last_sent_local_date?: string | null;
          claimed_until?: string | null;
          updated_at?: string;
        }
      >;
    };
    Views: Record<string, never>;
    Functions: {
      claim_due_push_subscriptions: {
        Args: { p_limit?: number };
        Returns: {
          id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          send_for_date: string;
        }[];
      };
      complete_push_delivery: {
        Args: { p_subscription_id: string; p_send_for_date: string };
        Returns: boolean;
      };
      defer_push_delivery_claim: {
        Args: { p_subscription_id: string };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
