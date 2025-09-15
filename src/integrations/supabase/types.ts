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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      account_transactions: {
        Row: {
          account_id: string
          created_at: string
          credit_amount: number
          debit_amount: number
          description: string | null
          id: string
          location_id: string | null
          reference_id: string | null
          reference_type: string | null
          transaction_date: string
        }
        Insert: {
          account_id: string
          created_at?: string
          credit_amount?: number
          debit_amount?: number
          description?: string | null
          id?: string
          location_id?: string | null
          reference_id?: string | null
          reference_type?: string | null
          transaction_date: string
        }
        Update: {
          account_id?: string
          created_at?: string
          credit_amount?: number
          debit_amount?: number
          description?: string | null
          id?: string
          location_id?: string | null
          reference_id?: string | null
          reference_type?: string | null
          transaction_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_transactions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "business_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_transactions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "storage_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_periods: {
        Row: {
          id: string
          locked_at: string | null
          locked_by: string | null
          organization_id: string
          period_end: string
          period_start: string
          reason: string | null
          status: string
        }
        Insert: {
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          organization_id: string
          period_end: string
          period_start: string
          reason?: string | null
          status?: string
        }
        Update: {
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          organization_id?: string
          period_end?: string
          period_start?: string
          reason?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_periods_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          account_code: string
          account_name: string
          account_subtype: string | null
          account_type: string
          balance: number
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          normal_balance: string | null
          organization_id: string
          parent_account_id: string | null
          updated_at: string
        }
        Insert: {
          account_code: string
          account_name: string
          account_subtype?: string | null
          account_type: string
          balance?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          normal_balance?: string | null
          organization_id: string
          parent_account_id?: string | null
          updated_at?: string
        }
        Update: {
          account_code?: string
          account_name?: string
          account_subtype?: string | null
          account_type?: string
          balance?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          normal_balance?: string | null
          organization_id?: string
          parent_account_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_org_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_parent_fkey"
            columns: ["parent_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_services: {
        Row: {
          appointment_id: string
          commission_percentage: number | null
          created_at: string
          duration_minutes: number | null
          id: string
          notes: string | null
          quantity: number
          service_id: string
          staff_id: string | null
          total_price: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          appointment_id: string
          commission_percentage?: number | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          quantity?: number
          service_id: string
          staff_id?: string | null
          total_price?: number
          unit_price?: number
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          commission_percentage?: number | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          quantity?: number
          service_id?: string
          staff_id?: string | null
          total_price?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          appointment_date: string
          appointment_time: string
          client_id: string | null
          confirmation_email_sent_at: string | null
          confirmation_whatsapp_sent_at: string | null
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          duration_minutes: number | null
          id: string
          location_id: string | null
          notes: string | null
          organization_id: string
          price: number | null
          reminder_email_sent_at: string | null
          reminder_whatsapp_sent_at: string | null
          service_id: string | null
          service_name: string
          staff_id: string | null
          status: string | null
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          appointment_date: string
          appointment_time: string
          client_id?: string | null
          confirmation_email_sent_at?: string | null
          confirmation_whatsapp_sent_at?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          duration_minutes?: number | null
          id?: string
          location_id?: string | null
          notes?: string | null
          organization_id: string
          price?: number | null
          reminder_email_sent_at?: string | null
          reminder_whatsapp_sent_at?: string | null
          service_id?: string | null
          service_name: string
          staff_id?: string | null
          status?: string | null
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          appointment_date?: string
          appointment_time?: string
          client_id?: string | null
          confirmation_email_sent_at?: string | null
          confirmation_whatsapp_sent_at?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          duration_minutes?: number | null
          id?: string
          location_id?: string | null
          notes?: string | null
          organization_id?: string
          price?: number | null
          reminder_email_sent_at?: string | null
          reminder_whatsapp_sent_at?: string | null
          service_id?: string | null
          service_name?: string
          staff_id?: string | null
          status?: string | null
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "business_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "storage_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_reconciliation_matches: {
        Row: {
          account_transaction_id: string
          created_at: string | null
          id: string
          match_amount: number
          reconciliation_id: string
          statement_line_id: string
        }
        Insert: {
          account_transaction_id: string
          created_at?: string | null
          id?: string
          match_amount: number
          reconciliation_id: string
          statement_line_id: string
        }
        Update: {
          account_transaction_id?: string
          created_at?: string | null
          id?: string
          match_amount?: number
          reconciliation_id?: string
          statement_line_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_reconciliation_matches_account_transaction_id_fkey"
            columns: ["account_transaction_id"]
            isOneToOne: false
            referencedRelation: "account_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliation_matches_reconciliation_id_fkey"
            columns: ["reconciliation_id"]
            isOneToOne: false
            referencedRelation: "bank_reconciliations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliation_matches_statement_line_id_fkey"
            columns: ["statement_line_id"]
            isOneToOne: false
            referencedRelation: "bank_statement_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_reconciliations: {
        Row: {
          account_id: string
          ending_balance: number | null
          id: string
          organization_id: string
          period_end: string
          period_start: string
          reconciled_at: string | null
          reconciled_by: string | null
          starting_balance: number | null
          status: Database["public"]["Enums"]["reconciliation_status"]
        }
        Insert: {
          account_id: string
          ending_balance?: number | null
          id?: string
          organization_id: string
          period_end: string
          period_start: string
          reconciled_at?: string | null
          reconciled_by?: string | null
          starting_balance?: number | null
          status?: Database["public"]["Enums"]["reconciliation_status"]
        }
        Update: {
          account_id?: string
          ending_balance?: number | null
          id?: string
          organization_id?: string
          period_end?: string
          period_start?: string
          reconciled_at?: string | null
          reconciled_by?: string | null
          starting_balance?: number | null
          status?: Database["public"]["Enums"]["reconciliation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "bank_reconciliations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_statement_lines: {
        Row: {
          amount: number | null
          balance: number | null
          created_at: string | null
          credit: number | null
          debit: number | null
          description: string | null
          external_reference: string | null
          hash: string | null
          id: string
          line_date: string
          matched: boolean | null
          matched_transaction_id: string | null
          reconciled_at: string | null
          statement_id: string
        }
        Insert: {
          amount?: number | null
          balance?: number | null
          created_at?: string | null
          credit?: number | null
          debit?: number | null
          description?: string | null
          external_reference?: string | null
          hash?: string | null
          id?: string
          line_date: string
          matched?: boolean | null
          matched_transaction_id?: string | null
          reconciled_at?: string | null
          statement_id: string
        }
        Update: {
          amount?: number | null
          balance?: number | null
          created_at?: string | null
          credit?: number | null
          debit?: number | null
          description?: string | null
          external_reference?: string | null
          hash?: string | null
          id?: string
          line_date?: string
          matched?: boolean | null
          matched_transaction_id?: string | null
          reconciled_at?: string | null
          statement_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_statement_lines_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "bank_statements"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_statements: {
        Row: {
          account_id: string
          closing_balance: number | null
          created_at: string | null
          end_date: string
          id: string
          opening_balance: number | null
          organization_id: string
          start_date: string
          statement_name: string
          uploaded_by: string | null
        }
        Insert: {
          account_id: string
          closing_balance?: number | null
          created_at?: string | null
          end_date: string
          id?: string
          opening_balance?: number | null
          organization_id: string
          start_date: string
          statement_name: string
          uploaded_by?: string | null
        }
        Update: {
          account_id?: string
          closing_balance?: number | null
          created_at?: string | null
          end_date?: string
          id?: string
          opening_balance?: number | null
          organization_id?: string
          start_date?: string
          statement_name?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_statements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_transfers: {
        Row: {
          amount: number
          created_at: string | null
          from_account_id: string
          id: string
          organization_id: string
          reference: string | null
          to_account_id: string
          transfer_date: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          from_account_id: string
          id?: string
          organization_id: string
          reference?: string | null
          to_account_id: string
          transfer_date: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          from_account_id?: string
          id?: string
          organization_id?: string
          reference?: string | null
          to_account_id?: string
          transfer_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_transfers_from_account_id_fkey"
            columns: ["from_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transfers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transfers_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_history: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          invoice_url: string | null
          organization_id: string
          paid_at: string | null
          status: string
          subscription_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          invoice_url?: string | null
          organization_id: string
          paid_at?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          invoice_url?: string | null
          organization_id?: string
          paid_at?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      business_listings: {
        Row: {
          category: string | null
          city: string | null
          country: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_featured: boolean
          logo_url: string | null
          name: string
          rating: number | null
          review_count: number | null
          slug: string | null
          updated_at: string
          updated_by: string | null
          website_url: string | null
        }
        Insert: {
          category?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_featured?: boolean
          logo_url?: string | null
          name: string
          rating?: number | null
          review_count?: number | null
          slug?: string | null
          updated_at?: string
          updated_by?: string | null
          website_url?: string | null
        }
        Update: {
          category?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_featured?: boolean
          logo_url?: string | null
          name?: string
          rating?: number | null
          review_count?: number | null
          slug?: string | null
          updated_at?: string
          updated_by?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      business_locations: {
        Row: {
          address: string | null
          code: string | null
          created_at: string
          default_warehouse_id: string | null
          id: string
          is_active: boolean
          is_default: boolean
          manager_id: string | null
          name: string
          organization_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          code?: string | null
          created_at?: string
          default_warehouse_id?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          manager_id?: string | null
          name: string
          organization_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string | null
          created_at?: string
          default_warehouse_id?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          manager_id?: string | null
          name?: string
          organization_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_locations_default_warehouse_id_fkey"
            columns: ["default_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_locations_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_locations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          client_status: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean | null
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
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean | null
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
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          last_visit_date?: string | null
          notes?: string | null
          organization_id?: string
          phone?: string | null
          preferred_technician_id?: string | null
          total_spent?: number | null
          total_visits?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_preferred_technician_id_fkey"
            columns: ["preferred_technician_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      countries: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      currencies: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          symbol: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          symbol: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          symbol?: string
          updated_at?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          description: string
          expense_date: string
          expense_number: string
          id: string
          location_id: string | null
          notes: string | null
          organization_id: string | null
          payment_method: string | null
          receipt_url: string | null
          status: string
          updated_at: string
          vendor_name: string
        }
        Insert: {
          amount?: number
          category?: string | null
          created_at?: string
          description: string
          expense_date: string
          expense_number: string
          id?: string
          location_id?: string | null
          notes?: string | null
          organization_id?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          status?: string
          updated_at?: string
          vendor_name: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          description?: string
          expense_date?: string
          expense_number?: string
          id?: string
          location_id?: string | null
          notes?: string | null
          organization_id?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          status?: string
          updated_at?: string
          vendor_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "business_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "storage_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_received: {
        Row: {
          created_at: string
          created_by: string | null
          grn_number: string | null
          id: string
          location_id: string
          notes: string | null
          organization_id: string
          purchase_id: string
          received_date: string
          warehouse_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          grn_number?: string | null
          id?: string
          location_id: string
          notes?: string | null
          organization_id: string
          purchase_id: string
          received_date?: string
          warehouse_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          grn_number?: string | null
          id?: string
          location_id?: string
          notes?: string | null
          organization_id?: string
          purchase_id?: string
          received_date?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goods_received_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "business_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_received_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "storage_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_received_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_received_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_received_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_received_items: {
        Row: {
          goods_received_id: string
          id: string
          item_id: string
          purchase_item_id: string
          quantity: number
          unit_cost: number
        }
        Insert: {
          goods_received_id: string
          id?: string
          item_id: string
          purchase_item_id: string
          quantity: number
          unit_cost?: number
        }
        Update: {
          goods_received_id?: string
          id?: string
          item_id?: string
          purchase_item_id?: string
          quantity?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "goods_received_items_goods_received_id_fkey"
            columns: ["goods_received_id"]
            isOneToOne: false
            referencedRelation: "goods_received"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_received_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_received_items_purchase_item_id_fkey"
            columns: ["purchase_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_items"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_adjustment_items: {
        Row: {
          adjusted_quantity: number
          adjustment_id: string
          created_at: string
          current_quantity: number
          difference: number
          id: string
          item_id: string
          notes: string | null
          total_cost: number
          unit_cost: number
          updated_at: string
        }
        Insert: {
          adjusted_quantity: number
          adjustment_id: string
          created_at?: string
          current_quantity: number
          difference: number
          id?: string
          item_id: string
          notes?: string | null
          total_cost?: number
          unit_cost?: number
          updated_at?: string
        }
        Update: {
          adjusted_quantity?: number
          adjustment_id?: string
          created_at?: string
          current_quantity?: number
          difference?: number
          id?: string
          item_id?: string
          notes?: string | null
          total_cost?: number
          unit_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_adjustment_items_adjustment_id_fkey"
            columns: ["adjustment_id"]
            isOneToOne: false
            referencedRelation: "inventory_adjustments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_adjustment_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_adjustments: {
        Row: {
          adjustment_date: string
          adjustment_number: string
          adjustment_type: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          id: string
          location_id: string | null
          notes: string | null
          reason: string
          status: string
          total_items: number
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          adjustment_date: string
          adjustment_number: string
          adjustment_type: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          location_id?: string | null
          notes?: string | null
          reason: string
          status?: string
          total_items?: number
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          adjustment_date?: string
          adjustment_number?: string
          adjustment_type?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          location_id?: string | null
          notes?: string | null
          reason?: string
          status?: string
          total_items?: number
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_adjustments_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "business_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_adjustments_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "storage_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_adjustments_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_item_accounts: {
        Row: {
          created_at: string
          id: string
          inventory_account_id: string | null
          is_taxable: boolean
          item_id: string
          purchase_account_id: string | null
          sales_account_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          inventory_account_id?: string | null
          is_taxable?: boolean
          item_id: string
          purchase_account_id?: string | null
          sales_account_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          inventory_account_id?: string | null
          is_taxable?: boolean
          item_id?: string
          purchase_account_id?: string | null
          sales_account_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_inventory_item_accounts_account"
            columns: ["inventory_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_item_accounts_inventory_account_id_fkey"
            columns: ["inventory_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_item_accounts_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_item_accounts_purchase_account_id_fkey"
            columns: ["purchase_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_item_accounts_sales_account_id_fkey"
            columns: ["sales_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          category: string | null
          cost_price: number | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string
          reorder_point: number | null
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
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id: string
          reorder_point?: number | null
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
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string
          reorder_point?: number | null
          selling_price?: number | null
          sku?: string | null
          type?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_levels: {
        Row: {
          created_at: string
          id: string
          item_id: string
          location_id: string
          quantity: number
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          location_id: string
          quantity?: number
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          location_id?: string
          quantity?: number
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_levels_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_levels_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "business_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_levels_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "storage_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_levels_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_transfers: {
        Row: {
          created_at: string
          from_location_id: string
          id: string
          item_id: string
          notes: string | null
          organization_id: string | null
          quantity: number
          to_location_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          from_location_id: string
          id?: string
          item_id: string
          notes?: string | null
          organization_id?: string | null
          quantity: number
          to_location_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          from_location_id?: string
          id?: string
          item_id?: string
          notes?: string | null
          organization_id?: string | null
          quantity?: number
          to_location_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transfers_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "business_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfers_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "storage_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfers_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfers_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "business_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfers_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "storage_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          commission_amount: number | null
          commission_percentage: number | null
          created_at: string
          description: string
          discount_percentage: number | null
          id: string
          invoice_id: string
          location_id: string | null
          product_id: string | null
          quantity: number
          service_id: string | null
          staff_id: string | null
          total_price: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          commission_amount?: number | null
          commission_percentage?: number | null
          created_at?: string
          description: string
          discount_percentage?: number | null
          id?: string
          invoice_id: string
          location_id?: string | null
          product_id?: string | null
          quantity?: number
          service_id?: string | null
          staff_id?: string | null
          total_price?: number
          unit_price?: number
          updated_at?: string
        }
        Update: {
          commission_amount?: number | null
          commission_percentage?: number | null
          created_at?: string
          description?: string
          discount_percentage?: number | null
          id?: string
          invoice_id?: string
          location_id?: string | null
          product_id?: string | null
          quantity?: number
          service_id?: string | null
          staff_id?: string | null
          total_price?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "business_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "storage_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payments: {
        Row: {
          amount: number
          created_at: string
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          id: string
          invoice_id: string
          notes: string | null
          payment_date: string
          payment_method: string
          reference: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          invoice_id: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          reference?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          invoice_id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          reference?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          client_id: string | null
          created_at: string
          due_date: string | null
          id: string
          invoice_number: string
          issue_date: string
          location_id: string | null
          notes: string | null
          organization_id: string | null
          status: string
          subtotal: number
          tax_amount: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_number: string
          issue_date: string
          location_id?: string | null
          notes?: string | null
          organization_id?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_number?: string
          issue_date?: string
          location_id?: string | null
          notes?: string | null
          organization_id?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "business_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "storage_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          quantity_used?: number
          total_cost?: number
          unit_cost?: number
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
        Relationships: [
          {
            foreignKeyName: "job_card_products_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_card_products_job_card_id_fkey"
            columns: ["job_card_id"]
            isOneToOne: false
            referencedRelation: "job_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      job_card_services: {
        Row: {
          commission_amount: number | null
          commission_percentage: number | null
          created_at: string
          duration_minutes: number | null
          id: string
          job_card_id: string
          notes: string | null
          quantity: number
          service_id: string
          staff_id: string | null
          unit_price: number
          updated_at: string
        }
        Insert: {
          commission_amount?: number | null
          commission_percentage?: number | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          job_card_id: string
          notes?: string | null
          quantity?: number
          service_id: string
          staff_id?: string | null
          unit_price?: number
          updated_at?: string
        }
        Update: {
          commission_amount?: number | null
          commission_percentage?: number | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          job_card_id?: string
          notes?: string | null
          quantity?: number
          service_id?: string
          staff_id?: string | null
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_card_services_job_card_id_fkey"
            columns: ["job_card_id"]
            isOneToOne: false
            referencedRelation: "job_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_card_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_card_services_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      job_cards: {
        Row: {
          appointment_id: string | null
          client_id: string | null
          created_at: string
          end_time: string | null
          id: string
          job_card_number: string | null
          job_number: string
          location_id: string | null
          notes: string | null
          organization_id: string
          service_ids: string[] | null
          staff_id: string | null
          start_time: string | null
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          client_id?: string | null
          created_at?: string
          end_time?: string | null
          id?: string
          job_card_number?: string | null
          job_number: string
          location_id?: string | null
          notes?: string | null
          organization_id: string
          service_ids?: string[] | null
          staff_id?: string | null
          start_time?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          client_id?: string | null
          created_at?: string
          end_time?: string | null
          id?: string
          job_card_number?: string | null
          job_number?: string
          location_id?: string | null
          notes?: string | null
          organization_id?: string
          service_ids?: string[] | null
          staff_id?: string | null
          start_time?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_cards_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_cards_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_cards_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "business_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_cards_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "storage_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_cards_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_cards_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_settings: {
        Row: {
          billing_monthly_label: string | null
          billing_yearly_label: string | null
          brand_logo_url: string | null
          brand_name: string | null
          created_at: string
          cta_bottom_primary_link: string | null
          cta_bottom_primary_text: string | null
          cta_bottom_secondary_link: string | null
          cta_bottom_secondary_text: string | null
          cta_primary_link: string | null
          cta_primary_text: string | null
          cta_secondary_link: string | null
          cta_secondary_text: string | null
          cta_section_subtitle: string | null
          cta_section_title: string | null
          extra_features: Json | null
          faq_subtitle: string | null
          faq_title: string | null
          faqs: Json | null
          featured_enabled: boolean | null
          featured_subtitle: string | null
          featured_title: string | null
          features: Json | null
          features_subtitle: string | null
          features_title: string | null
          footer_brand_name: string | null
          footer_columns: Json | null
          footer_description: string | null
          hero_badge_text: string | null
          hero_image_url: string | null
          hero_subtitle: string | null
          hero_title: string | null
          highlights: string[] | null
          id: string
          most_popular_badge_text: string | null
          nav_links: Json | null
          partner_logos: Json | null
          plan_cta_label: string | null
          pricing_copy: string | null
          pricing_title: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          billing_monthly_label?: string | null
          billing_yearly_label?: string | null
          brand_logo_url?: string | null
          brand_name?: string | null
          created_at?: string
          cta_bottom_primary_link?: string | null
          cta_bottom_primary_text?: string | null
          cta_bottom_secondary_link?: string | null
          cta_bottom_secondary_text?: string | null
          cta_primary_link?: string | null
          cta_primary_text?: string | null
          cta_secondary_link?: string | null
          cta_secondary_text?: string | null
          cta_section_subtitle?: string | null
          cta_section_title?: string | null
          extra_features?: Json | null
          faq_subtitle?: string | null
          faq_title?: string | null
          faqs?: Json | null
          featured_enabled?: boolean | null
          featured_subtitle?: string | null
          featured_title?: string | null
          features?: Json | null
          features_subtitle?: string | null
          features_title?: string | null
          footer_brand_name?: string | null
          footer_columns?: Json | null
          footer_description?: string | null
          hero_badge_text?: string | null
          hero_image_url?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          highlights?: string[] | null
          id?: string
          most_popular_badge_text?: string | null
          nav_links?: Json | null
          partner_logos?: Json | null
          plan_cta_label?: string | null
          pricing_copy?: string | null
          pricing_title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          billing_monthly_label?: string | null
          billing_yearly_label?: string | null
          brand_logo_url?: string | null
          brand_name?: string | null
          created_at?: string
          cta_bottom_primary_link?: string | null
          cta_bottom_primary_text?: string | null
          cta_bottom_secondary_link?: string | null
          cta_bottom_secondary_text?: string | null
          cta_primary_link?: string | null
          cta_primary_text?: string | null
          cta_secondary_link?: string | null
          cta_secondary_text?: string | null
          cta_section_subtitle?: string | null
          cta_section_title?: string | null
          extra_features?: Json | null
          faq_subtitle?: string | null
          faq_title?: string | null
          faqs?: Json | null
          featured_enabled?: boolean | null
          featured_subtitle?: string | null
          featured_title?: string | null
          features?: Json | null
          features_subtitle?: string | null
          features_title?: string | null
          footer_brand_name?: string | null
          footer_columns?: Json | null
          footer_description?: string | null
          hero_badge_text?: string | null
          hero_image_url?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          highlights?: string[] | null
          id?: string
          most_popular_badge_text?: string | null
          nav_links?: Json | null
          partner_logos?: Json | null
          plan_cta_label?: string | null
          pricing_copy?: string | null
          pricing_title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string | null
          organization_id: string | null
          read: boolean | null
          title: string
          type: string | null
          updated_at: string
          user_id: string | null
          viewed_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          organization_id?: string | null
          read?: boolean | null
          title: string
          type?: string | null
          updated_at?: string
          user_id?: string | null
          viewed_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          organization_id?: string | null
          read?: boolean | null
          title?: string
          type?: string | null
          updated_at?: string
          user_id?: string | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_modules: {
        Row: {
          controlled_by_plan: boolean | null
          created_at: string
          enabled_at: string | null
          enabled_by: string | null
          id: string
          is_enabled: boolean
          module_name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          controlled_by_plan?: boolean | null
          created_at?: string
          enabled_at?: string | null
          enabled_by?: string | null
          id?: string
          is_enabled?: boolean
          module_name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          controlled_by_plan?: boolean | null
          created_at?: string
          enabled_at?: string | null
          enabled_by?: string | null
          id?: string
          is_enabled?: boolean
          module_name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_modules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_subscriptions: {
        Row: {
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          interval: string | null
          organization_id: string
          plan_id: string | null
          status: string | null
          trial_end: string | null
          trial_start: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          interval?: string | null
          organization_id: string
          plan_id?: string | null
          status?: string | null
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          interval?: string | null
          organization_id?: string
          plan_id?: string | null
          status?: string | null
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_users: {
        Row: {
          created_at: string | null
          id: string
          invitation_accepted_at: string | null
          invitation_sent_at: string | null
          invitation_token: string | null
          invited_at: string | null
          invited_by: string | null
          is_active: boolean | null
          joined_at: string | null
          metadata: Json | null
          organization_id: string
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          invitation_accepted_at?: string | null
          invitation_sent_at?: string | null
          invitation_token?: string | null
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean | null
          joined_at?: string | null
          metadata?: Json | null
          organization_id: string
          role?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          invitation_accepted_at?: string | null
          invitation_sent_at?: string | null
          invitation_token?: string | null
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean | null
          joined_at?: string | null
          metadata?: Json | null
          organization_id?: string
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_users_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_users_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      organizations: {
        Row: {
          country_id: string | null
          created_at: string | null
          currency_id: string | null
          domain: string | null
          id: string
          logo_url: string | null
          metadata: Json | null
          name: string
          settings: Json | null
          slug: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          country_id?: string | null
          created_at?: string | null
          currency_id?: string | null
          domain?: string | null
          id?: string
          logo_url?: string | null
          metadata?: Json | null
          name: string
          settings?: Json | null
          slug: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          country_id?: string | null
          created_at?: string | null
          currency_id?: string | null
          domain?: string | null
          id?: string
          logo_url?: string | null
          metadata?: Json | null
          name?: string
          settings?: Json | null
          slug?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          business_address: string | null
          business_email: string | null
          business_name: string | null
          business_phone: string | null
          created_at: string
          email: string | null
          email_confirmed_at: string | null
          full_name: string | null
          id: string
          is_active: boolean | null
          phone: string | null
          role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          business_address?: string | null
          business_email?: string | null
          business_name?: string | null
          business_phone?: string | null
          created_at?: string
          email?: string | null
          email_confirmed_at?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          phone?: string | null
          role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          business_address?: string | null
          business_email?: string | null
          business_name?: string | null
          business_phone?: string | null
          created_at?: string
          email?: string | null
          email_confirmed_at?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          phone?: string | null
          role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
        Relationships: [
          {
            foreignKeyName: "purchase_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_payments: {
        Row: {
          account_id: string | null
          amount: number
          created_at: string
          id: string
          notes: string | null
          organization_id: string | null
          payment_date: string
          purchase_id: string
          reference: string | null
        }
        Insert: {
          account_id?: string | null
          amount: number
          created_at?: string
          id?: string
          notes?: string | null
          organization_id?: string | null
          payment_date?: string
          purchase_id: string
          reference?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          organization_id?: string | null
          payment_date?: string
          purchase_id?: string
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_payments_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          created_at: string
          id: string
          location_id: string | null
          notes: string | null
          purchase_date: string
          purchase_number: string
          status: string
          subtotal: number
          tax_amount: number
          total_amount: number
          updated_at: string
          vendor_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          location_id?: string | null
          notes?: string | null
          purchase_date: string
          purchase_number: string
          status?: string
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          updated_at?: string
          vendor_name: string
        }
        Update: {
          created_at?: string
          id?: string
          location_id?: string | null
          notes?: string | null
          purchase_date?: string
          purchase_number?: string
          status?: string
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          updated_at?: string
          vendor_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "business_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "storage_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_items: {
        Row: {
          created_at: string
          id: string
          product_id: string | null
          quantity: number
          receipt_id: string
          service_id: string | null
          total_price: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id?: string | null
          quantity?: number
          receipt_id: string
          service_id?: string | null
          total_price?: number
          unit_price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string | null
          quantity?: number
          receipt_id?: string
          service_id?: string | null
          total_price?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: []
      }
      receipt_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          location_id: string | null
          method: string
          notes: string | null
          organization_id: string
          payment_date: string
          receipt_id: string
          reference: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          location_id?: string | null
          method?: string
          notes?: string | null
          organization_id: string
          payment_date?: string
          receipt_id: string
          reference?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          location_id?: string | null
          method?: string
          notes?: string | null
          organization_id?: string
          payment_date?: string
          receipt_id?: string
          reference?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      receipts: {
        Row: {
          amount_paid: number
          client_id: string | null
          created_at: string
          id: string
          location_id: string | null
          notes: string | null
          organization_id: string
          payment_method: string | null
          receipt_number: string
          status: string
          subtotal: number
          tax_amount: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          client_id?: string | null
          created_at?: string
          id?: string
          location_id?: string | null
          notes?: string | null
          organization_id: string
          payment_method?: string | null
          receipt_number: string
          status?: string
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          client_id?: string | null
          created_at?: string
          id?: string
          location_id?: string | null
          notes?: string | null
          organization_id?: string
          payment_method?: string | null
          receipt_number?: string
          status?: string
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      report_definitions: {
        Row: {
          category: string
          config: Json
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          key: string
          name: string
          updated_at: string
        }
        Insert: {
          category?: string
          config?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          key: string
          name: string
          updated_at?: string
        }
        Update: {
          category?: string
          config?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          key?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      report_favorites: {
        Row: {
          created_at: string
          id: string
          report_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          report_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          report_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_favorites_report_key_fkey"
            columns: ["report_key"]
            isOneToOne: false
            referencedRelation: "report_definitions"
            referencedColumns: ["key"]
          },
        ]
      }
      report_runs: {
        Row: {
          created_at: string
          duration_ms: number | null
          id: string
          location_id: string | null
          organization_id: string | null
          params: Json
          period_end: string | null
          period_start: string | null
          report_key: string
          result: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          id?: string
          location_id?: string | null
          organization_id?: string | null
          params?: Json
          period_end?: string | null
          period_start?: string | null
          report_key: string
          result?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          id?: string
          location_id?: string | null
          organization_id?: string | null
          params?: Json
          period_end?: string | null
          period_start?: string | null
          report_key?: string
          result?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_runs_report_key_fkey"
            columns: ["report_key"]
            isOneToOne: false
            referencedRelation: "report_definitions"
            referencedColumns: ["key"]
          },
        ]
      }
      service_categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      service_kits: {
        Row: {
          created_at: string
          default_quantity: number | null
          good_id: string
          id: string
          organization_id: string
          quantity: number
          service_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_quantity?: number | null
          good_id: string
          id?: string
          organization_id: string
          quantity?: number
          service_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_quantity?: number | null
          good_id?: string
          id?: string
          organization_id?: string
          quantity?: number
          service_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_kits_good_id_fkey"
            columns: ["good_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_kits_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_kits_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          category: string | null
          commission_percentage: number | null
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          income_account_id: string | null
          is_active: boolean | null
          location_id: string | null
          name: string
          organization_id: string
          price: number
          updated_at: string
        }
        Insert: {
          category?: string | null
          commission_percentage?: number | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          income_account_id?: string | null
          is_active?: boolean | null
          location_id?: string | null
          name: string
          organization_id: string
          price: number
          updated_at?: string
        }
        Update: {
          category?: string | null
          commission_percentage?: number | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          income_account_id?: string | null
          is_active?: boolean | null
          location_id?: string | null
          name?: string
          organization_id?: string
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_income_account_id_fkey"
            columns: ["income_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "business_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "storage_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          commission_rate: number | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean | null
          organization_id: string
          phone: string | null
          specialties: string[] | null
          updated_at: string
        }
        Insert: {
          commission_rate?: number | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean | null
          organization_id: string
          phone?: string | null
          specialties?: string[] | null
          updated_at?: string
        }
        Update: {
          commission_rate?: number | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          organization_id?: string
          phone?: string | null
          specialties?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_commissions: {
        Row: {
          accrued_date: string | null
          commission_amount: number
          commission_percentage: number | null
          commission_rate: number
          created_at: string
          gross_amount: number
          id: string
          invoice_id: string | null
          invoice_item_id: string | null
          job_card_id: string | null
          job_card_service_id: string | null
          paid_date: string | null
          payment_reference: string | null
          service_id: string | null
          staff_id: string | null
          status: string | null
        }
        Insert: {
          accrued_date?: string | null
          commission_amount?: number
          commission_percentage?: number | null
          commission_rate?: number
          created_at?: string
          gross_amount?: number
          id?: string
          invoice_id?: string | null
          invoice_item_id?: string | null
          job_card_id?: string | null
          job_card_service_id?: string | null
          paid_date?: string | null
          payment_reference?: string | null
          service_id?: string | null
          staff_id?: string | null
          status?: string | null
        }
        Update: {
          accrued_date?: string | null
          commission_amount?: number
          commission_percentage?: number | null
          commission_rate?: number
          created_at?: string
          gross_amount?: number
          id?: string
          invoice_id?: string | null
          invoice_item_id?: string | null
          job_card_id?: string | null
          job_card_service_id?: string | null
          paid_date?: string | null
          payment_reference?: string | null
          service_id?: string | null
          staff_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_staff_commissions_invoice_item"
            columns: ["invoice_item_id"]
            isOneToOne: false
            referencedRelation: "invoice_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_commissions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_commissions_job_card_id_fkey"
            columns: ["job_card_id"]
            isOneToOne: false
            referencedRelation: "job_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_commissions_job_card_service_id_fkey"
            columns: ["job_card_service_id"]
            isOneToOne: true
            referencedRelation: "job_card_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_commissions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_commissions_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_default_locations: {
        Row: {
          created_at: string
          location_id: string
          staff_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          location_id: string
          staff_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          location_id?: string
          staff_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_default_locations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "business_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_default_locations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "storage_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_default_locations_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: true
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_roles: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_system_role: boolean
          organization_id: string
          permissions: Json
          role_description: string | null
          role_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_system_role?: boolean
          organization_id: string
          permissions?: Json
          role_description?: string | null
          role_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_system_role?: boolean
          organization_id?: string
          permissions?: Json
          role_description?: string | null
          role_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_locations_base: {
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
        Relationships: []
      }
      subscription_plan_modules: {
        Row: {
          created_at: string
          id: string
          is_enabled: boolean
          module_name: string
          plan_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          module_name: string
          plan_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          module_name?: string
          plan_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_plan_modules_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string | null
          description: string | null
          features: Json | null
          id: string
          is_active: boolean | null
          max_locations: number | null
          max_users: number | null
          name: string
          price_monthly: number
          price_yearly: number
          slug: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          max_locations?: number | null
          max_users?: number | null
          name: string
          price_monthly: number
          price_yearly: number
          slug: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          max_locations?: number | null
          max_users?: number | null
          name?: string
          price_monthly?: number
          price_yearly?: number
          slug?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      super_admins: {
        Row: {
          created_at: string
          granted_at: string
          granted_by: string | null
          id: string
          is_active: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string | null
          city: string | null
          contact_person: string | null
          country: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          organization_id: string
          payment_terms: string | null
          phone: string | null
          postal_code: string | null
          state: string | null
          tax_id: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          organization_id: string
          payment_terms?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          tax_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          organization_id?: string
          payment_terms?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          tax_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          app_name: string | null
          created_at: string
          default_plan_slug: string
          features: Json
          id: string
          maintenance_mode: boolean
          metadata: Json
          regional_formats_enabled: boolean
          support_email: string
          updated_at: string
        }
        Insert: {
          app_name?: string | null
          created_at?: string
          default_plan_slug?: string
          features?: Json
          id?: string
          maintenance_mode?: boolean
          metadata?: Json
          regional_formats_enabled?: boolean
          support_email?: string
          updated_at?: string
        }
        Update: {
          app_name?: string | null
          created_at?: string
          default_plan_slug?: string
          features?: Json
          id?: string
          maintenance_mode?: boolean
          metadata?: Json
          regional_formats_enabled?: boolean
          support_email?: string
          updated_at?: string
        }
        Relationships: []
      }
      tax_rates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          organization_id: string
          rate: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          organization_id: string
          rate?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          organization_id?: string
          rate?: number
          updated_at?: string
        }
        Relationships: []
      }
      template_settings: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          organization_id: string
          template_content: Json
          template_name: string
          template_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          organization_id: string
          template_content?: Json
          template_name: string
          template_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          organization_id?: string
          template_content?: Json
          template_name?: string
          template_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_number_series: {
        Row: {
          created_at: string
          current_number: number
          format_template: string
          id: string
          is_active: boolean
          organization_id: string
          padding_length: number
          prefix: string | null
          suffix: string | null
          transaction_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_number?: number
          format_template?: string
          id?: string
          is_active?: boolean
          organization_id: string
          padding_length?: number
          prefix?: string | null
          suffix?: string | null
          transaction_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_number?: number
          format_template?: string
          id?: string
          is_active?: boolean
          organization_id?: string
          padding_length?: number
          prefix?: string | null
          suffix?: string | null
          transaction_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_number_series_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      unearned_revenue_transactions: {
        Row: {
          amount: number
          appointment_id: string | null
          created_at: string
          description: string | null
          earned_date: string | null
          id: string
          job_card_id: string | null
          organization_id: string
          reference_id: string | null
          reference_type: string | null
          status: string
          transaction_date: string
          updated_at: string
        }
        Insert: {
          amount?: number
          appointment_id?: string | null
          created_at?: string
          description?: string | null
          earned_date?: string | null
          id?: string
          job_card_id?: string | null
          organization_id: string
          reference_id?: string | null
          reference_type?: string | null
          status?: string
          transaction_date?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          appointment_id?: string | null
          created_at?: string
          description?: string | null
          earned_date?: string | null
          id?: string
          job_card_id?: string | null
          organization_id?: string
          reference_id?: string | null
          reference_type?: string | null
          status?: string
          transaction_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "unearned_revenue_transactions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unearned_revenue_transactions_job_card_id_fkey"
            columns: ["job_card_id"]
            isOneToOne: false
            referencedRelation: "job_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unearned_revenue_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          role: string
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by: string
          organization_id: string
          role?: string
          token: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          organization_id?: string
          role?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          location_id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          location_id: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          location_id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "business_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouses_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "storage_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      storage_locations: {
        Row: {
          created_at: string | null
          id: string | null
          is_active: boolean | null
          name: string | null
          organization_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          organization_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          organization_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_locations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _lov_refresh_types_marker: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      calculate_staff_commission: {
        Args: {
          p_amount?: number
          p_commission_rate?: number
          p_service_id?: string
          p_staff_id: string
        }
        Returns: number
      }
      calculate_trial_balance: {
        Args: { p_date?: string; p_org_id: string }
        Returns: {
          account_code: string
          account_id: string
          account_name: string
          balance: number
          credit_total: number
          debit_total: number
        }[]
      }
      create_goods_received: {
        Args: {
          p_items?: Json
          p_location_id: string
          p_notes?: string
          p_organization_id: string
          p_purchase_id: string
          p_received_date?: string
        }
        Returns: string
      }
      create_organization_with_user: {
        Args: {
          org_name: string
          org_settings?: Json
          org_slug: string
          plan_id?: string
        }
        Returns: string
      }
      delete_account_transactions_by_reference: {
        Args: { p_reference_id: string; p_reference_type: string }
        Returns: number
      }
      generate_grn_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_job_number: {
        Args: { p_organization_id: string }
        Returns: string
      }
      get_next_transaction_number: {
        Args: { p_organization_id: string; p_transaction_type: string }
        Returns: string
      }
      get_user_organization_count: {
        Args: { user_uuid: string }
        Returns: number
      }
      grant_super_admin: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      is_admin_of_organization: {
        Args: { org_id: string }
        Returns: boolean
      }
      is_date_locked: {
        Args: { p_date: string; p_org: string }
        Returns: boolean
      }
      is_member_of_organization: {
        Args: { org_id: string }
        Returns: boolean
      }
      is_super_admin: {
        Args: Record<PropertyKey, never> | { uid: string }
        Returns: boolean
      }
      pay_purchase: {
        Args: {
          p_account_id: string
          p_amount: number
          p_notes: string
          p_org_id: string
          p_payment_date: string
          p_purchase_id: string
          p_reference: string
        }
        Returns: string
      }
      pay_staff_commission: {
        Args: {
          p_bank_account_id?: string
          p_commission_id: string
          p_payment_date?: string
          p_payment_reference?: string
        }
        Returns: boolean
      }
      post_bank_transfer: {
        Args: {
          p_amount: number
          p_description?: string
          p_from_account_id: string
          p_org_id: string
          p_to_account_id: string
          p_transfer_date?: string
        }
        Returns: boolean
      }
      rebuild_organization_chart_of_accounts: {
        Args: { p_force?: boolean; p_organization_id: string }
        Returns: Json
      }
      record_goods_received: {
        Args:
          | {
              p_lines: Json
              p_location_id: string
              p_notes: string
              p_org_id: string
              p_purchase_id: string
              p_received_date: string
            }
          | {
              p_lines: Json
              p_location_id: string
              p_notes: string
              p_org_id: string
              p_purchase_id: string
              p_received_date: string
              p_warehouse_id: string
            }
        Returns: string
      }
      revoke_super_admin: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      schedule_appointment_no_show_update: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      setup_new_organization: {
        Args: { org_id: string }
        Returns: boolean
      }
      update_goods_received: {
        Args:
          | {
              p_goods_received_id: string
              p_location_id: string
              p_notes: string
              p_org_id: string
              p_quantities: Json
              p_received_date: string
            }
          | {
              p_goods_received_id: string
              p_location_id: string
              p_notes: string
              p_org_id: string
              p_quantities: Json
              p_received_date: string
              p_warehouse_id: string
            }
        Returns: undefined
      }
      update_purchase_status: {
        Args: { p_purchase_id: string }
        Returns: undefined
      }
      user_has_organization: {
        Args: { user_uuid: string }
        Returns: boolean
      }
    }
    Enums: {
      booking_status: "pending" | "confirmed" | "completed" | "cancelled"
      price_range: "$" | "$$" | "$$$" | "$$$$"
      reconciliation_status: "open" | "reconciled" | "locked"
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
      reconciliation_status: ["open", "reconciled", "locked"],
    },
  },
} as const
