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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          changes: Json | null
          created_at: string
          entity_id: string
          entity_type: string
          id: number
          ip_address: unknown
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changes?: Json | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: never
          ip_address?: unknown
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changes?: Json | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: never
          ip_address?: unknown
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          api_config: Json | null
          code: string
          created_at: string
          created_by: string | null
          default_commission_pct: number
          deleted_at: string | null
          deleted_by: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          api_config?: Json | null
          code: string
          created_at?: string
          created_by?: string | null
          default_commission_pct?: number
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          api_config?: Json | null
          code?: string
          created_at?: string
          created_by?: string | null
          default_commission_pct?: number
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channels_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channels_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channels_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaning_tasks: {
        Row: {
          assigned_to_user_id: string | null
          checklist: Json
          completed_at: string | null
          cost_amount: number | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          estimated_duration_minutes: number | null
          id: string
          notes: string | null
          property_id: string
          reservation_id: string | null
          scheduled_date: string
          scheduled_time: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["cleaning_status"]
          task_number: string
          updated_at: string
          updated_by: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          assigned_to_user_id?: string | null
          checklist?: Json
          completed_at?: string | null
          cost_amount?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          estimated_duration_minutes?: number | null
          id?: string
          notes?: string | null
          property_id: string
          reservation_id?: string | null
          scheduled_date: string
          scheduled_time?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["cleaning_status"]
          task_number?: string
          updated_at?: string
          updated_by?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          assigned_to_user_id?: string | null
          checklist?: Json
          completed_at?: string | null
          cost_amount?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          estimated_duration_minutes?: number | null
          id?: string
          notes?: string | null
          property_id?: string
          reservation_id?: string | null
          scheduled_date?: string
          scheduled_time?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["cleaning_status"]
          task_number?: string
          updated_at?: string
          updated_by?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cleaning_tasks_assigned_to_user_id_fkey"
            columns: ["assigned_to_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaning_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaning_tasks_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaning_tasks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaning_tasks_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaning_tasks_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaning_tasks_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_commissions: {
        Row: {
          agent_id: string
          amount: number
          commission_type: Database["public"]["Enums"]["commission_type"]
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          lead_id: string | null
          notes: string | null
          property_id: string | null
          reservation_id: string | null
          status: Database["public"]["Enums"]["commission_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          agent_id: string
          amount: number
          commission_type: Database["public"]["Enums"]["commission_type"]
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          property_id?: string | null
          reservation_id?: string | null
          status?: Database["public"]["Enums"]["commission_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          agent_id?: string
          amount?: number
          commission_type?: Database["public"]["Enums"]["commission_type"]
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          property_id?: string | null
          reservation_id?: string | null
          status?: Database["public"]["Enums"]["commission_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commercial_commissions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_commissions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_commissions_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_commissions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "commercial_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_commissions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_commissions_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_commissions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_leads: {
        Row: {
          assigned_to: string | null
          city: string | null
          converted_property_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          email: string | null
          estimated_units: number | null
          id: string
          lead_number: string
          notes: string | null
          owner_name: string
          phone: string | null
          property_type: Database["public"]["Enums"]["property_type"] | null
          source: string | null
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assigned_to?: string | null
          city?: string | null
          converted_property_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          estimated_units?: number | null
          id?: string
          lead_number?: string
          notes?: string | null
          owner_name: string
          phone?: string | null
          property_type?: Database["public"]["Enums"]["property_type"] | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assigned_to?: string | null
          city?: string | null
          converted_property_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          estimated_units?: number | null
          id?: string
          lead_number?: string
          notes?: string | null
          owner_name?: string
          phone?: string | null
          property_type?: Database["public"]["Enums"]["property_type"] | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commercial_leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_leads_converted_property_id_fkey"
            columns: ["converted_property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_leads_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_leads_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_reservation_leads: {
        Row: {
          assigned_to: string | null
          check_in: string | null
          check_out: string | null
          converted_reservation_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          email: string | null
          guest_name: string
          guests_count: number | null
          id: string
          lead_number: string
          notes: string | null
          phone: string | null
          property_id: string | null
          source: string | null
          status: Database["public"]["Enums"]["reservation_lead_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assigned_to?: string | null
          check_in?: string | null
          check_out?: string | null
          converted_reservation_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          guest_name: string
          guests_count?: number | null
          id?: string
          lead_number?: string
          notes?: string | null
          phone?: string | null
          property_id?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["reservation_lead_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assigned_to?: string | null
          check_in?: string | null
          check_out?: string | null
          converted_reservation_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          guest_name?: string
          guests_count?: number | null
          id?: string
          lead_number?: string
          notes?: string | null
          phone?: string | null
          property_id?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["reservation_lead_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commercial_reservation_leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_reservation_leads_converted_reservation_id_fkey"
            columns: ["converted_reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_reservation_leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_reservation_leads_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_reservation_leads_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_reservation_leads_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          auto_renew: boolean
          commission_pct: number
          contract_number: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          end_date: string | null
          id: string
          owner_id: string
          payout_schedule: Database["public"]["Enums"]["payout_schedule"]
          property_id: string
          start_date: string
          status: Database["public"]["Enums"]["contract_status"]
          terms: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          auto_renew?: boolean
          commission_pct: number
          contract_number?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          end_date?: string | null
          id?: string
          owner_id: string
          payout_schedule?: Database["public"]["Enums"]["payout_schedule"]
          property_id: string
          start_date: string
          status?: Database["public"]["Enums"]["contract_status"]
          terms?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          auto_renew?: boolean
          commission_pct?: number
          contract_number?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          end_date?: string | null
          id?: string
          owner_id?: string
          payout_schedule?: Database["public"]["Enums"]["payout_schedule"]
          property_id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["contract_status"]
          terms?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category: Database["public"]["Enums"]["document_category"]
          cleaning_task_id: string | null
          contract_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          file_name: string
          file_size_bytes: number | null
          file_url: string
          guest_id: string | null
          id: string
          is_signed: boolean
          maintenance_ticket_id: string | null
          mime_type: string | null
          owner_id: string | null
          owner_payment_id: string | null
          property_id: string | null
          reservation_id: string | null
          signed_at: string | null
          updated_at: string
          updated_by: string | null
          uploaded_by: string | null
        }
        Insert: {
          category: Database["public"]["Enums"]["document_category"]
          cleaning_task_id?: string | null
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          file_name: string
          file_size_bytes?: number | null
          file_url: string
          guest_id?: string | null
          id?: string
          is_signed?: boolean
          maintenance_ticket_id?: string | null
          mime_type?: string | null
          owner_id?: string | null
          owner_payment_id?: string | null
          property_id?: string | null
          reservation_id?: string | null
          signed_at?: string | null
          updated_at?: string
          updated_by?: string | null
          uploaded_by?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["document_category"]
          cleaning_task_id?: string | null
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          file_name?: string
          file_size_bytes?: number | null
          file_url?: string
          guest_id?: string | null
          id?: string
          is_signed?: boolean
          maintenance_ticket_id?: string | null
          mime_type?: string | null
          owner_id?: string | null
          owner_payment_id?: string | null
          property_id?: string | null
          reservation_id?: string | null
          signed_at?: string | null
          updated_at?: string
          updated_by?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_cleaning_task_id_fkey"
            columns: ["cleaning_task_id"]
            isOneToOne: false
            referencedRelation: "cleaning_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_maintenance_ticket_id_fkey"
            columns: ["maintenance_ticket_id"]
            isOneToOne: false
            referencedRelation: "maintenance_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_owner_payment_id_fkey"
            columns: ["owner_payment_id"]
            isOneToOne: false
            referencedRelation: "owner_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          category: Database["public"]["Enums"]["expense_category"]
          contract_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          deleted_by: string | null
          description: string
          expense_date: string
          expense_number: string
          id: string
          notes: string | null
          owner_id: string | null
          payment_method:
            | Database["public"]["Enums"]["payment_method_type"]
            | null
          property_id: string | null
          receipt_url: string | null
          reimbursable_to_owner: boolean
          related_cleaning_task_id: string | null
          related_maintenance_ticket_id: string | null
          reservation_id: string | null
          status: Database["public"]["Enums"]["expense_status"]
          updated_at: string
          updated_by: string | null
          vendor_name: string | null
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          category: Database["public"]["Enums"]["expense_category"]
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description: string
          expense_date: string
          expense_number?: string
          id?: string
          notes?: string | null
          owner_id?: string | null
          payment_method?:
            | Database["public"]["Enums"]["payment_method_type"]
            | null
          property_id?: string | null
          receipt_url?: string | null
          reimbursable_to_owner?: boolean
          related_cleaning_task_id?: string | null
          related_maintenance_ticket_id?: string | null
          reservation_id?: string | null
          status?: Database["public"]["Enums"]["expense_status"]
          updated_at?: string
          updated_by?: string | null
          vendor_name?: string | null
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          category?: Database["public"]["Enums"]["expense_category"]
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string
          expense_date?: string
          expense_number?: string
          id?: string
          notes?: string | null
          owner_id?: string | null
          payment_method?:
            | Database["public"]["Enums"]["payment_method_type"]
            | null
          property_id?: string | null
          receipt_url?: string | null
          reimbursable_to_owner?: boolean
          related_cleaning_task_id?: string | null
          related_maintenance_ticket_id?: string | null
          reservation_id?: string | null
          status?: Database["public"]["Enums"]["expense_status"]
          updated_at?: string
          updated_by?: string | null
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_related_cleaning_task_id_fkey"
            columns: ["related_cleaning_task_id"]
            isOneToOne: false
            referencedRelation: "cleaning_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_related_maintenance_ticket_id_fkey"
            columns: ["related_maintenance_ticket_id"]
            isOneToOne: false
            referencedRelation: "maintenance_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      guests: {
        Row: {
          created_at: string
          created_by: string | null
          date_of_birth: string | null
          deleted_at: string | null
          deleted_by: string | null
          email: string | null
          full_name: string
          id: string
          id_document_number: string | null
          id_document_type:
            | Database["public"]["Enums"]["id_document_type"]
            | null
          id_document_verified_at: string | null
          marketing_opt_in: boolean
          nationality: string | null
          notes: string | null
          phone: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          full_name: string
          id?: string
          id_document_number?: string | null
          id_document_type?:
            | Database["public"]["Enums"]["id_document_type"]
            | null
          id_document_verified_at?: string | null
          marketing_opt_in?: boolean
          nationality?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          full_name?: string
          id?: string
          id_document_number?: string | null
          id_document_type?:
            | Database["public"]["Enums"]["id_document_type"]
            | null
          id_document_verified_at?: string | null
          marketing_opt_in?: boolean
          nationality?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guests_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guests_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          currency: string
          direction: Database["public"]["Enums"]["ledger_direction"]
          entity_id: string
          entity_type: string
          entry_date: string
          id: number
          notes: string | null
          property_id: string | null
          reference_number: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          currency?: string
          direction: Database["public"]["Enums"]["ledger_direction"]
          entity_id: string
          entity_type: string
          entry_date?: string
          id?: never
          notes?: string | null
          property_id?: string | null
          reference_number?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          direction?: Database["public"]["Enums"]["ledger_direction"]
          entity_id?: string
          entity_type?: string
          entry_date?: string
          id?: never
          notes?: string | null
          property_id?: string | null
          reference_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_tickets: {
        Row: {
          actual_cost: number | null
          assigned_to_user_id: string | null
          category: Database["public"]["Enums"]["maintenance_category"]
          cleaning_task_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          estimated_cost: number | null
          id: string
          issue_summary: string
          notes: string | null
          owner_approval_required: boolean
          owner_approved_at: string | null
          owner_approved_by: string | null
          priority: Database["public"]["Enums"]["maintenance_priority"]
          property_id: string
          reported_by: string | null
          reservation_id: string | null
          resolved_at: string | null
          scheduled_date: string | null
          sla_due_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["maintenance_status"]
          ticket_number: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          actual_cost?: number | null
          assigned_to_user_id?: string | null
          category?: Database["public"]["Enums"]["maintenance_category"]
          cleaning_task_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          estimated_cost?: number | null
          id?: string
          issue_summary: string
          notes?: string | null
          owner_approval_required?: boolean
          owner_approved_at?: string | null
          owner_approved_by?: string | null
          priority?: Database["public"]["Enums"]["maintenance_priority"]
          property_id: string
          reported_by?: string | null
          reservation_id?: string | null
          resolved_at?: string | null
          scheduled_date?: string | null
          sla_due_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["maintenance_status"]
          ticket_number?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          actual_cost?: number | null
          assigned_to_user_id?: string | null
          category?: Database["public"]["Enums"]["maintenance_category"]
          cleaning_task_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          estimated_cost?: number | null
          id?: string
          issue_summary?: string
          notes?: string | null
          owner_approval_required?: boolean
          owner_approved_at?: string | null
          owner_approved_by?: string | null
          priority?: Database["public"]["Enums"]["maintenance_priority"]
          property_id?: string
          reported_by?: string | null
          reservation_id?: string | null
          resolved_at?: string | null
          scheduled_date?: string | null
          sla_due_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["maintenance_status"]
          ticket_number?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_tickets_assigned_to_user_id_fkey"
            columns: ["assigned_to_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tickets_cleaning_task_id_fkey"
            columns: ["cleaning_task_id"]
            isOneToOne: false
            referencedRelation: "cleaning_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tickets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tickets_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tickets_owner_approved_by_fkey"
            columns: ["owner_approved_by"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tickets_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tickets_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tickets_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tickets_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          priority: Database["public"]["Enums"]["notification_priority"]
          read_at: string | null
          related_entity_id: string | null
          related_entity_type: string | null
          sent_at: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          body?: string | null
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["notification_priority"]
          read_at?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          sent_at?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          body?: string | null
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["notification_priority"]
          read_at?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          sent_at?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_payments: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          commission_amount: number
          company_commission_pct: number | null
          contract_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          due_date: string | null
          gross_revenue: number
          id: string
          is_manual_adjustment: boolean
          net_amount: number
          net_revenue: number | null
          notes: string | null
          owner_commission_pct: number | null
          owner_id: string
          paid_at: string | null
          payment_method: Database["public"]["Enums"]["payout_method"] | null
          payment_number: string
          payment_reference: string | null
          period_end: string
          period_start: string
          property_id: string | null
          status: Database["public"]["Enums"]["owner_payment_status"]
          total_expenses: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          commission_amount?: number
          company_commission_pct?: number | null
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          due_date?: string | null
          gross_revenue?: number
          id?: string
          is_manual_adjustment?: boolean
          net_amount: number
          net_revenue?: number | null
          notes?: string | null
          owner_commission_pct?: number | null
          owner_id: string
          paid_at?: string | null
          payment_method?: Database["public"]["Enums"]["payout_method"] | null
          payment_number?: string
          payment_reference?: string | null
          period_end: string
          period_start: string
          property_id?: string | null
          status?: Database["public"]["Enums"]["owner_payment_status"]
          total_expenses?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          commission_amount?: number
          company_commission_pct?: number | null
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          due_date?: string | null
          gross_revenue?: number
          id?: string
          is_manual_adjustment?: boolean
          net_amount?: number
          net_revenue?: number | null
          notes?: string | null
          owner_commission_pct?: number | null
          owner_id?: string
          paid_at?: string | null
          payment_method?: Database["public"]["Enums"]["payout_method"] | null
          payment_number?: string
          payment_reference?: string | null
          period_end?: string
          period_start?: string
          property_id?: string | null
          status?: Database["public"]["Enums"]["owner_payment_status"]
          total_expenses?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "owner_payments_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_payments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_payments_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_payments_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_payments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_payments_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      owners: {
        Row: {
          bank_account_holder: string | null
          bank_iban: string | null
          bank_name: string | null
          company_name: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          email: string | null
          full_name: string
          id: string
          notes: string | null
          phone: string | null
          preferred_payout_method: Database["public"]["Enums"]["payout_method"]
          status: Database["public"]["Enums"]["owner_status"]
          tax_id: string | null
          updated_at: string
          updated_by: string | null
          user_id: string | null
        }
        Insert: {
          bank_account_holder?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          phone?: string | null
          preferred_payout_method?: Database["public"]["Enums"]["payout_method"]
          status?: Database["public"]["Enums"]["owner_status"]
          tax_id?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Update: {
          bank_account_holder?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          preferred_payout_method?: Database["public"]["Enums"]["payout_method"]
          status?: Database["public"]["Enums"]["owner_status"]
          tax_id?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "owners_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owners_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owners_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owners_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          deleted_by: string | null
          gateway_reference: string | null
          id: string
          method: Database["public"]["Enums"]["payment_method_type"]
          processed_at: string | null
          reservation_id: string
          status: Database["public"]["Enums"]["payment_status"]
          type: Database["public"]["Enums"]["payment_type"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          deleted_by?: string | null
          gateway_reference?: string | null
          id?: string
          method: Database["public"]["Enums"]["payment_method_type"]
          processed_at?: string | null
          reservation_id: string
          status?: Database["public"]["Enums"]["payment_status"]
          type: Database["public"]["Enums"]["payment_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          deleted_by?: string | null
          gateway_reference?: string | null
          id?: string
          method?: Database["public"]["Enums"]["payment_method_type"]
          processed_at?: string | null
          reservation_id?: string
          status?: Database["public"]["Enums"]["payment_status"]
          type?: Database["public"]["Enums"]["payment_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          acquired_by_agent: string | null
          address_line: string | null
          amenities: Json
          area_sqm: number | null
          assigned_manager_id: string | null
          base_nightly_rate: number | null
          bathrooms: number | null
          bedrooms: number | null
          checkin_instructions: string | null
          city: string
          cleaning_fee: number
          country: string
          created_at: string
          created_by: string | null
          currency: string
          date_activated: string | null
          default_cleaner_id: string | null
          default_security_deposit_amount: number | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          emergency_contact: string | null
          house_rules: string | null
          id: string
          latitude: number | null
          longitude: number | null
          max_guests: number | null
          min_stay_nights: number
          name: string
          postal_code: string | null
          property_type: Database["public"]["Enums"]["property_type"]
          region: string | null
          status: Database["public"]["Enums"]["property_status"]
          updated_at: string
          updated_by: string | null
          wifi_info: string | null
        }
        Insert: {
          acquired_by_agent?: string | null
          address_line?: string | null
          amenities?: Json
          area_sqm?: number | null
          assigned_manager_id?: string | null
          base_nightly_rate?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          checkin_instructions?: string | null
          city: string
          cleaning_fee?: number
          country?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          date_activated?: string | null
          default_cleaner_id?: string | null
          default_security_deposit_amount?: number | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          emergency_contact?: string | null
          house_rules?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          max_guests?: number | null
          min_stay_nights?: number
          name: string
          postal_code?: string | null
          property_type?: Database["public"]["Enums"]["property_type"]
          region?: string | null
          status?: Database["public"]["Enums"]["property_status"]
          updated_at?: string
          updated_by?: string | null
          wifi_info?: string | null
        }
        Update: {
          acquired_by_agent?: string | null
          address_line?: string | null
          amenities?: Json
          area_sqm?: number | null
          assigned_manager_id?: string | null
          base_nightly_rate?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          checkin_instructions?: string | null
          city?: string
          cleaning_fee?: number
          country?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          date_activated?: string | null
          default_cleaner_id?: string | null
          default_security_deposit_amount?: number | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          emergency_contact?: string | null
          house_rules?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          max_guests?: number | null
          min_stay_nights?: number
          name?: string
          postal_code?: string | null
          property_type?: Database["public"]["Enums"]["property_type"]
          region?: string | null
          status?: Database["public"]["Enums"]["property_status"]
          updated_at?: string
          updated_by?: string | null
          wifi_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_acquired_by_agent_fkey"
            columns: ["acquired_by_agent"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_assigned_manager_id_fkey"
            columns: ["assigned_manager_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_default_cleaner_id_fkey"
            columns: ["default_cleaner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      property_owners: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          is_primary: boolean
          owner_id: string
          ownership_pct: number
          property_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_primary?: boolean
          owner_id: string
          ownership_pct?: number
          property_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_primary?: boolean
          owner_id?: string
          ownership_pct?: number
          property_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_owners_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_owners_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_owners_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_owners_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_owners_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_services: {
        Row: {
          completion_date: string | null
          cost_amount: number | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          notes: string | null
          profit: number | null
          provider_id: string | null
          quantity: number
          request_number: string
          requested_date: string
          reservation_id: string
          scheduled_date: string | null
          scheduled_time: string | null
          service_id: string | null
          service_name:
            | Database["public"]["Enums"]["reservation_service_name"]
            | null
          status: Database["public"]["Enums"]["reservation_service_status"]
          total_price: number | null
          unit_price: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          completion_date?: string | null
          cost_amount?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          notes?: string | null
          profit?: number | null
          provider_id?: string | null
          quantity?: number
          request_number?: string
          requested_date?: string
          reservation_id: string
          scheduled_date?: string | null
          scheduled_time?: string | null
          service_id?: string | null
          service_name?:
            | Database["public"]["Enums"]["reservation_service_name"]
            | null
          status?: Database["public"]["Enums"]["reservation_service_status"]
          total_price?: number | null
          unit_price?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          completion_date?: string | null
          cost_amount?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          notes?: string | null
          profit?: number | null
          provider_id?: string | null
          quantity?: number
          request_number?: string
          requested_date?: string
          reservation_id?: string
          scheduled_date?: string | null
          scheduled_time?: string | null
          service_id?: string | null
          service_name?:
            | Database["public"]["Enums"]["reservation_service_name"]
            | null
          status?: Database["public"]["Enums"]["reservation_service_status"]
          total_price?: number | null
          unit_price?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservation_services_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_services_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_services_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_services_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_services_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          adults: number
          cancellation_reason: string | null
          cancelled_at: string | null
          channel_commission_amount: number
          channel_id: string
          check_in_date: string
          check_out_date: string
          children: number
          cleaning_fee_amount: number
          commercial_agent_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          deleted_by: string | null
          guest_id: string
          id: string
          nightly_rate: number
          nights: number | null
          property_id: string
          reservation_code: string
          security_deposit_amount: number
          security_deposit_status: Database["public"]["Enums"]["deposit_status"]
          source_reference: string | null
          special_requests: string | null
          status: Database["public"]["Enums"]["reservation_status"]
          subtotal_amount: number
          total_amount: number
          tourist_tax_amount: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          adults?: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          channel_commission_amount?: number
          channel_id: string
          check_in_date: string
          check_out_date: string
          children?: number
          cleaning_fee_amount?: number
          commercial_agent_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          deleted_by?: string | null
          guest_id: string
          id?: string
          nightly_rate: number
          nights?: number | null
          property_id: string
          reservation_code: string
          security_deposit_amount?: number
          security_deposit_status?: Database["public"]["Enums"]["deposit_status"]
          source_reference?: string | null
          special_requests?: string | null
          status?: Database["public"]["Enums"]["reservation_status"]
          subtotal_amount: number
          total_amount: number
          tourist_tax_amount?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          adults?: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          channel_commission_amount?: number
          channel_id?: string
          check_in_date?: string
          check_out_date?: string
          children?: number
          cleaning_fee_amount?: number
          commercial_agent_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          deleted_by?: string | null
          guest_id?: string
          id?: string
          nightly_rate?: number
          nights?: number | null
          property_id?: string
          reservation_code?: string
          security_deposit_amount?: number
          security_deposit_status?: Database["public"]["Enums"]["deposit_status"]
          source_reference?: string | null
          special_requests?: string | null
          status?: Database["public"]["Enums"]["reservation_status"]
          subtotal_amount?: number
          total_amount?: number
          tourist_tax_amount?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservations_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_commercial_agent_id_fkey"
            columns: ["commercial_agent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      service_providers: {
        Row: {
          company_name: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          email: string | null
          id: string
          internal_notes: string | null
          name: string
          phone: string | null
          pricing_agreement: string | null
          service_categories: Database["public"]["Enums"]["service_category"][]
          status: Database["public"]["Enums"]["provider_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          id?: string
          internal_notes?: string | null
          name: string
          phone?: string | null
          pricing_agreement?: string | null
          service_categories?: Database["public"]["Enums"]["service_category"][]
          status?: Database["public"]["Enums"]["provider_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          id?: string
          internal_notes?: string | null
          name?: string
          phone?: string | null
          pricing_agreement?: string | null
          service_categories?: Database["public"]["Enums"]["service_category"][]
          status?: Database["public"]["Enums"]["provider_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_providers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_providers_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_providers_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          category: Database["public"]["Enums"]["service_category"]
          created_at: string
          created_by: string | null
          default_cost: number
          default_price: number
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          id: string
          is_active: boolean
          legacy_enum_value: string | null
          name: string
          requires_provider: boolean
          requires_scheduling: boolean
          service_code: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["service_category"]
          created_at?: string
          created_by?: string | null
          default_cost?: number
          default_price?: number
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          legacy_enum_value?: string | null
          name: string
          requires_provider?: boolean
          requires_scheduling?: boolean
          service_code?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["service_category"]
          created_at?: string
          created_by?: string | null
          default_cost?: number
          default_price?: number
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          legacy_enum_value?: string | null
          name?: string
          requires_provider?: boolean
          requires_scheduling?: boolean
          service_code?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "services_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean
          last_login_at: string | null
          locale: string
          mfa_enabled: boolean
          password_hash: string | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email: string
          full_name: string
          id: string
          is_active?: boolean
          last_login_at?: string | null
          locale?: string
          mfa_enabled?: boolean
          password_hash?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          locale?: string
          mfa_enabled?: boolean
          password_hash?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      compute_owner_settlement: {
        Args: { p_end: string; p_property_id: string; p_start: string }
        Returns: {
          cleaning_costs: number
          commission_amount: number
          company_commission_pct: number
          concierge_revenue: number
          contract_id: string
          contract_status: string
          expenses: number
          gross_revenue: number
          maintenance_costs: number
          net_amount: number
          net_revenue: number
          occupied_nights: number
          owner_commission_pct: number
          owner_id: string
          property_id: string
          refunds: number
          reservations_count: number
          revenue: number
          total_expenses: number
        }[]
      }
      compute_property_activation_status: {
        Args: { p: Database["public"]["Tables"]["properties"]["Row"] }
        Returns: {
          activation_score: number
          computed_stage: string
          has_active_contract: boolean
          is_ready: boolean
          missing_setup_fields: string[]
          photos_count: number
          photos_required: number
          photos_satisfied: boolean
          pricing_complete: boolean
          setup_complete: boolean
        }[]
      }
      convert_lead_to_owner: {
        Args: { p_lead_id: string }
        Returns: {
          contract_id: string
          owner_id: string
          property_id: string
        }[]
      }
      create_reservation_as_agent: {
        Args: {
          p_adults: number
          p_channel_id: string
          p_check_in_date: string
          p_check_out_date: string
          p_children: number
          p_cleaning_fee_amount: number
          p_guest_name: string
          p_guest_phone: string
          p_nightly_rate: number
          p_property_id: string
          p_reservation_lead_id?: string
          p_subtotal_amount: number
          p_total_amount: number
        }
        Returns: {
          reservation_code: string
          reservation_id: string
        }[]
      }
      current_owner_id: { Args: never; Returns: string }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      generate_owner_settlements: {
        Args: {
          p_due_date?: string
          p_period_end: string
          p_period_start: string
        }
        Returns: {
          generated: boolean
          net_amount: number
          owner_id: string
          property_id: string
        }[]
      }
      get_activation_center_summary: {
        Args: never
        Returns: {
          acquired_by_agent: string
          activation_score: number
          city: string
          computed_stage: string
          days_in_onboarding: number
          has_active_contract: boolean
          is_ready: boolean
          photos_count: number
          photos_satisfied: boolean
          pricing_complete: boolean
          property_id: string
          property_name: string
          setup_complete: boolean
        }[]
      }
      get_activation_funnel_report: {
        Args: {
          p_agent_id?: string
          p_end: string
          p_property_type?: Database["public"]["Enums"]["property_type"]
          p_start: string
        }
        Returns: {
          activation_rate: number
          avg_activation_days: number
          avg_days_to_first_booking: number
          properties_acquired: number
          properties_activated: number
        }[]
      }
      get_commercial_agent_kpis: {
        Args: { p_agent_id: string; p_end: string; p_start: string }
        Returns: {
          activation_rate: number
          commissions_paid: number
          commissions_pending: number
          conversion_rate: number
          leads_lost: number
          leads_total: number
          leads_won: number
          nights_generated: number
          properties_acquired: number
          properties_activated: number
          reservations_generated: number
          revenue_generated: number
        }[]
      }
      get_commercial_leaderboard: {
        Args: { p_end: string; p_start: string }
        Returns: {
          activation_rate: number
          agent_id: string
          agent_name: string
          commissions_earned: number
          conversion_rate: number
          leads_lost: number
          leads_won: number
          nights_generated: number
          properties_acquired: number
          properties_activated: number
          reservations_generated: number
          revenue_generated: number
        }[]
      }
      get_commercial_source_performance: {
        Args: { p_end: string; p_start: string }
        Returns: {
          guest_leads_confirmed: number
          guest_leads_count: number
          owner_leads_count: number
          owner_leads_won: number
          source: string
        }[]
      }
      get_onboarding_dashboard_metrics: {
        Args: { p_end: string; p_start: string }
        Returns: {
          activated_this_period: number
          activation_rate: number
          avg_activation_days: number
          blocked_properties: number
          properties_in_onboarding: number
          ready_to_activate: number
        }[]
      }
      get_outstanding_reservations: {
        Args: { p_end: string; p_start: string }
        Returns: {
          check_in_date: string
          check_out_date: string
          guest_name: string
          net_collected: number
          outstanding: number
          property_name: string
          reservation_code: string
          reservation_id: string
          total_amount: number
        }[]
      }
      get_payments_overview: {
        Args: { p_end: string; p_large_threshold?: number; p_start: string }
        Returns: {
          avg_collection_delay_days: number
          balance_due_today_count: number
          balance_overdue_count: number
          collection_rate: number
          deposits_missing_count: number
          large_outstanding_count: number
          refund_pending_count: number
          total_collected: number
          total_deposits_collected: number
          total_outstanding: number
          total_refunded: number
        }[]
      }
      get_property_activation_status: {
        Args: { p_property_id: string }
        Returns: {
          activation_score: number
          computed_stage: string
          has_active_contract: boolean
          is_ready: boolean
          missing_setup_fields: string[]
          photos_count: number
          photos_required: number
          photos_satisfied: boolean
          pricing_complete: boolean
          setup_complete: boolean
        }[]
      }
      get_reservation_payment_summary: {
        Args: { p_reservation_id: string }
        Returns: {
          balance_paid: number
          collection_rate: number
          deposit_paid: number
          net_collected: number
          outstanding: number
          refunded: number
          reservation_total: number
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_commercial_agent: { Args: never; Returns: boolean }
      is_finance: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      list_archived_items: {
        Args: never
        Returns: {
          archived_at: string
          archived_by: string
          archived_by_name: string
          entity_id: string
          entity_type: string
          label: string
        }[]
      }
      list_staff_user_ids: {
        Args: never
        Returns: {
          id: string
        }[]
      }
      owns_cleaning_task: { Args: { p_task_id: string }; Returns: boolean }
      owns_cleaning_task_by_property: {
        Args: { p_property_id: string }
        Returns: boolean
      }
      owns_maintenance_ticket: {
        Args: { p_ticket_id: string }
        Returns: boolean
      }
      owns_maintenance_ticket_by_property: {
        Args: { p_property_id: string }
        Returns: boolean
      }
      owns_property: { Args: { p_property_id: string }; Returns: boolean }
      owns_reservation: { Args: { p_reservation_id: string }; Returns: boolean }
      report_owner_statement: {
        Args: { p_end: string; p_owner_id: string; p_start: string }
        Returns: {
          amkouy_share: number
          cleaning_costs: number
          commission_pct: number
          concierge_revenue: number
          contract_status: string
          expenses: number
          maintenance_costs: number
          net_revenue: number
          net_revenue_before_costs: number
          occupancy_rate: number
          occupied_nights: number
          owner_payments_total: number
          owner_share: number
          pending_payments_total: number
          refunds: number
          reservations_count: number
          revenue: number
        }[]
      }
      report_owner_statement_timeline: {
        Args: { p_end: string; p_owner_id: string; p_start: string }
        Returns: {
          concierge_revenue: number
          month: string
          reservations_count: number
          revenue: number
        }[]
      }
      report_portfolio_summary: {
        Args: { p_end: string; p_start: string }
        Returns: {
          active_properties: number
          adr: number
          avg_stay: number
          cancelled_reservations: number
          occupancy_rate: number
          total_cleaning_costs: number
          total_concierge_revenue: number
          total_expenses: number
          total_maintenance_costs: number
          total_net_revenue: number
          total_nights: number
          total_owner_payments: number
          total_profit: number
          total_refunds: number
          total_reservations: number
          total_revenue: number
        }[]
      }
      report_portfolio_timeline: {
        Args: { p_end: string; p_start: string }
        Returns: {
          cleaning_tasks_count: number
          concierge_revenue: number
          maintenance_tickets_count: number
          month: string
          nights: number
          owner_payments_total: number
          profit: number
          refunds: number
          reservations_count: number
          revenue: number
        }[]
      }
      report_property_performance: {
        Args: { p_end: string; p_start: string }
        Returns: {
          adr: number
          avg_stay: number
          cancelled_count: number
          city: string
          cleaning_costs: number
          concierge_revenue: number
          contract_status: string
          maintenance_costs: number
          net_revenue: number
          occupancy_rate: number
          owner_payments_total: number
          profit: number
          property_id: string
          property_name: string
          refunds: number
          reservations_count: number
          revenue: number
        }[]
      }
      restore_entity: {
        Args: { p_entity_id: string; p_entity_type: string }
        Returns: undefined
      }
      set_my_locale: { Args: { p_locale: string }; Returns: undefined }
      touch_last_login: { Args: never; Returns: undefined }
    }
    Enums: {
      approval_status: "pending" | "approved" | "rejected"
      cleaning_status:
        | "unassigned"
        | "scheduled"
        | "in_progress"
        | "completed"
        | "verified"
        | "cancelled"
      commission_status: "pending" | "approved" | "paid"
      commission_type: "owner_acquisition" | "reservation_acquisition"
      contract_status:
        | "draft"
        | "active"
        | "expiring_soon"
        | "expired"
        | "terminated"
      deposit_status:
        | "not_collected"
        | "held"
        | "partially_released"
        | "released"
        | "forfeited"
      document_category:
        | "contract"
        | "id_verification"
        | "invoice"
        | "statement"
        | "photo_before"
        | "photo_after"
        | "insurance"
        | "other"
        | "photo_during"
        | "property_photo"
      expense_category:
        | "cleaning"
        | "maintenance"
        | "platform_commission"
        | "utilities"
        | "supplies"
        | "insurance"
        | "tax"
        | "other"
        | "internet"
        | "marketing"
        | "transportation"
        | "concierge_services"
      expense_status: "draft" | "approved" | "paid" | "cancelled"
      id_document_type: "passport" | "national_id" | "other"
      lead_status:
        | "new"
        | "contacted"
        | "visit_scheduled"
        | "proposal_sent"
        | "negotiation"
        | "won"
        | "lost"
      ledger_direction: "credit" | "debit"
      maintenance_category:
        | "plumbing"
        | "electrical"
        | "hvac"
        | "appliance"
        | "structural"
        | "pest_control"
        | "other"
      maintenance_priority: "low" | "normal" | "high" | "urgent"
      maintenance_status:
        | "open"
        | "assigned"
        | "in_progress"
        | "on_hold"
        | "resolved"
        | "closed"
        | "cancelled"
      notification_channel: "in_app" | "push" | "email" | "sms" | "whatsapp"
      notification_priority: "info" | "warning" | "urgent"
      notification_type:
        | "reservation"
        | "payment"
        | "maintenance"
        | "cleaning"
        | "contract"
        | "system"
        | "concierge"
        | "commercial"
        | "onboarding"
      owner_payment_status:
        | "pending"
        | "approved"
        | "processing"
        | "paid"
        | "failed"
        | "cancelled"
      owner_status: "prospect" | "active" | "inactive"
      payment_method_type:
        | "card"
        | "bank_transfer"
        | "cash"
        | "online_gateway"
        | "stripe"
        | "paypal"
        | "pos_terminal"
      payment_status: "pending" | "completed" | "failed" | "cancelled"
      payment_type: "charge" | "deposit_hold" | "deposit_release" | "refund"
      payout_method: "bank_transfer" | "check" | "cash"
      payout_schedule: "weekly" | "biweekly" | "monthly"
      property_status:
        | "onboarding"
        | "active"
        | "maintenance"
        | "inactive"
        | "archived"
      property_type: "villa" | "riad" | "apartment" | "studio" | "other"
      provider_status: "active" | "inactive" | "suspended"
      reservation_lead_status:
        | "new"
        | "offer_sent"
        | "negotiation"
        | "confirmed"
        | "cancelled"
      reservation_service_name:
        | "airport_pickup"
        | "airport_dropoff"
        | "car_rental"
        | "extra_cleaning"
        | "early_check_in"
        | "late_check_out"
        | "laundry"
        | "private_chef"
        | "maid_service"
        | "tours_activities"
      reservation_service_status:
        | "offered"
        | "accepted"
        | "scheduled"
        | "in_progress"
        | "delivered"
        | "cancelled"
        | "refunded"
      reservation_status:
        | "pending"
        | "confirmed"
        | "checked_in"
        | "checked_out"
        | "completed"
        | "cancelled"
        | "no_show"
      service_category:
        | "transport"
        | "hospitality"
        | "experiences"
        | "premium"
        | "custom"
      user_role:
        | "super_admin"
        | "admin"
        | "manager"
        | "accountant"
        | "cleaner"
        | "technician"
        | "owner"
        | "commercial_agent"
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
      approval_status: ["pending", "approved", "rejected"],
      cleaning_status: [
        "unassigned",
        "scheduled",
        "in_progress",
        "completed",
        "verified",
        "cancelled",
      ],
      commission_status: ["pending", "approved", "paid"],
      commission_type: ["owner_acquisition", "reservation_acquisition"],
      contract_status: [
        "draft",
        "active",
        "expiring_soon",
        "expired",
        "terminated",
      ],
      deposit_status: [
        "not_collected",
        "held",
        "partially_released",
        "released",
        "forfeited",
      ],
      document_category: [
        "contract",
        "id_verification",
        "invoice",
        "statement",
        "photo_before",
        "photo_after",
        "insurance",
        "other",
        "photo_during",
        "property_photo",
      ],
      expense_category: [
        "cleaning",
        "maintenance",
        "platform_commission",
        "utilities",
        "supplies",
        "insurance",
        "tax",
        "other",
        "internet",
        "marketing",
        "transportation",
        "concierge_services",
      ],
      expense_status: ["draft", "approved", "paid", "cancelled"],
      id_document_type: ["passport", "national_id", "other"],
      lead_status: [
        "new",
        "contacted",
        "visit_scheduled",
        "proposal_sent",
        "negotiation",
        "won",
        "lost",
      ],
      ledger_direction: ["credit", "debit"],
      maintenance_category: [
        "plumbing",
        "electrical",
        "hvac",
        "appliance",
        "structural",
        "pest_control",
        "other",
      ],
      maintenance_priority: ["low", "normal", "high", "urgent"],
      maintenance_status: [
        "open",
        "assigned",
        "in_progress",
        "on_hold",
        "resolved",
        "closed",
        "cancelled",
      ],
      notification_channel: ["in_app", "push", "email", "sms", "whatsapp"],
      notification_priority: ["info", "warning", "urgent"],
      notification_type: [
        "reservation",
        "payment",
        "maintenance",
        "cleaning",
        "contract",
        "system",
        "concierge",
        "commercial",
        "onboarding",
      ],
      owner_payment_status: [
        "pending",
        "approved",
        "processing",
        "paid",
        "failed",
        "cancelled",
      ],
      owner_status: ["prospect", "active", "inactive"],
      payment_method_type: [
        "card",
        "bank_transfer",
        "cash",
        "online_gateway",
        "stripe",
        "paypal",
        "pos_terminal",
      ],
      payment_status: ["pending", "completed", "failed", "cancelled"],
      payment_type: ["charge", "deposit_hold", "deposit_release", "refund"],
      payout_method: ["bank_transfer", "check", "cash"],
      payout_schedule: ["weekly", "biweekly", "monthly"],
      property_status: [
        "onboarding",
        "active",
        "maintenance",
        "inactive",
        "archived",
      ],
      property_type: ["villa", "riad", "apartment", "studio", "other"],
      provider_status: ["active", "inactive", "suspended"],
      reservation_lead_status: [
        "new",
        "offer_sent",
        "negotiation",
        "confirmed",
        "cancelled",
      ],
      reservation_service_name: [
        "airport_pickup",
        "airport_dropoff",
        "car_rental",
        "extra_cleaning",
        "early_check_in",
        "late_check_out",
        "laundry",
        "private_chef",
        "maid_service",
        "tours_activities",
      ],
      reservation_service_status: [
        "offered",
        "accepted",
        "scheduled",
        "in_progress",
        "delivered",
        "cancelled",
        "refunded",
      ],
      reservation_status: [
        "pending",
        "confirmed",
        "checked_in",
        "checked_out",
        "completed",
        "cancelled",
        "no_show",
      ],
      service_category: [
        "transport",
        "hospitality",
        "experiences",
        "premium",
        "custom",
      ],
      user_role: [
        "super_admin",
        "admin",
        "manager",
        "accountant",
        "cleaner",
        "technician",
        "owner",
        "commercial_agent",
      ],
    },
  },
} as const
