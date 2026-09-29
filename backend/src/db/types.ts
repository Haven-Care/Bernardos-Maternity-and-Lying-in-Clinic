export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      appointment_slots: {
        Row: {
          capacity: number
          created_at: string
          id: string
          is_open: boolean
          slot_time: string
          updated_at: string
          weekday: Database["public"]["Enums"]["weekday"]
        }
        Insert: {
          capacity: number
          created_at?: string
          id?: string
          is_open?: boolean
          slot_time: string
          updated_at?: string
          weekday: Database["public"]["Enums"]["weekday"]
        }
        Update: {
          capacity?: number
          created_at?: string
          id?: string
          is_open?: boolean
          slot_time?: string
          updated_at?: string
          weekday?: Database["public"]["Enums"]["weekday"]
        }
        Relationships: []
      }
      appointments: {
        Row: {
          account_id: string | null
          contact_number: string
          email: string
          id: string
          patient_id: string | null
          patient_name: string
          reason_for_visit: string
          reference_no: string
          scheduled_date: string
          service_id: string
          service_name: string
          slot_time: string
          status: Database["public"]["Enums"]["appointment_status"]
          submitted_at: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          contact_number?: string
          email?: string
          id?: string
          patient_id?: string | null
          patient_name: string
          reason_for_visit?: string
          reference_no?: string
          scheduled_date: string
          service_id: string
          service_name: string
          slot_time: string
          status?: Database["public"]["Enums"]["appointment_status"]
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          contact_number?: string
          email?: string
          id?: string
          patient_id?: string | null
          patient_name?: string
          reason_for_visit?: string
          reference_no?: string
          scheduled_date?: string
          service_id?: string
          service_name?: string
          slot_time?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          submitted_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "patient_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_info: {
        Row: {
          address: string
          email: string
          id: number
          landline: string
          license_no: string
          mobile: string
          name: string
          updated_at: string
          website: string
        }
        Insert: {
          address: string
          email?: string
          id?: number
          landline?: string
          license_no: string
          mobile?: string
          name: string
          updated_at?: string
          website?: string
        }
        Update: {
          address?: string
          email?: string
          id?: number
          landline?: string
          license_no?: string
          mobile?: string
          name?: string
          updated_at?: string
          website?: string
        }
        Relationships: []
      }
      clinic_settings: {
        Row: {
          daily_booking_capacity: number | null
          id: number
          near_expiry_days: number
          reminder_lead_hours: number
          updated_at: string
        }
        Insert: {
          daily_booking_capacity?: number | null
          id?: number
          near_expiry_days?: number
          reminder_lead_hours?: number
          updated_at?: string
        }
        Update: {
          daily_booking_capacity?: number | null
          id?: number
          near_expiry_days?: number
          reminder_lead_hours?: number
          updated_at?: string
        }
        Relationships: []
      }
      medicine_batches: {
        Row: {
          batch_no: string
          created_at: string
          expires_at: string
          id: string
          medicine_id: string
          quantity: number
          received_at: string
          updated_at: string
        }
        Insert: {
          batch_no: string
          created_at?: string
          expires_at: string
          id?: string
          medicine_id: string
          quantity?: number
          received_at?: string
          updated_at?: string
        }
        Update: {
          batch_no?: string
          created_at?: string
          expires_at?: string
          id?: string
          medicine_id?: string
          quantity?: number
          received_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medicine_batches_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicine_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicine_batches_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicines"
            referencedColumns: ["id"]
          },
        ]
      }
      medicines: {
        Row: {
          active: boolean
          brand_name: string
          category: string
          created_at: string
          dosage: string
          dosage_form: Database["public"]["Enums"]["dosage_form"]
          generic_name: string
          id: string
          reorder_level: number
          selling_price: number
          storage_location: string
          supplier_contact: string
          supplier_name: string
          unit: string
          unit_cost: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          brand_name?: string
          category?: string
          created_at?: string
          dosage?: string
          dosage_form: Database["public"]["Enums"]["dosage_form"]
          generic_name: string
          id?: string
          reorder_level?: number
          selling_price?: number
          storage_location?: string
          supplier_contact?: string
          supplier_name?: string
          unit?: string
          unit_cost?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          brand_name?: string
          category?: string
          created_at?: string
          dosage?: string
          dosage_form?: Database["public"]["Enums"]["dosage_form"]
          generic_name?: string
          id?: string
          reorder_level?: number
          selling_price?: number
          storage_location?: string
          supplier_contact?: string
          supplier_name?: string
          unit?: string
          unit_cost?: number
          updated_at?: string
        }
        Relationships: []
      }
      notification_prefs: {
        Row: {
          email_notifications: boolean
          new_booking_alerts: boolean
          profile_id: string
          sms_reminders: boolean
          updated_at: string
        }
        Insert: {
          email_notifications?: boolean
          new_booking_alerts?: boolean
          profile_id: string
          sms_reminders?: boolean
          updated_at?: string
        }
        Update: {
          email_notifications?: boolean
          new_booking_alerts?: boolean
          profile_id?: string
          sms_reminders?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_prefs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          href: string
          id: string
          message: string
          occurred_at: string
          read: boolean
        }
        Insert: {
          href?: string
          id?: string
          message: string
          occurred_at?: string
          read?: boolean
        }
        Update: {
          href?: string
          id?: string
          message?: string
          occurred_at?: string
          read?: boolean
        }
        Relationships: []
      }
      operating_hours: {
        Row: {
          closed: boolean
          closes_at: string | null
          key: Database["public"]["Enums"]["operating_hours_key"]
          label: string
          opens_at: string | null
          updated_at: string
        }
        Insert: {
          closed?: boolean
          closes_at?: string | null
          key: Database["public"]["Enums"]["operating_hours_key"]
          label: string
          opens_at?: string | null
          updated_at?: string
        }
        Update: {
          closed?: boolean
          closes_at?: string | null
          key?: Database["public"]["Enums"]["operating_hours_key"]
          label?: string
          opens_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      patient_accounts: {
        Row: {
          contact_number: string
          created_at: string
          email: string
          email_notifications: boolean
          full_name: string
          id: string
          sms_reminders: boolean
          updated_at: string
        }
        Insert: {
          contact_number?: string
          created_at?: string
          email: string
          email_notifications?: boolean
          full_name: string
          id: string
          sms_reminders?: boolean
          updated_at?: string
        }
        Update: {
          contact_number?: string
          created_at?: string
          email?: string
          email_notifications?: boolean
          full_name?: string
          id?: string
          sms_reminders?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      patient_documents: {
        Row: {
          doc_type: Database["public"]["Enums"]["patient_document_type"]
          file_name: string
          file_size: number
          id: string
          patient_id: string
          storage_path: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          doc_type: Database["public"]["Enums"]["patient_document_type"]
          file_name: string
          file_size: number
          id?: string
          patient_id: string
          storage_path: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          doc_type?: Database["public"]["Enums"]["patient_document_type"]
          file_name?: string
          file_size?: number
          id?: string
          patient_id?: string
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_documents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_documents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          account_id: string | null
          address: string
          allergies: string
          attending_physician: string
          blood_type: Database["public"]["Enums"]["blood_type"] | null
          civil_status: Database["public"]["Enums"]["civil_status"] | null
          contact_number: string
          created_at: string
          date_of_birth: string | null
          email: string
          emergency_contact_name: string
          emergency_contact_number: string
          emergency_contact_relation: string
          expected_delivery_date: string | null
          full_name: string
          gravida: number | null
          id: string
          last_menstrual_period: string | null
          medical_conditions: string
          occupation: string
          para: number | null
          patient_code: string
          sex: Database["public"]["Enums"]["sex"] | null
          updated_at: string
          visit_type: Database["public"]["Enums"]["visit_type"] | null
        }
        Insert: {
          account_id?: string | null
          address?: string
          allergies?: string
          attending_physician?: string
          blood_type?: Database["public"]["Enums"]["blood_type"] | null
          civil_status?: Database["public"]["Enums"]["civil_status"] | null
          contact_number?: string
          created_at?: string
          date_of_birth?: string | null
          email?: string
          emergency_contact_name?: string
          emergency_contact_number?: string
          emergency_contact_relation?: string
          expected_delivery_date?: string | null
          full_name: string
          gravida?: number | null
          id?: string
          last_menstrual_period?: string | null
          medical_conditions?: string
          occupation?: string
          para?: number | null
          patient_code?: string
          sex?: Database["public"]["Enums"]["sex"] | null
          updated_at?: string
          visit_type?: Database["public"]["Enums"]["visit_type"] | null
        }
        Update: {
          account_id?: string | null
          address?: string
          allergies?: string
          attending_physician?: string
          blood_type?: Database["public"]["Enums"]["blood_type"] | null
          civil_status?: Database["public"]["Enums"]["civil_status"] | null
          contact_number?: string
          created_at?: string
          date_of_birth?: string | null
          email?: string
          emergency_contact_name?: string
          emergency_contact_number?: string
          emergency_contact_relation?: string
          expected_delivery_date?: string | null
          full_name?: string
          gravida?: number | null
          id?: string
          last_menstrual_period?: string | null
          medical_conditions?: string
          occupation?: string
          para?: number | null
          patient_code?: string
          sex?: Database["public"]["Enums"]["sex"] | null
          updated_at?: string
          visit_type?: Database["public"]["Enums"]["visit_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "patient_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          contact_number: string
          created_at: string
          email: string
          employee_id: string
          full_name: string
          hired_at: string
          id: string
          last_login_at: string
          password_changed_at: string
          role: Database["public"]["Enums"]["staff_role"]
          status: Database["public"]["Enums"]["staff_status"]
          two_factor_enabled: boolean
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          contact_number?: string
          created_at?: string
          email: string
          employee_id?: string
          full_name: string
          hired_at?: string
          id: string
          last_login_at?: string
          password_changed_at?: string
          role?: Database["public"]["Enums"]["staff_role"]
          status?: Database["public"]["Enums"]["staff_status"]
          two_factor_enabled?: boolean
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          contact_number?: string
          created_at?: string
          email?: string
          employee_id?: string
          full_name?: string
          hired_at?: string
          id?: string
          last_login_at?: string
          password_changed_at?: string
          role?: Database["public"]["Enums"]["staff_role"]
          status?: Database["public"]["Enums"]["staff_status"]
          two_factor_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      reschedule_requests: {
        Row: {
          booking_id: string
          decided_at: string | null
          decided_by: string | null
          id: string
          proposed_date: string
          proposed_time: string
          requested_at: string
          status: Database["public"]["Enums"]["reschedule_request_status"]
        }
        Insert: {
          booking_id: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          proposed_date: string
          proposed_time: string
          requested_at?: string
          status?: Database["public"]["Enums"]["reschedule_request_status"]
        }
        Update: {
          booking_id?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          proposed_date?: string
          proposed_time?: string
          requested_at?: string
          status?: Database["public"]["Enums"]["reschedule_request_status"]
        }
        Relationships: [
          {
            foreignKeyName: "reschedule_requests_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reschedule_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          category: string
          created_at: string
          id: string
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string
          created_at?: string
          id?: string
          name: string
          price: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          id?: string
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          batch_id: string
          created_by: string | null
          id: string
          medicine_id: string
          note: string
          occurred_at: string
          quantity: number
          type: Database["public"]["Enums"]["stock_movement_type"]
        }
        Insert: {
          batch_id: string
          created_by?: string | null
          id?: string
          medicine_id: string
          note?: string
          occurred_at?: string
          quantity: number
          type: Database["public"]["Enums"]["stock_movement_type"]
        }
        Update: {
          batch_id?: string
          created_by?: string | null
          id?: string
          medicine_id?: string
          note?: string
          occurred_at?: string
          quantity?: number
          type?: Database["public"]["Enums"]["stock_movement_type"]
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
            foreignKeyName: "stock_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicine_stock"
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
    }
    Views: {
      appointment_status_counts: {
        Row: {
          count: number | null
          status: Database["public"]["Enums"]["appointment_status"] | null
        }
        Relationships: []
      }
      medicine_stock: {
        Row: {
          active: boolean | null
          brand_name: string | null
          category: string | null
          created_at: string | null
          dosage: string | null
          dosage_form: Database["public"]["Enums"]["dosage_form"] | null
          generic_name: string | null
          id: string | null
          nearest_expiry: string | null
          qty_on_hand: number | null
          reorder_level: number | null
          selling_price: number | null
          stock_status: Database["public"]["Enums"]["stock_status"] | null
          storage_location: string | null
          supplier_contact: string | null
          supplier_name: string | null
          unit: string | null
          unit_cost: number | null
          updated_at: string | null
        }
        Relationships: []
      }
      patient_list: {
        Row: {
          account_id: string | null
          address: string | null
          allergies: string | null
          attending_physician: string | null
          blood_type: Database["public"]["Enums"]["blood_type"] | null
          civil_status: Database["public"]["Enums"]["civil_status"] | null
          contact_number: string | null
          created_at: string | null
          date_of_birth: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_number: string | null
          emergency_contact_relation: string | null
          expected_delivery_date: string | null
          full_name: string | null
          gravida: number | null
          id: string | null
          last_menstrual_period: string | null
          last_visit: string | null
          medical_conditions: string | null
          occupation: string | null
          para: number | null
          patient_code: string | null
          sex: Database["public"]["Enums"]["sex"] | null
          updated_at: string | null
          visit_type: Database["public"]["Enums"]["visit_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "patient_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      assert_rls_posture: { Args: never; Returns: undefined }
      book_appointment: {
        Args: {
          p_account_id: string
          p_contact_number: string
          p_email: string
          p_patient_name: string
          p_reason_for_visit: string
          p_scheduled_date: string
          p_service_id: string
          p_slot_time: unknown
        }
        Returns: {
          account_id: string | null
          contact_number: string
          email: string
          id: string
          patient_id: string | null
          patient_name: string
          reason_for_visit: string
          reference_no: string
          scheduled_date: string
          service_id: string
          service_name: string
          slot_time: string
          status: Database["public"]["Enums"]["appointment_status"]
          submitted_at: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      clinic_today: { Args: never; Returns: string }
      dashboard_stats: {
        Args: never
        Returns: {
          booking_requests: number
          completed_appointments: number
          inventory_alerts: number
          todays_schedule: number
        }[]
      }
      record_stock_in: {
        Args: {
          p_actor: string
          p_batch_no: string
          p_expires_at: string
          p_medicine_id: string
          p_note: string
          p_quantity: number
        }
        Returns: {
          batch_no: string
          created_at: string
          expires_at: string
          id: string
          medicine_id: string
          quantity: number
          received_at: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "medicine_batches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_stock_out: {
        Args: {
          p_actor: string
          p_batch_id: string
          p_note: string
          p_quantity: number
        }
        Returns: {
          batch_no: string
          created_at: string
          expires_at: string
          id: string
          medicine_id: string
          quantity: number
          received_at: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "medicine_batches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      short_date: { Args: { d: string }; Returns: string }
      slot_availability: {
        Args: { target_date: string }
        Returns: {
          available: boolean
          booked: number
          capacity: number
          id: string
          is_open: boolean
          slot_time: string
          weekday: Database["public"]["Enums"]["weekday"]
        }[]
      }
      weekday_of: {
        Args: { d: string }
        Returns: Database["public"]["Enums"]["weekday"]
      }
    }
    Enums: {
      appointment_status:
        | "pending"
        | "confirmed"
        | "rescheduled"
        | "cancelled"
        | "completed"
      blood_type: "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-"
      civil_status: "single" | "married" | "widowed" | "separated"
      dosage_form: "Tablet" | "Capsule" | "Syrup" | "Injection" | "Ointment"
      operating_hours_key:
        | "monday"
        | "tuesday"
        | "wednesday"
        | "thursday"
        | "friday"
        | "saturday"
        | "sunday"
        | "holidays"
      patient_document_type:
        | "valid_id"
        | "lab_results"
        | "ultrasound_report"
        | "marriage_certificate"
        | "previous_hospital_records"
      reschedule_request_status: "pending" | "approved" | "declined"
      sex: "male" | "female"
      staff_role: "administrator" | "staff"
      staff_status: "active" | "inactive"
      stock_movement_type: "stock_in" | "stock_out"
      stock_status: "good" | "low" | "out"
      visit_type: "prenatal" | "delivery" | "postnatal"
      weekday:
        | "monday"
        | "tuesday"
        | "wednesday"
        | "thursday"
        | "friday"
        | "saturday"
        | "sunday"
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
      appointment_status: [
        "pending",
        "confirmed",
        "rescheduled",
        "cancelled",
        "completed",
      ],
      blood_type: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
      civil_status: ["single", "married", "widowed", "separated"],
      dosage_form: ["Tablet", "Capsule", "Syrup", "Injection", "Ointment"],
      operating_hours_key: [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
        "holidays",
      ],
      patient_document_type: [
        "valid_id",
        "lab_results",
        "ultrasound_report",
        "marriage_certificate",
        "previous_hospital_records",
      ],
      reschedule_request_status: ["pending", "approved", "declined"],
      sex: ["male", "female"],
      staff_role: ["administrator", "staff"],
      staff_status: ["active", "inactive"],
      stock_movement_type: ["stock_in", "stock_out"],
      stock_status: ["good", "low", "out"],
      visit_type: ["prenatal", "delivery", "postnatal"],
      weekday: [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ],
    },
  },
} as const

