import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for use in Client Components ("use client").
 * Mirrors the mobile app's SupabaseService in spirit: this is the one place
 * a browser-side client gets constructed. Don't call createBrowserClient()
 * directly elsewhere — import this instead.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
