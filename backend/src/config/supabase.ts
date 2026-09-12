import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log("Supabase key prefix:", supabaseServiceKey?.slice(0, 12));

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    "❌ Critical Configuration Error: Missing Supabase environment variables in .env",
  );
}

// service_role key: server-only, bypasses RLS. Never expose to frontend.
export const supabase: SupabaseClient = createClient(
  supabaseUrl,
  supabaseServiceKey,
);
