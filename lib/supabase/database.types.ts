export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      action_receipts: {
        Row: {
          created_at: string;
          event_type: string;
          id: string;
          metadata: Json;
          owner_id: string;
          stage: string;
          status: string;
          step_id: string | null;
          summary: string;
          task_id: string;
        };
        Insert: {
          created_at?: string;
          event_type: string;
          id?: string;
          metadata?: Json;
          owner_id: string;
          stage: string;
          status?: string;
          step_id?: string | null;
          summary: string;
          task_id: string;
        };
        Update: {
          created_at?: string;
          event_type?: string;
          id?: string;
          metadata?: Json;
          owner_id?: string;
          stage?: string;
          status?: string;
          step_id?: string | null;
          summary?: string;
          task_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "action_receipts_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "action_receipts_step_task_fk";
            columns: ["step_id", "task_id"];
            isOneToOne: false;
            referencedRelation: "task_steps";
            referencedColumns: ["id", "task_id"];
          },
          {
            foreignKeyName: "action_receipts_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      appearance_versions: {
        Row: {
          accessory_ids: Json;
          configuration: Json;
          created_at: string;
          face_glow: string;
          id: string;
          nook_id: string;
          outfit_id: string | null;
          primary_color: string;
          rig_version: string;
          secondary_color: string;
          version: number;
        };
        Insert: {
          accessory_ids?: Json;
          configuration?: Json;
          created_at?: string;
          face_glow: string;
          id?: string;
          nook_id: string;
          outfit_id?: string | null;
          primary_color: string;
          rig_version?: string;
          secondary_color: string;
          version: number;
        };
        Update: {
          accessory_ids?: Json;
          configuration?: Json;
          created_at?: string;
          face_glow?: string;
          id?: string;
          nook_id?: string;
          outfit_id?: string | null;
          primary_color?: string;
          rig_version?: string;
          secondary_color?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "appearance_versions_nook_id_fkey";
            columns: ["nook_id"];
            isOneToOne: false;
            referencedRelation: "nooks";
            referencedColumns: ["id"];
          },
        ];
      };
      approvals: {
        Row: {
          action_hash: string;
          action_id: string | null;
          created_at: string;
          decided_at: string | null;
          decision: string | null;
          expires_at: string;
          id: string;
          intent: Json;
          owner_id: string;
          risk_class: number;
          status: string;
          step_id: string;
          task_id: string;
        };
        Insert: {
          action_hash: string;
          action_id?: string | null;
          created_at?: string;
          decided_at?: string | null;
          decision?: string | null;
          expires_at: string;
          id?: string;
          intent?: Json;
          owner_id: string;
          risk_class?: number;
          status?: string;
          step_id: string;
          task_id: string;
        };
        Update: {
          action_hash?: string;
          action_id?: string | null;
          created_at?: string;
          decided_at?: string | null;
          decision?: string | null;
          expires_at?: string;
          id?: string;
          intent?: Json;
          owner_id?: string;
          risk_class?: number;
          status?: string;
          step_id?: string;
          task_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "approvals_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "approvals_step_task_fk";
            columns: ["step_id", "task_id"];
            isOneToOne: false;
            referencedRelation: "task_steps";
            referencedColumns: ["id", "task_id"];
          },
          {
            foreignKeyName: "approvals_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      assets: {
        Row: {
          byte_size: number;
          content_hash: string;
          created_at: string;
          id: string;
          metadata: Json;
          mime_type: string;
          moderation_status: string;
          owner_id: string | null;
          public_url: string | null;
          storage_key: string;
          visibility: string;
        };
        Insert: {
          byte_size: number;
          content_hash: string;
          created_at?: string;
          id?: string;
          metadata?: Json;
          mime_type: string;
          moderation_status?: string;
          owner_id?: string | null;
          public_url?: string | null;
          storage_key: string;
          visibility?: string;
        };
        Update: {
          byte_size?: number;
          content_hash?: string;
          created_at?: string;
          id?: string;
          metadata?: Json;
          mime_type?: string;
          moderation_status?: string;
          owner_id?: string | null;
          public_url?: string | null;
          storage_key?: string;
          visibility?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assets_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      browser_commands: {
        Row: {
          action_hash: string;
          claimed_at: string | null;
          claimed_device_id: string | null;
          command: Json;
          completed_at: string | null;
          created_at: string;
          expires_at: string;
          id: string;
          owner_id: string;
          receipt_signature: string | null;
          result: Json | null;
          run_id: string;
          status: string;
          step_id: string;
          task_id: string;
        };
        Insert: {
          action_hash: string;
          claimed_at?: string | null;
          claimed_device_id?: string | null;
          command: Json;
          completed_at?: string | null;
          created_at?: string;
          expires_at: string;
          id: string;
          owner_id: string;
          receipt_signature?: string | null;
          result?: Json | null;
          run_id: string;
          status?: string;
          step_id: string;
          task_id: string;
        };
        Update: {
          action_hash?: string;
          claimed_at?: string | null;
          claimed_device_id?: string | null;
          command?: Json;
          completed_at?: string | null;
          created_at?: string;
          expires_at?: string;
          id?: string;
          owner_id?: string;
          receipt_signature?: string | null;
          result?: Json | null;
          run_id?: string;
          status?: string;
          step_id?: string;
          task_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "browser_commands_claimed_device_id_fkey";
            columns: ["claimed_device_id"];
            isOneToOne: false;
            referencedRelation: "devices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "browser_commands_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "browser_commands_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      capability_grants: {
        Row: {
          capability: string;
          created_at: string;
          device_id: string | null;
          expires_at: string | null;
          id: string;
          nook_id: string | null;
          owner_id: string;
          revoked_at: string | null;
          scope: Json;
          status: string;
          updated_at: string;
        };
        Insert: {
          capability: string;
          created_at?: string;
          device_id?: string | null;
          expires_at?: string | null;
          id?: string;
          nook_id?: string | null;
          owner_id: string;
          revoked_at?: string | null;
          scope?: Json;
          status?: string;
          updated_at?: string;
        };
        Update: {
          capability?: string;
          created_at?: string;
          device_id?: string | null;
          expires_at?: string | null;
          id?: string;
          nook_id?: string | null;
          owner_id?: string;
          revoked_at?: string | null;
          scope?: Json;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "capability_grants_device_id_fkey";
            columns: ["device_id"];
            isOneToOne: false;
            referencedRelation: "devices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "capability_grants_nook_id_fkey";
            columns: ["nook_id"];
            isOneToOne: false;
            referencedRelation: "nooks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "capability_grants_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      creator_profiles: {
        Row: {
          bio: string;
          created_at: string;
          display_name: string;
          owner_id: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          bio?: string;
          created_at?: string;
          display_name: string;
          owner_id: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          bio?: string;
          created_at?: string;
          display_name?: string;
          owner_id?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "creator_profiles_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      device_pairings: {
        Row: {
          code_hash: string;
          consumed_at: string | null;
          created_at: string;
          expires_at: string;
          id: string;
          owner_id: string;
        };
        Insert: {
          code_hash: string;
          consumed_at?: string | null;
          created_at?: string;
          expires_at: string;
          id?: string;
          owner_id: string;
        };
        Update: {
          code_hash?: string;
          consumed_at?: string | null;
          created_at?: string;
          expires_at?: string;
          id?: string;
          owner_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "device_pairings_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      devices: {
        Row: {
          created_at: string;
          id: string;
          last_seen_at: string | null;
          name: string;
          owner_id: string;
          platform: string;
          public_key: string;
          revoked_at: string | null;
          status: string;
          token_hash: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          last_seen_at?: string | null;
          name: string;
          owner_id: string;
          platform?: string;
          public_key: string;
          revoked_at?: string | null;
          status?: string;
          token_hash: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          last_seen_at?: string | null;
          name?: string;
          owner_id?: string;
          platform?: string;
          public_key?: string;
          revoked_at?: string | null;
          status?: string;
          token_hash?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "devices_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      entitlements: {
        Row: {
          expires_at: string | null;
          grant_key: string;
          granted_at: string;
          id: string;
          owner_id: string;
          product_id: string;
          product_version_id: string;
          revoked_at: string | null;
          source_order_item_id: string | null;
          status: string;
        };
        Insert: {
          expires_at?: string | null;
          grant_key: string;
          granted_at?: string;
          id?: string;
          owner_id: string;
          product_id: string;
          product_version_id: string;
          revoked_at?: string | null;
          source_order_item_id?: string | null;
          status?: string;
        };
        Update: {
          expires_at?: string | null;
          grant_key?: string;
          granted_at?: string;
          id?: string;
          owner_id?: string;
          product_id?: string;
          product_version_id?: string;
          revoked_at?: string | null;
          source_order_item_id?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "entitlements_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "entitlements_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "catalog_items";
            referencedColumns: ["product_id"];
          },
          {
            foreignKeyName: "entitlements_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "entitlements_product_version_id_fkey";
            columns: ["product_version_id"];
            isOneToOne: false;
            referencedRelation: "catalog_items";
            referencedColumns: ["product_version_id"];
          },
          {
            foreignKeyName: "entitlements_product_version_id_fkey";
            columns: ["product_version_id"];
            isOneToOne: false;
            referencedRelation: "product_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "entitlements_source_order_item_id_fkey";
            columns: ["source_order_item_id"];
            isOneToOne: false;
            referencedRelation: "order_items";
            referencedColumns: ["id"];
          },
        ];
      };
      integration_connection_summaries: {
        Row: {
          account_email: string;
          expires_at: string | null;
          last_used_at: string | null;
          owner_id: string;
          provider: string;
          scopes: string[];
          status: string;
          updated_at: string;
        };
        Insert: {
          account_email: string;
          expires_at?: string | null;
          last_used_at?: string | null;
          owner_id: string;
          provider: string;
          scopes?: string[];
          status?: string;
          updated_at?: string;
        };
        Update: {
          account_email?: string;
          expires_at?: string | null;
          last_used_at?: string | null;
          owner_id?: string;
          provider?: string;
          scopes?: string[];
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "integration_connection_summaries_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      listings: {
        Row: {
          created_at: string;
          id: string;
          product_version_id: string;
          published_at: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          product_version_id: string;
          published_at?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          product_version_id?: string;
          published_at?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "listings_product_version_id_fkey";
            columns: ["product_version_id"];
            isOneToOne: true;
            referencedRelation: "catalog_items";
            referencedColumns: ["product_version_id"];
          },
          {
            foreignKeyName: "listings_product_version_id_fkey";
            columns: ["product_version_id"];
            isOneToOne: true;
            referencedRelation: "product_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      nook_loadout: {
        Row: {
          entitlement_id: string;
          equipped_at: string;
          nook_id: string;
          slot: string;
        };
        Insert: {
          entitlement_id: string;
          equipped_at?: string;
          nook_id: string;
          slot: string;
        };
        Update: {
          entitlement_id?: string;
          equipped_at?: string;
          nook_id?: string;
          slot?: string;
        };
        Relationships: [
          {
            foreignKeyName: "nook_loadout_entitlement_id_fkey";
            columns: ["entitlement_id"];
            isOneToOne: false;
            referencedRelation: "entitlements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nook_loadout_nook_id_fkey";
            columns: ["nook_id"];
            isOneToOne: false;
            referencedRelation: "nooks";
            referencedColumns: ["id"];
          },
        ];
      };
      nook_memories: {
        Row: {
          content: string;
          created_at: string;
          expires_at: string | null;
          id: string;
          kind: string;
          nook_id: string;
          owner_id: string;
          source: string;
          status: string;
          pinned: boolean;
          usefulness_count: number;
          updated_at: string;
        };
        Insert: {
          content: string;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          kind: string;
          nook_id: string;
          owner_id: string;
          source?: string;
          status?: string;
          pinned?: boolean;
          usefulness_count?: number;
          updated_at?: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          kind?: string;
          nook_id?: string;
          owner_id?: string;
          source?: string;
          status?: string;
          pinned?: boolean;
          usefulness_count?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "nook_memories_nook_id_fkey";
            columns: ["nook_id"];
            isOneToOne: false;
            referencedRelation: "nooks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nook_memories_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      nooks: {
        Row: {
          active_appearance_id: string | null;
          appearance_version: number;
          base_species: string;
          behavior_settings: Json;
          created_at: string;
          id: string;
          memory_policy: string;
          name: string;
          owner_id: string;
          status: string;
          updated_at: string;
          working_style: string;
        };
        Insert: {
          active_appearance_id?: string | null;
          appearance_version?: number;
          base_species?: string;
          behavior_settings?: Json;
          created_at?: string;
          id?: string;
          memory_policy?: string;
          name: string;
          owner_id: string;
          status?: string;
          updated_at?: string;
          working_style?: string;
        };
        Update: {
          active_appearance_id?: string | null;
          appearance_version?: number;
          base_species?: string;
          behavior_settings?: Json;
          created_at?: string;
          id?: string;
          memory_policy?: string;
          name?: string;
          owner_id?: string;
          status?: string;
          updated_at?: string;
          working_style?: string;
        };
        Relationships: [
          {
            foreignKeyName: "nooks_active_appearance_fk";
            columns: ["active_appearance_id", "id"];
            isOneToOne: false;
            referencedRelation: "appearance_versions";
            referencedColumns: ["id", "nook_id"];
          },
          {
            foreignKeyName: "nooks_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          created_at: string;
          currency: string;
          id: string;
          listing_id: string;
          order_id: string;
          product_id: string;
          product_version_id: string;
          quantity: number;
          title_snapshot: string;
          unit_amount: number;
        };
        Insert: {
          created_at?: string;
          currency: string;
          id?: string;
          listing_id: string;
          order_id: string;
          product_id: string;
          product_version_id: string;
          quantity?: number;
          title_snapshot: string;
          unit_amount: number;
        };
        Update: {
          created_at?: string;
          currency?: string;
          id?: string;
          listing_id?: string;
          order_id?: string;
          product_id?: string;
          product_version_id?: string;
          quantity?: number;
          title_snapshot?: string;
          unit_amount?: number;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "catalog_items";
            referencedColumns: ["listing_id"];
          },
          {
            foreignKeyName: "order_items_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "catalog_items";
            referencedColumns: ["product_id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_version_id_fkey";
            columns: ["product_version_id"];
            isOneToOne: false;
            referencedRelation: "catalog_items";
            referencedColumns: ["product_version_id"];
          },
          {
            foreignKeyName: "order_items_product_version_id_fkey";
            columns: ["product_version_id"];
            isOneToOne: false;
            referencedRelation: "product_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          created_at: string;
          currency: string;
          id: string;
          owner_id: string;
          paid_at: string | null;
          status: string;
          subtotal_amount: number;
          total_amount: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          currency: string;
          id?: string;
          owner_id: string;
          paid_at?: string | null;
          status?: string;
          subtotal_amount?: number;
          total_amount?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          currency?: string;
          id?: string;
          owner_id?: string;
          paid_at?: string | null;
          status?: string;
          subtotal_amount?: number;
          total_amount?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      prices: {
        Row: {
          active: boolean;
          created_at: string;
          currency: string;
          id: string;
          listing_id: string;
          unit_amount: number;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          currency: string;
          id?: string;
          listing_id: string;
          unit_amount: number;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          currency?: string;
          id?: string;
          listing_id?: string;
          unit_amount?: number;
        };
        Relationships: [
          {
            foreignKeyName: "prices_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "catalog_items";
            referencedColumns: ["listing_id"];
          },
          {
            foreignKeyName: "prices_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
        ];
      };
      product_versions: {
        Row: {
          compatibility: Json;
          content_hash: string;
          created_at: string;
          id: string;
          manifest: Json;
          preview_asset_id: string | null;
          primary_asset_id: string | null;
          product_id: string;
          version: number;
        };
        Insert: {
          compatibility?: Json;
          content_hash: string;
          created_at?: string;
          id?: string;
          manifest?: Json;
          preview_asset_id?: string | null;
          primary_asset_id?: string | null;
          product_id: string;
          version: number;
        };
        Update: {
          compatibility?: Json;
          content_hash?: string;
          created_at?: string;
          id?: string;
          manifest?: Json;
          preview_asset_id?: string | null;
          primary_asset_id?: string | null;
          product_id?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "product_versions_preview_asset_id_fkey";
            columns: ["preview_asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_versions_primary_asset_id_fkey";
            columns: ["primary_asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_versions_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "catalog_items";
            referencedColumns: ["product_id"];
          },
          {
            foreignKeyName: "product_versions_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          created_at: string;
          creator_id: string | null;
          description: string;
          id: string;
          kind: string;
          name: string;
          owner_kind: string;
          slug: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          creator_id?: string | null;
          description?: string;
          id?: string;
          kind: string;
          name: string;
          owner_kind?: string;
          slug: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          creator_id?: string | null;
          description?: string;
          id?: string;
          kind?: string;
          name?: string;
          owner_kind?: string;
          slug?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_creator_id_fkey";
            columns: ["creator_id"];
            isOneToOne: false;
            referencedRelation: "creator_profiles";
            referencedColumns: ["owner_id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          display_name: string | null;
          handle: string | null;
          id: string;
          onboarding_state: string;
          plan: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          handle?: string | null;
          id: string;
          onboarding_state?: string;
          plan?: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          handle?: string | null;
          id?: string;
          onboarding_state?: string;
          plan?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      task_feedback: {
        Row: {
          id: string;
          task_id: string;
          owner_id: string;
          rating: string;
          categories: string[];
          comment: string | null;
          suggested_correction: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          owner_id: string;
          rating: string;
          categories?: string[];
          comment?: string | null;
          suggested_correction?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          owner_id?: string;
          rating?: string;
          categories?: string[];
          comment?: string | null;
          suggested_correction?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      task_reflections: {
        Row: {
          task_id: string;
          owner_id: string;
          outcome: string;
          what_worked: string[];
          what_failed: string[];
          user_corrections: string[];
          reusable_preference_candidates: string[];
          created_at: string;
        };
        Insert: {
          task_id: string;
          owner_id: string;
          outcome: string;
          what_worked?: string[];
          what_failed?: string[];
          user_corrections?: string[];
          reusable_preference_candidates?: string[];
          created_at?: string;
        };
        Update: {
          task_id?: string;
          owner_id?: string;
          outcome?: string;
          what_worked?: string[];
          what_failed?: string[];
          user_corrections?: string[];
          reusable_preference_candidates?: string[];
          created_at?: string;
        };
        Relationships: [];
      };
      research_runs: {
        Row: {
          id: string;
          task_id: string;
          owner_id: string;
          query: string;
          freshness: string;
          provider: string;
          status: string;
          searched_at: string;
          metadata: Json;
        };
        Insert: {
          id?: string;
          task_id: string;
          owner_id: string;
          query: string;
          freshness: string;
          provider: string;
          status: string;
          searched_at?: string;
          metadata?: Json;
        };
        Update: {
          id?: string;
          task_id?: string;
          owner_id?: string;
          query?: string;
          freshness?: string;
          provider?: string;
          status?: string;
          searched_at?: string;
          metadata?: Json;
        };
        Relationships: [];
      };
      research_sources: {
        Row: {
          id: string;
          research_run_id: string;
          title: string;
          url: string;
          source_name: string;
          published_at: string | null;
          retrieved_at: string;
          snippet: string;
          content_hash: string;
        };
        Insert: {
          id?: string;
          research_run_id: string;
          title: string;
          url: string;
          source_name: string;
          published_at?: string | null;
          retrieved_at: string;
          snippet: string;
          content_hash: string;
        };
        Update: {
          id?: string;
          research_run_id?: string;
          title?: string;
          url?: string;
          source_name?: string;
          published_at?: string | null;
          retrieved_at?: string;
          snippet?: string;
          content_hash?: string;
        };
        Relationships: [];
      };
      memory_proposals: {
        Row: {
          id: string;
          owner_id: string;
          nook_id: string;
          source_task_id: string | null;
          kind: string;
          title: string;
          content: string;
          reason: string;
          confidence: number;
          status: string;
          expires_at: string | null;
          created_at: string;
          reviewed_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          nook_id: string;
          source_task_id?: string | null;
          kind: string;
          title: string;
          content: string;
          reason: string;
          confidence: number;
          status?: string;
          expires_at?: string | null;
          created_at?: string;
          reviewed_at?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          nook_id?: string;
          source_task_id?: string | null;
          kind?: string;
          title?: string;
          content?: string;
          reason?: string;
          confidence?: number;
          status?: string;
          expires_at?: string | null;
          created_at?: string;
          reviewed_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      task_memory_usage: {
        Row: {
          task_id: string;
          memory_id: string;
          owner_id: string;
          reason: string;
          created_at: string;
        };
        Insert: {
          task_id: string;
          memory_id: string;
          owner_id: string;
          reason: string;
          created_at?: string;
        };
        Update: {
          task_id?: string;
          memory_id?: string;
          owner_id?: string;
          reason?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      task_outputs: {
        Row: {
          created_at: string;
          graph_version: string;
          id: string;
          metadata: Json;
          mode: string;
          model: string;
          owner_id: string;
          prompt_version: string;
          result_markdown: string;
          summary: string;
          task_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          graph_version: string;
          id?: string;
          metadata?: Json;
          mode?: string;
          model: string;
          owner_id: string;
          prompt_version: string;
          result_markdown: string;
          summary: string;
          task_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          graph_version?: string;
          id?: string;
          metadata?: Json;
          mode?: string;
          model?: string;
          owner_id?: string;
          prompt_version?: string;
          result_markdown?: string;
          summary?: string;
          task_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "task_outputs_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "task_outputs_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: true;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      task_steps: {
        Row: {
          attempt: number;
          dependency_step_id: string | null;
          verification: Json | null;
          output: Json | null;
          action_hash: string | null;
          action_id: string | null;
          created_at: string;
          detail: string;
          id: string;
          kind: string;
          ordinal: number;
          requires_approval: boolean;
          status: string;
          task_id: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          attempt?: number;
          dependency_step_id?: string | null;
          verification?: Json | null;
          output?: Json | null;
          action_hash?: string | null;
          action_id?: string | null;
          created_at?: string;
          detail?: string;
          id?: string;
          kind: string;
          ordinal: number;
          requires_approval?: boolean;
          status?: string;
          task_id: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          attempt?: number;
          dependency_step_id?: string | null;
          verification?: Json | null;
          output?: Json | null;
          action_hash?: string | null;
          action_id?: string | null;
          created_at?: string;
          detail?: string;
          id?: string;
          kind?: string;
          ordinal?: number;
          requires_approval?: boolean;
          status?: string;
          task_id?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "task_steps_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      tasks: {
        Row: {
          active_run_mode: string | null;
          completed_at: string | null;
          created_at: string;
          current_step_id: string | null;
          id: string;
          input: string;
          nook_id: string;
          owner_id: string;
          plan: Json | null;
          risk_class: number;
          source: string;
          started_at: string | null;
          status: string;
          updated_at: string;
          workflow_instance_id: string | null;
        };
        Insert: {
          active_run_mode?: string | null;
          completed_at?: string | null;
          created_at?: string;
          current_step_id?: string | null;
          id?: string;
          input: string;
          nook_id: string;
          owner_id: string;
          plan?: Json | null;
          risk_class?: number;
          source?: string;
          started_at?: string | null;
          status?: string;
          updated_at?: string;
          workflow_instance_id?: string | null;
        };
        Update: {
          active_run_mode?: string | null;
          completed_at?: string | null;
          created_at?: string;
          current_step_id?: string | null;
          id?: string;
          input?: string;
          nook_id?: string;
          owner_id?: string;
          plan?: Json | null;
          risk_class?: number;
          source?: string;
          started_at?: string | null;
          status?: string;
          updated_at?: string;
          workflow_instance_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_current_step_fk";
            columns: ["current_step_id", "id"];
            isOneToOne: false;
            referencedRelation: "task_steps";
            referencedColumns: ["id", "task_id"];
          },
          {
            foreignKeyName: "tasks_nook_id_fkey";
            columns: ["nook_id"];
            isOneToOne: false;
            referencedRelation: "nooks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      catalog_items: {
        Row: {
          compatibility: Json | null;
          currency: string | null;
          description: string | null;
          kind: string | null;
          listing_id: string | null;
          name: string | null;
          preview_asset_url: string | null;
          price_amount: number | null;
          product_id: string | null;
          product_version_id: string | null;
          slug: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      nook_claim_browser_command: {
        Args: { p_token_hash: string };
        Returns: {
          action_hash: string;
          command: Json;
          command_id: string;
          expires_at: string;
        }[];
      };
      nook_finish_browser_command: {
        Args: {
          p_command_id: string;
          p_receipt_signature: string;
          p_result: Json;
          p_status: string;
          p_token_hash: string;
        };
        Returns: {
          output_id: string | null;
          task_id: string;
          task_status: string;
        }[];
      };
      nook_expire_browser_command: {
        Args: { p_command_id: string; p_owner_id: string };
        Returns: boolean;
      };
      nook_redeem_browser_pairing: {
        Args: {
          p_code_hash: string;
          p_device_name: string;
          p_public_key: string;
          p_token_hash: string;
        };
        Returns: { device_id: string }[];
      };
      nook_review_memory_proposal: {
        Args: {
          p_proposal_id: string;
          p_decision: string;
          p_content?: string | null;
        };
        Returns: string | null;
      };
      nook_claim_free_listing: {
        Args: { p_listing_id: string };
        Returns: string;
      };
      nook_create_checkout_order: {
        Args: { p_listing_id: string; p_owner_id: string };
        Returns: {
          currency: string;
          order_id: string;
          order_item_id: string;
          title: string;
          unit_amount: number;
        }[];
      };
      nook_create_planned_task: {
        Args: {
          p_approval?: Json;
          p_input: string;
          p_nook_id: string;
          p_plan: Json;
          p_risk_class: number;
          p_status: string;
          p_steps: Json;
          p_task_id: string;
        };
        Returns: {
          status: string;
          task_id: string;
        }[];
      };
      nook_claim_task_run: {
        Args: { p_task_id: string };
        Returns: { run_mode: string; task_id: string }[];
      };
      nook_decide_simulated_approval: {
        Args: {
          p_action_hash: string;
          p_approval_id: string;
          p_decision: string;
        };
        Returns: {
          receipt_id: string;
          status: string;
          task_id: string;
        }[];
      };
      nook_get_google_connection_secret: {
        Args: { p_owner_id: string };
        Returns: {
          key_version: number;
          refresh_token_ciphertext: string;
          refresh_token_iv: string;
        }[];
      };
      nook_process_stripe_webhook: {
        Args: { p_event_id: string; p_event_type: string; p_payload: Json };
        Returns: string;
      };
      nook_redeem_device_pairing: {
        Args: {
          p_code_hash: string;
          p_device_name: string;
          p_public_key: string;
          p_token_hash: string;
        };
        Returns: {
          device_id: string;
        }[];
      };
      nook_revoke_google_connection: {
        Args: { p_owner_id: string };
        Returns: undefined;
      };
      nook_store_task_output: {
        Args: {
          p_graph_version: string;
          p_metadata?: Json;
          p_model: string;
          p_prompt_version: string;
          p_result_markdown: string;
          p_summary: string;
          p_task_id: string;
        };
        Returns: string;
      };
      nook_store_google_connection: {
        Args: {
          p_access_token_expires_at: string;
          p_account_email: string;
          p_key_version: number;
          p_owner_id: string;
          p_provider_subject: string;
          p_refresh_token_ciphertext: string;
          p_refresh_token_iv: string;
          p_scopes: string[];
        };
        Returns: undefined;
      };
      nook_store_payment_session: {
        Args: {
          p_expires_at: string;
          p_idempotency_key: string;
          p_order_id: string;
          p_provider_session_id: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
