'use server'
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import type { Database } from "./database.types"

export const createServerClient = async () => {
  const cookieStore = await cookies()
  return createRouteHandlerClient<Database>({ cookies: () => cookieStore })
}
