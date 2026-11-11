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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
