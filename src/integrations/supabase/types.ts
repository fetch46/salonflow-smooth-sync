export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// SAAS Enums
export type subscription_status = 'trial' | 'active' | 'past_due' | 'canceled' | 'incomplete'
export type user_role = 'owner' | 'admin' | 'manager' | 'staff' | 'viewer' | 'super_admin'
export type plan_interval = 'month' | 'year'
export type organization_status = 'active' | 'suspended' | 'deleted'

export type Database = {
  public: {
    Tables: {
      accounts: {
        Row: {
          account_code: string
          account_name: string
          account_type: string
          balance: number
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          normal_balance: string
          organization_id: string
          parent_account_id: string | null
          updated_at: string
        }
        Insert: {
          account_code: string
          account_name: string
          account_type: string
          balance?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          normal_balance: string
          organization_id: string
          parent_account_id?: string | null
          updated_at?: string
        }
        Update: {
          account_code?: string
          account_name?: string
          account_type?: string
          balance?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          normal_balance?: string
          organization_id?: string
          parent_account_id?: string | null
          updated_at?: string
        }
      }
      account_transactions: {
        Row: {
          account_id: string
          created_at: string
          credit_amount: number
          debit_amount: number
          description: string
          id: string
          reference_id: string | null
          reference_type: string | null
          transaction_date: string
        }
        Insert: {
          account_id: string
          created_at?: string
          credit_amount?: number
          debit_amount?: number
          description: string
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          transaction_date: string
        }
        Update: {
          account_id?: string
          created_at?: string
          credit_amount?: number
          debit_amount?: number
          description?: string
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          transaction_date?: string
        }
      }
      appointments: {
        Row: {
          appointment_date: string
          appointment_time: string
          client_id: string | null
          created_at: string
          duration_minutes: number | null
          id: string
          notes: string | null
          organization_id: string
          service_id: string | null
          staff_id: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          appointment_date: string
          appointment_time: string
          client_id?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          organization_id: string
          service_id?: string | null
          staff_id?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          appointment_date?: string
          appointment_time?: string
          client_id?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          organization_id?: string
          service_id?: string | null
          staff_id?: string | null
          status?: string | null
          updated_at?: string
        }
      }
      clients: {
        Row: {
          address: string | null
          client_status: string | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          full_name: string
          id: string
          last_visit_date: string | null
          notes: string | null
          organization_id: string
          phone: string | null
          preferred_technician_id: string | null
          total_spent: number | null
          total_visits: number | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          client_status?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          full_name: string
          id?: string
          last_visit_date?: string | null
          notes?: string | null
          organization_id: string
          phone?: string | null
          preferred_technician_id?: string | null
          total_spent?: number | null
          total_visits?: number | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          client_status?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          full_name?: string
          id?: string
          last_visit_date?: string | null
          notes?: string | null
          organization_id?: string
          phone?: string | null
          preferred_technician_id?: string | null
          total_spent?: number | null
          total_visits?: number | null
          updated_at?: string
        }
      }
      expenses: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          description: string | null
          expense_date: string
          expense_number: string
          id: string
          organization_id: string
          receipt_url: string | null
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string
          description?: string | null
          expense_date: string
          expense_number: string
          id?: string
          organization_id: string
          receipt_url?: string | null
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          description?: string | null
          expense_date?: string
          expense_number?: string
          id?: string
          organization_id?: string
          receipt_url?: string | null
          supplier_id?: string | null
          updated_at?: string
        }
      }
      inventory_adjustments: {
        Row: {
          adjustment_date: string
          adjustment_number: string
          adjustment_reason: string | null
          adjustment_type: string
          created_at: string
          id: string
          notes: string | null
          organization_id: string
          status: string | null
          updated_at: string
        }
        Insert: {
          adjustment_date: string
          adjustment_number: string
          adjustment_reason?: string | null
          adjustment_type: string
          created_at?: string
          id?: string
          notes?: string | null
          organization_id: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          adjustment_date?: string
          adjustment_number?: string
          adjustment_reason?: string | null
          adjustment_type?: string
          created_at?: string
          id?: string
          notes?: string | null
          organization_id?: string
          status?: string | null
          updated_at?: string
        }
      }
      inventory_adjustment_items: {
        Row: {
          adjustment_id: string
          created_at: string
          id: string
          inventory_item_id: string
          quantity_adjusted: number
          reason: string | null
          updated_at: string
        }
        Insert: {
          adjustment_id: string
          created_at?: string
          id?: string
          inventory_item_id: string
          quantity_adjusted: number
          reason?: string | null
          updated_at?: string
        }
        Update: {
          adjustment_id?: string
          created_at?: string
          id?: string
          inventory_item_id?: string
          quantity_adjusted?: number
          reason?: string | null
          updated_at?: string
        }
      }
      super_admins: {
        Row: {
          created_at: string
          granted_at: string
          granted_by: string | null
          id: string
          is_active: boolean
          permissions: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          is_active?: boolean
          permissions?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          is_active?: boolean
          permissions?: Json
          updated_at?: string
          user_id?: string
        }
      }
      storage_locations: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string
        }
      }
      inventory_items: {
        Row: {
          category: string | null
          cost_price: number | null
          created_at: string
          current_stock: number | null
          description: string | null
          id: string
          is_active: boolean | null
          minimum_stock: number | null
          name: string
          organization_id: string
          selling_price: number | null
          sku: string | null
          type: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          cost_price?: number | null
          created_at?: string
          current_stock?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          minimum_stock?: number | null
          name: string
          organization_id: string
          selling_price?: number | null
          sku?: string | null
          type: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          cost_price?: number | null
          created_at?: string
          current_stock?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          minimum_stock?: number | null
          name?: string
          organization_id?: string
          selling_price?: number | null
          sku?: string | null
          type?: string
          unit?: string | null
          updated_at?: string
        }
      }
      inventory_levels: {
        Row: {
          created_at: string
          id: string
          item_id: string
          location_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          location_id: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          location_id?: string
          quantity?: number
          updated_at?: string
        }
      }
      job_cards: {
        Row: {
          client_id: string | null
          created_at: string
          end_time: string | null
          id: string
          job_number: string
          organization_id: string
          staff_id: string | null
          start_time: string | null
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          end_time?: string | null
          id?: string
          job_number: string
          organization_id: string
          staff_id?: string | null
          start_time?: string | null
          status?: string
          total_amount: number
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          end_time?: string | null
          id?: string
          job_number?: string
          organization_id?: string
          staff_id?: string | null
          start_time?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
      }
      job_card_products: {
        Row: {
          created_at: string
          id: string
          inventory_item_id: string
          job_card_id: string
          quantity_used: number
          total_cost: number
          unit_cost: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          inventory_item_id: string
          job_card_id: string
          quantity_used: number
          total_cost: number
          unit_cost: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          inventory_item_id?: string
          job_card_id?: string
          quantity_used?: number
          total_cost?: number
          unit_cost?: number
          updated_at?: string
        }
      }
      organizations: {
        Row: {
          created_at: string
          domain: string | null
          id: string
          logo_url: string | null
          metadata: Json
          name: string
          settings: Json
          slug: string
          status: organization_status
          updated_at: string
        }
        Insert: {
          created_at?: string
          domain?: string | null
          id?: string
          logo_url?: string | null
          metadata?: Json
          name: string
          settings?: Json
          slug: string
          status?: organization_status
          updated_at?: string
        }
        Update: {
          created_at?: string
          domain?: string | null
          id?: string
          logo_url?: string | null
          metadata?: Json
          name?: string
          settings?: Json
          slug?: string
          status?: organization_status
          updated_at?: string
        }
      }
      organization_subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          interval: plan_interval
          metadata: Json
          organization_id: string
          plan_id: string
          status: subscription_status
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_end: string | null
          trial_start: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          interval?: plan_interval
          metadata?: Json
          organization_id: string
          plan_id: string
          status?: subscription_status
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          interval?: plan_interval
          metadata?: Json
          organization_id?: string
          plan_id?: string
          status?: subscription_status
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string
        }
      }
      organization_users: {
        Row: {
          created_at: string
          id: string
          invited_at: string | null
          invited_by: string | null
          is_active: boolean
          joined_at: string | null
          metadata: Json
          organization_id: string
          role: user_role
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean
          joined_at?: string | null
          metadata?: Json
          organization_id: string
          role?: user_role
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean
          joined_at?: string | null
          metadata?: Json
          organization_id?: string
          role?: user_role
          updated_at?: string
          user_id?: string
        }
      }
      purchases: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          purchase_date: string
          purchase_number: string
          status: string | null
          supplier_id: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          purchase_date: string
          purchase_number: string
          status?: string | null
          supplier_id?: string | null
          total_amount: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          purchase_date?: string
          purchase_number?: string
          status?: string | null
          supplier_id?: string | null
          total_amount?: number
          updated_at?: string
        }
      }
      purchase_items: {
        Row: {
          created_at: string
          id: string
          item_id: string
          purchase_id: string
          quantity: number
          received_quantity: number
          total_cost: number
          unit_cost: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          purchase_id: string
          quantity?: number
          received_quantity?: number
          total_cost?: number
          unit_cost?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          purchase_id?: string
          quantity?: number
          received_quantity?: number
          total_cost?: number
          unit_cost?: number
          updated_at?: string
        }
      }
      sales: {
        Row: {
          created_at: string
          customer_id: string | null
          discount_amount: number | null
          id: string
          organization_id: string
          payment_method: string | null
          sale_date: string
          sale_number: string
          staff_id: string | null
          subtotal: number
          tax_amount: number | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          discount_amount?: number | null
          id?: string
          organization_id: string
          payment_method?: string | null
          sale_date: string
          sale_number: string
          staff_id?: string | null
          subtotal: number
          tax_amount?: number | null
          total_amount: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          discount_amount?: number | null
          id?: string
          organization_id?: string
          payment_method?: string | null
          sale_date?: string
          sale_number?: string
          staff_id?: string | null
          subtotal?: number
          tax_amount?: number | null
          total_amount?: number
          updated_at?: string
        }
      }
      sale_items: {
        Row: {
          created_at: string
          discount_amount: number | null
          id: string
          product_id: string
          quantity: number
          sale_id: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          discount_amount?: number | null
          id?: string
          product_id: string
          quantity: number
          sale_id: string
          unit_price: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          discount_amount?: number | null
          id?: string
          product_id?: string
          quantity?: number
          sale_id?: string
          unit_price?: number
          updated_at?: string
        }
      }
      service_kits: {
        Row: {
          created_at: string
          default_quantity: number
          good_id: string
          id: string
          organization_id: string
          service_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_quantity: number
          good_id: string
          id?: string
          organization_id: string
          service_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_quantity?: number
          good_id?: string
          id?: string
          organization_id?: string
          service_id?: string
          updated_at?: string
        }
      }
      services: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          is_active: boolean
          name: string
          organization_id: string
          price: number
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          duration_minutes: number
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          price: number
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          price?: number
          updated_at?: string
        }
      }
      staff: {
        Row: {
          commission_rate: number | null
          created_at: string
          email: string | null
          full_name: string
          hire_date: string | null
          id: string
          is_active: boolean
          organization_id: string
          phone: string | null
          position: string | null
          profile_image: string | null
          salary: number | null
          specialties: string | null
          updated_at: string
        }
        Insert: {
          commission_rate?: number | null
          created_at?: string
          email?: string | null
          full_name: string
          hire_date?: string | null
          id?: string
          is_active?: boolean
          organization_id: string
          phone?: string | null
          position?: string | null
          profile_image?: string | null
          salary?: number | null
          specialties?: string | null
          updated_at?: string
        }
        Update: {
          commission_rate?: number | null
          created_at?: string
          email?: string | null
          full_name?: string
          hire_date?: string | null
          id?: string
          is_active?: boolean
          organization_id?: string
          phone?: string | null
          position?: string | null
          profile_image?: string | null
          salary?: number | null
          specialties?: string | null
          updated_at?: string
        }
      }
      subscription_plans: {
        Row: {
          created_at: string
          description: string | null
          features: Json
          id: string
          is_active: boolean
          max_locations: number | null
          max_users: number | null
          name: string
          price_monthly: number
          price_yearly: number
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          max_locations?: number | null
          max_users?: number | null
          name: string
          price_monthly: number
          price_yearly: number
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          max_locations?: number | null
          max_users?: number | null
          name?: string
          price_monthly?: number
          price_yearly?: number
          slug?: string
          sort_order?: number
          updated_at?: string
        }
      }
      suppliers: {
        Row: {
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          name: string
          organization_id: string
          payment_terms: string | null
          rating: number | null
          supplier_type: string | null
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name: string
          organization_id: string
          payment_terms?: string | null
          rating?: number | null
          supplier_type?: string | null
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          payment_terms?: string | null
          rating?: number | null
          supplier_type?: string | null
          updated_at?: string
        }
      }
      user_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          organization_id: string
          role: user_role
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by: string
          organization_id: string
          role?: user_role
          token: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          organization_id?: string
          role?: user_role
          token?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_current_user_organization: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      user_has_min_role: {
        Args: {
          min_role: user_role
        }
        Returns: boolean
      }
      user_has_role: {
        Args: {
          required_role: user_role
        }
        Returns: boolean
      }
      is_super_admin: {
        Args: {
          user_uuid?: string
        }
        Returns: boolean
      }
      grant_super_admin: {
        Args: {
          target_user_id: string
        }
        Returns: boolean
      }
      revoke_super_admin: {
        Args: {
          target_user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      organization_status: organization_status
      plan_interval: plan_interval
      subscription_status: subscription_status
      user_role: user_role
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      booking_status: ["pending", "confirmed", "completed", "cancelled"],
      price_range: ["$", "$$", "$$$", "$$$$"],
    },
  },
} as const
