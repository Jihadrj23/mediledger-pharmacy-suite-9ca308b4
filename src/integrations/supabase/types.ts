export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json
          entity: string | null
          entity_id: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json
          entity?: string | null
          entity_id?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json
          entity?: string | null
          entity_id?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          current_due: number
          id: string
          is_demo: boolean
          name: string
          opening_balance: number
          phone: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          current_due?: number
          id?: string
          is_demo?: boolean
          name: string
          opening_balance?: number
          phone?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          current_due?: number
          id?: string
          is_demo?: boolean
          name?: string
          opening_balance?: number
          phone?: string | null
        }
        Relationships: []
      }
      dosage_forms: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      manufacturers: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      medicine_batches: {
        Row: {
          batch_number: string
          created_at: string
          expiry_date: string
          id: string
          is_damaged: boolean
          is_demo: boolean
          medicine_id: string
          mfg_date: string | null
          mrp: number
          original_qty: number
          purchase_price: number
          purchase_ref: string | null
          remaining_qty: number
          selling_price: number
          supplier_id: string | null
        }
        Insert: {
          batch_number: string
          created_at?: string
          expiry_date: string
          id?: string
          is_damaged?: boolean
          is_demo?: boolean
          medicine_id: string
          mfg_date?: string | null
          mrp?: number
          original_qty: number
          purchase_price?: number
          purchase_ref?: string | null
          remaining_qty: number
          selling_price?: number
          supplier_id?: string | null
        }
        Update: {
          batch_number?: string
          created_at?: string
          expiry_date?: string
          id?: string
          is_damaged?: boolean
          is_demo?: boolean
          medicine_id?: string
          mfg_date?: string | null
          mrp?: number
          original_qty?: number
          purchase_price?: number
          purchase_ref?: string | null
          remaining_qty?: number
          selling_price?: number
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medicine_batches_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicine_batches_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      medicines: {
        Row: {
          barcode: string | null
          base_unit: string
          brand_name: string
          category_id: string | null
          created_at: string
          dosage_form_id: string | null
          generic_name: string
          id: string
          is_demo: boolean
          is_divisible: boolean
          manufacturer_id: string | null
          mrp: number
          pack_size: string | null
          pieces_per_strip: number
          price_box: number
          price_piece: number
          price_strip: number
          reorder_level: number
          status: string
          strength: string
          strips_per_box: number
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          base_unit?: string
          brand_name: string
          category_id?: string | null
          created_at?: string
          dosage_form_id?: string | null
          generic_name?: string
          id?: string
          is_demo?: boolean
          is_divisible?: boolean
          manufacturer_id?: string | null
          mrp?: number
          pack_size?: string | null
          pieces_per_strip?: number
          price_box?: number
          price_piece?: number
          price_strip?: number
          reorder_level?: number
          status?: string
          strength?: string
          strips_per_box?: number
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          base_unit?: string
          brand_name?: string
          category_id?: string | null
          created_at?: string
          dosage_form_id?: string | null
          generic_name?: string
          id?: string
          is_demo?: boolean
          is_divisible?: boolean
          manufacturer_id?: string | null
          mrp?: number
          pack_size?: string | null
          pieces_per_strip?: number
          price_box?: number
          price_piece?: number
          price_strip?: number
          reorder_level?: number
          status?: string
          strength?: string
          strips_per_box?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medicines_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicines_dosage_form_id_fkey"
            columns: ["dosage_form_id"]
            isOneToOne: false
            referencedRelation: "dosage_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicines_manufacturer_id_fkey"
            columns: ["manufacturer_id"]
            isOneToOne: false
            referencedRelation: "manufacturers"
            referencedColumns: ["id"]
          },
        ]
      }
      pharmacy_settings: {
        Row: {
          address: string | null
          currency: string
          expiry_alert_days: number
          id: number
          invoice_prefix: string
          language: string
          logo_url: string | null
          low_stock_threshold: number
          max_cashier_discount_percent: number
          pharmacy_name: string
          phone: string | null
          receipt_footer: string | null
          trade_info: string | null
          updated_at: string
          vat_enabled: boolean
          vat_percent: number
        }
        Insert: {
          address?: string | null
          currency?: string
          expiry_alert_days?: number
          id?: number
          invoice_prefix?: string
          language?: string
          logo_url?: string | null
          low_stock_threshold?: number
          max_cashier_discount_percent?: number
          pharmacy_name?: string
          phone?: string | null
          receipt_footer?: string | null
          trade_info?: string | null
          updated_at?: string
          vat_enabled?: boolean
          vat_percent?: number
        }
        Update: {
          address?: string | null
          currency?: string
          expiry_alert_days?: number
          id?: number
          invoice_prefix?: string
          language?: string
          logo_url?: string | null
          low_stock_threshold?: number
          max_cashier_discount_percent?: number
          pharmacy_name?: string
          phone?: string | null
          receipt_footer?: string | null
          trade_info?: string | null
          updated_at?: string
          vat_enabled?: boolean
          vat_percent?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          can_collect_due: boolean
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          max_discount_percent: number
          phone: string | null
          updated_at: string
        }
        Insert: {
          can_collect_due?: boolean
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          is_active?: boolean
          max_discount_percent?: number
          phone?: string | null
          updated_at?: string
        }
        Update: {
          can_collect_due?: boolean
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          max_discount_percent?: number
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          batch_id: string | null
          created_at: string
          created_by: string | null
          direction: string
          id: string
          is_demo: boolean
          medicine_id: string
          note: string | null
          qty_base: number
          reason: string
          reference: string | null
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          created_by?: string | null
          direction: string
          id?: string
          is_demo?: boolean
          medicine_id: string
          note?: string | null
          qty_base: number
          reason: string
          reference?: string | null
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          created_by?: string | null
          direction?: string
          id?: string
          is_demo?: boolean
          medicine_id?: string
          note?: string | null
          qty_base?: number
          reason?: string
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "medicine_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicines"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          created_at: string
          current_payable: number
          id: string
          is_demo: boolean
          name: string
          opening_balance: number
          phone: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          current_payable?: number
          id?: string
          is_demo?: boolean
          name: string
          opening_balance?: number
          phone?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          current_payable?: number
          id?: string
          is_demo?: boolean
          name?: string
          opening_balance?: number
          phone?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_inventory_summary: { Args: never; Returns: Json }
      clear_demo_data: { Args: never; Returns: undefined }
      get_stock_overview: {
        Args: never
        Returns: {
          expired_qty: number
          medicine_id: string
          nearest_expiry: string
          sellable_qty: number
          total_qty: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      log_activity: {
        Args: {
          _action: string
          _details?: Json
          _entity?: string
          _entity_id?: string
        }
        Returns: undefined
      }
      setup_required: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "cashier"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "cashier"],
    },
  },
} as const
