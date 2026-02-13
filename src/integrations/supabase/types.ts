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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_settings: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          key: string
          updated_at: string | null
          value: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          key: string
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          key?: string
          updated_at?: string | null
          value?: string | null
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          created_at: string | null
          id: string
          product_id: string
          quantity: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id: string
          quantity?: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string
          quantity?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      category_config: {
        Row: {
          category: string
          color: string
          created_at: string | null
          display_name: string
          display_order: number | null
          enquiry_only: boolean | null
          has_date_range: boolean | null
          has_duration: boolean | null
          has_quantity: boolean | null
          icon: string
          id: string
          is_active: boolean | null
          is_negotiable: boolean | null
          is_physical_product: boolean | null
          parent_group: string
          requires_delivery: boolean | null
          requires_preparation: boolean | null
          requires_time_slot: boolean | null
          supports_cart: boolean | null
          updated_at: string | null
        }
        Insert: {
          category: string
          color: string
          created_at?: string | null
          display_name: string
          display_order?: number | null
          enquiry_only?: boolean | null
          has_date_range?: boolean | null
          has_duration?: boolean | null
          has_quantity?: boolean | null
          icon: string
          id?: string
          is_active?: boolean | null
          is_negotiable?: boolean | null
          is_physical_product?: boolean | null
          parent_group: string
          requires_delivery?: boolean | null
          requires_preparation?: boolean | null
          requires_time_slot?: boolean | null
          supports_cart?: boolean | null
          updated_at?: string | null
        }
        Update: {
          category?: string
          color?: string
          created_at?: string | null
          display_name?: string
          display_order?: number | null
          enquiry_only?: boolean | null
          has_date_range?: boolean | null
          has_duration?: boolean | null
          has_quantity?: boolean | null
          icon?: string
          id?: string
          is_active?: boolean | null
          is_negotiable?: boolean | null
          is_physical_product?: boolean | null
          parent_group?: string
          requires_delivery?: boolean | null
          requires_preparation?: boolean | null
          requires_time_slot?: boolean | null
          supports_cart?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          created_at: string | null
          id: string
          message_text: string
          order_id: string
          read_status: boolean | null
          receiver_id: string
          sender_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message_text: string
          order_id: string
          read_status?: boolean | null
          receiver_id: string
          sender_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message_text?: string
          order_id?: string
          read_status?: boolean | null
          receiver_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      device_tokens: {
        Row: {
          created_at: string | null
          id: string
          platform: string
          token: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          platform: string
          token: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          platform?: string
          token?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string | null
          id: string
          seller_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          seller_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          seller_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      featured_items: {
        Row: {
          created_at: string | null
          display_order: number | null
          id: string
          image_url: string | null
          is_active: boolean | null
          link_url: string | null
          reference_id: string
          title: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          link_url?: string | null
          reference_id: string
          title?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          link_url?: string | null
          reference_id?: string
          title?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string | null
          id: string
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          status: string | null
          unit_price: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          order_id: string
          product_id?: string | null
          product_name: string
          quantity?: number
          status?: string | null
          unit_price: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          status?: string | null
          unit_price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          auto_cancel_at: string | null
          buyer_id: string | null
          created_at: string | null
          delivery_address: string | null
          deposit_paid: boolean | null
          deposit_refunded: boolean | null
          id: string
          notes: string | null
          order_type: string | null
          payment_status: string | null
          payment_type: string | null
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          rejection_reason: string | null
          rental_end_date: string | null
          rental_start_date: string | null
          scheduled_date: string | null
          scheduled_time_end: string | null
          scheduled_time_start: string | null
          seller_id: string | null
          status: Database["public"]["Enums"]["order_status"] | null
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          auto_cancel_at?: string | null
          buyer_id?: string | null
          created_at?: string | null
          delivery_address?: string | null
          deposit_paid?: boolean | null
          deposit_refunded?: boolean | null
          id?: string
          notes?: string | null
          order_type?: string | null
          payment_status?: string | null
          payment_type?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          rejection_reason?: string | null
          rental_end_date?: string | null
          rental_start_date?: string | null
          scheduled_date?: string | null
          scheduled_time_end?: string | null
          scheduled_time_start?: string | null
          seller_id?: string | null
          status?: Database["public"]["Enums"]["order_status"] | null
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          auto_cancel_at?: string | null
          buyer_id?: string | null
          created_at?: string | null
          delivery_address?: string | null
          deposit_paid?: boolean | null
          deposit_refunded?: boolean | null
          id?: string
          notes?: string | null
          order_type?: string | null
          payment_status?: string | null
          payment_type?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          rejection_reason?: string | null
          rental_end_date?: string | null
          rental_start_date?: string | null
          scheduled_date?: string | null
          scheduled_time_end?: string | null
          scheduled_time_start?: string | null
          seller_id?: string | null
          status?: Database["public"]["Enums"]["order_status"] | null
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_records: {
        Row: {
          amount: number
          buyer_id: string
          created_at: string | null
          id: string
          net_amount: number | null
          order_id: string
          payment_method: string
          payment_status: string
          platform_fee: number | null
          seller_id: string | null
          transaction_reference: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          buyer_id: string
          created_at?: string | null
          id?: string
          net_amount?: number | null
          order_id: string
          payment_method?: string
          payment_status?: string
          platform_fee?: number | null
          seller_id?: string | null
          transaction_reference?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          buyer_id?: string
          created_at?: string | null
          id?: string
          net_amount?: number | null
          order_id?: string
          payment_method?: string
          payment_status?: string
          platform_fee?: number | null
          seller_id?: string | null
          transaction_reference?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_records_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_records_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          available_slots: Json | null
          category: string
          condition: string | null
          created_at: string | null
          deposit_amount: number | null
          description: string | null
          id: string
          image_url: string | null
          is_available: boolean | null
          is_bestseller: boolean | null
          is_negotiable: boolean | null
          is_recommended: boolean | null
          is_urgent: boolean | null
          is_veg: boolean | null
          listing_type: string | null
          location_required: boolean | null
          max_rental_duration: number | null
          min_rental_duration: number | null
          name: string
          price: number
          rental_period_type: string | null
          seller_id: string
          service_duration_minutes: number | null
          updated_at: string | null
        }
        Insert: {
          available_slots?: Json | null
          category: string
          condition?: string | null
          created_at?: string | null
          deposit_amount?: number | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          is_bestseller?: boolean | null
          is_negotiable?: boolean | null
          is_recommended?: boolean | null
          is_urgent?: boolean | null
          is_veg?: boolean | null
          listing_type?: string | null
          location_required?: boolean | null
          max_rental_duration?: number | null
          min_rental_duration?: number | null
          name: string
          price: number
          rental_period_type?: string | null
          seller_id: string
          service_duration_minutes?: number | null
          updated_at?: string | null
        }
        Update: {
          available_slots?: Json | null
          category?: string
          condition?: string | null
          created_at?: string | null
          deposit_amount?: number | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          is_bestseller?: boolean | null
          is_negotiable?: boolean | null
          is_recommended?: boolean | null
          is_urgent?: boolean | null
          is_veg?: boolean | null
          listing_type?: string | null
          location_required?: boolean | null
          max_rental_duration?: number | null
          min_rental_duration?: number | null
          name?: string
          price?: number
          rental_period_type?: string | null
          seller_id?: string
          service_duration_minutes?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          block: string
          created_at: string | null
          flat_number: string
          id: string
          name: string
          phase: string | null
          phone: string
          society_id: string | null
          updated_at: string | null
          verification_status:
            | Database["public"]["Enums"]["verification_status"]
            | null
        }
        Insert: {
          avatar_url?: string | null
          block: string
          created_at?: string | null
          flat_number: string
          id: string
          name: string
          phase?: string | null
          phone: string
          society_id?: string | null
          updated_at?: string | null
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
        }
        Update: {
          avatar_url?: string | null
          block?: string
          created_at?: string | null
          flat_number?: string
          id?: string
          name?: string
          phase?: string | null
          phone?: string
          society_id?: string | null
          updated_at?: string | null
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_society_id_fkey"
            columns: ["society_id"]
            isOneToOne: false
            referencedRelation: "societies"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          admin_notes: string | null
          created_at: string
          description: string | null
          id: string
          report_type: string
          reported_seller_id: string | null
          reported_user_id: string | null
          reporter_id: string
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          description?: string | null
          id?: string
          report_type: string
          reported_seller_id?: string | null
          reported_user_id?: string | null
          reporter_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          description?: string | null
          id?: string
          report_type?: string
          reported_seller_id?: string | null
          reported_user_id?: string | null
          reporter_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          buyer_id: string | null
          comment: string | null
          created_at: string | null
          hidden_reason: string | null
          id: string
          is_hidden: boolean | null
          order_id: string
          rating: number
          seller_id: string
        }
        Insert: {
          buyer_id?: string | null
          comment?: string | null
          created_at?: string | null
          hidden_reason?: string | null
          id?: string
          is_hidden?: boolean | null
          order_id: string
          rating: number
          seller_id: string
        }
        Update: {
          buyer_id?: string | null
          comment?: string | null
          created_at?: string | null
          hidden_reason?: string | null
          id?: string
          is_hidden?: boolean | null
          order_id?: string
          rating?: number
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_profiles: {
        Row: {
          accepts_cod: boolean | null
          accepts_upi: boolean | null
          availability_end: string | null
          availability_start: string | null
          bank_account_holder: string | null
          bank_account_number: string | null
          bank_ifsc_code: string | null
          business_name: string
          categories: string[]
          cover_image_url: string | null
          created_at: string | null
          description: string | null
          id: string
          is_available: boolean | null
          is_featured: boolean | null
          operating_days: string[] | null
          primary_group: string | null
          profile_image_url: string | null
          rating: number | null
          razorpay_account_id: string | null
          razorpay_onboarding_status: string | null
          society_id: string | null
          total_reviews: number | null
          updated_at: string | null
          upi_id: string | null
          user_id: string
          verification_status:
            | Database["public"]["Enums"]["verification_status"]
            | null
        }
        Insert: {
          accepts_cod?: boolean | null
          accepts_upi?: boolean | null
          availability_end?: string | null
          availability_start?: string | null
          bank_account_holder?: string | null
          bank_account_number?: string | null
          bank_ifsc_code?: string | null
          business_name: string
          categories?: string[]
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_available?: boolean | null
          is_featured?: boolean | null
          operating_days?: string[] | null
          primary_group?: string | null
          profile_image_url?: string | null
          rating?: number | null
          razorpay_account_id?: string | null
          razorpay_onboarding_status?: string | null
          society_id?: string | null
          total_reviews?: number | null
          updated_at?: string | null
          upi_id?: string | null
          user_id: string
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
        }
        Update: {
          accepts_cod?: boolean | null
          accepts_upi?: boolean | null
          availability_end?: string | null
          availability_start?: string | null
          bank_account_holder?: string | null
          bank_account_number?: string | null
          bank_ifsc_code?: string | null
          business_name?: string
          categories?: string[]
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_available?: boolean | null
          is_featured?: boolean | null
          operating_days?: string[] | null
          primary_group?: string | null
          profile_image_url?: string | null
          rating?: number | null
          razorpay_account_id?: string | null
          razorpay_onboarding_status?: string | null
          society_id?: string | null
          total_reviews?: number | null
          updated_at?: string | null
          upi_id?: string | null
          user_id?: string
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "seller_profiles_society_id_fkey"
            columns: ["society_id"]
            isOneToOne: false
            referencedRelation: "societies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      societies: {
        Row: {
          address: string | null
          admin_user_id: string | null
          city: string | null
          created_at: string
          geofence_radius_meters: number | null
          id: string
          invite_code: string | null
          is_active: boolean | null
          is_verified: boolean | null
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          member_count: number | null
          name: string
          pincode: string | null
          rules_text: string | null
          slug: string
          state: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          admin_user_id?: string | null
          city?: string | null
          created_at?: string
          geofence_radius_meters?: number | null
          id?: string
          invite_code?: string | null
          is_active?: boolean | null
          is_verified?: boolean | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          member_count?: number | null
          name: string
          pincode?: string | null
          rules_text?: string | null
          slug: string
          state?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          admin_user_id?: string | null
          city?: string | null
          created_at?: string
          geofence_radius_meters?: number | null
          id?: string
          invite_code?: string | null
          is_active?: boolean | null
          is_verified?: boolean | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          member_count?: number | null
          name?: string
          pincode?: string | null
          rules_text?: string | null
          slug?: string
          state?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "societies_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: []
      }
      warnings: {
        Row: {
          acknowledged_at: string | null
          created_at: string
          id: string
          issued_by: string
          reason: string
          severity: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          created_at?: string
          id?: string
          issued_by: string
          reason: string
          severity?: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string | null
          created_at?: string
          id?: string
          issued_by?: string
          reason?: string
          severity?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warnings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_category_parent_group: { Args: { cat: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      search_marketplace: {
        Args: { search_term: string }
        Returns: {
          availability_end: string
          availability_start: string
          business_name: string
          categories: string[]
          cover_image_url: string
          description: string
          is_available: boolean
          is_featured: boolean
          matching_products: Json
          primary_group: string
          profile_image_url: string
          rating: number
          seller_id: string
          total_reviews: number
          user_id: string
        }[]
      }
    }
    Enums: {
      order_status:
        | "placed"
        | "accepted"
        | "preparing"
        | "ready"
        | "completed"
        | "cancelled"
        | "picked_up"
        | "delivered"
        | "enquired"
        | "quoted"
        | "scheduled"
        | "in_progress"
        | "returned"
      product_category:
        | "home_food"
        | "bakery"
        | "snacks"
        | "groceries"
        | "other"
      service_category:
        | "home_food"
        | "bakery"
        | "snacks"
        | "groceries"
        | "beverages"
        | "tuition"
        | "daycare"
        | "coaching"
        | "yoga"
        | "dance"
        | "music"
        | "art_craft"
        | "language"
        | "fitness"
        | "electrician"
        | "plumber"
        | "carpenter"
        | "ac_service"
        | "pest_control"
        | "appliance_repair"
        | "maid"
        | "cook"
        | "driver"
        | "nanny"
        | "tailoring"
        | "laundry"
        | "beauty"
        | "mehendi"
        | "salon"
        | "tax_consultant"
        | "it_support"
        | "tutoring"
        | "resume_writing"
        | "equipment_rental"
        | "vehicle_rental"
        | "party_supplies"
        | "baby_gear"
        | "furniture"
        | "electronics"
        | "books"
        | "toys"
        | "kitchen"
        | "clothing"
        | "catering"
        | "decoration"
        | "photography"
        | "dj_music"
        | "pet_food"
        | "pet_grooming"
        | "pet_sitting"
        | "dog_walking"
        | "flat_rent"
        | "roommate"
        | "parking"
      user_role: "buyer" | "seller" | "admin"
      verification_status: "pending" | "approved" | "rejected" | "suspended"
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
      order_status: [
        "placed",
        "accepted",
        "preparing",
        "ready",
        "completed",
        "cancelled",
        "picked_up",
        "delivered",
        "enquired",
        "quoted",
        "scheduled",
        "in_progress",
        "returned",
      ],
      product_category: ["home_food", "bakery", "snacks", "groceries", "other"],
      service_category: [
        "home_food",
        "bakery",
        "snacks",
        "groceries",
        "beverages",
        "tuition",
        "daycare",
        "coaching",
        "yoga",
        "dance",
        "music",
        "art_craft",
        "language",
        "fitness",
        "electrician",
        "plumber",
        "carpenter",
        "ac_service",
        "pest_control",
        "appliance_repair",
        "maid",
        "cook",
        "driver",
        "nanny",
        "tailoring",
        "laundry",
        "beauty",
        "mehendi",
        "salon",
        "tax_consultant",
        "it_support",
        "tutoring",
        "resume_writing",
        "equipment_rental",
        "vehicle_rental",
        "party_supplies",
        "baby_gear",
        "furniture",
        "electronics",
        "books",
        "toys",
        "kitchen",
        "clothing",
        "catering",
        "decoration",
        "photography",
        "dj_music",
        "pet_food",
        "pet_grooming",
        "pet_sitting",
        "dog_walking",
        "flat_rent",
        "roommate",
        "parking",
      ],
      user_role: ["buyer", "seller", "admin"],
      verification_status: ["pending", "approved", "rejected", "suspended"],
    },
  },
} as const
