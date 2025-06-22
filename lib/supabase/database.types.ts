export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          role: "individual" | "advisor"
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          role?: "individual" | "advisor"
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          role?: "individual" | "advisor"
          created_at?: string
          updated_at?: string
        }
      }
      accounts: {
        Row: {
          id: string
          user_id: string
          name: string
          broker_name: string | null
          account_number: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          broker_name?: string | null
          account_number?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          broker_name?: string | null
          account_number?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      portfolios: {
        Row: {
          id: string
          account_id: string
          name: string
          cash: number
          total_equity: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          account_id: string
          name: string
          cash?: number
          total_equity?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          account_id?: string
          name?: string
          cash?: number
          total_equity?: number
          created_at?: string
          updated_at?: string
        }
      }
      positions: {
        Row: {
          id: string
          portfolio_id: string
          symbol: string
          status: "PUT" | "STOCK" | "CALL"
          quantity: number
          cost_basis: number | null
          current_price: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          portfolio_id: string
          symbol: string
          status: "PUT" | "STOCK" | "CALL"
          quantity: number
          cost_basis?: number | null
          current_price?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          portfolio_id?: string
          symbol?: string
          status?: "PUT" | "STOCK" | "CALL"
          quantity?: number
          cost_basis?: number | null
          current_price?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      legs: {
        Row: {
          id: string
          position_id: string
          side: "SELL" | "BUY"
          type: "PUT" | "CALL"
          strike: number
          expiry: string
          open_date: string
          open_price: number
          close_date: string | null
          close_price: number | null
          close_type: "BTC" | "EXPIRED" | "ASSIGNED" | "EXERCISED" | null
          realized_pnl: number
          contracts: number
          commissions: number
          is_assigned: boolean | null
          is_exercised: boolean | null
          share_cost_basis: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          position_id: string
          side: "SELL" | "BUY"
          type: "PUT" | "CALL"
          strike: number
          expiry: string
          open_date: string
          open_price: number
          close_date?: string | null
          close_price?: number | null
          close_type?: "BTC" | "EXPIRED" | "ASSIGNED" | "EXERCISED" | null
          realized_pnl?: number
          contracts: number
          commissions?: number
          is_assigned?: boolean | null
          is_exercised?: boolean | null
          share_cost_basis?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          position_id?: string
          side?: "SELL" | "BUY"
          type?: "PUT" | "CALL"
          strike?: number
          expiry?: string
          open_date?: string
          open_price?: number
          close_date?: string | null
          close_price?: number | null
          close_type?: "BTC" | "EXPIRED" | "ASSIGNED" | "EXERCISED" | null
          realized_pnl?: number
          contracts?: number
          commissions?: number
          is_assigned?: boolean | null
          is_exercised?: boolean | null
          share_cost_basis?: number | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
