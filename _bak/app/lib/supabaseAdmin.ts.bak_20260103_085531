import 'server-only';
import { createClient } from "@supabase/supabase-js";

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

if (!url) throw new Error("Missing env var: NEXT_PUBLIC_SUPABASE_URL");
if (!serviceKey) throw new Error("Missing env var: SUPABASE_SERVICE_ROLE_KEY");
if (!/^https?:\/\//i.test(url)) throw new Error("Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL.");

export const supabaseAdmin = createClient(url, serviceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
