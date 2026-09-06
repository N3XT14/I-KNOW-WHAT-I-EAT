import { cache } from "react";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { type SupabaseClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";

/**
 * Supabase client for use in Server Components, Server Actions, and Route
 * Handlers. Must be created fresh per request (reads the request's cookies) —
 * never module-level singleton this.
 *
 * The `setAll` no-op catch mirrors the standard Next.js App Router pattern:
 * Server Components can't write cookies, only middleware/Route
 * Handlers/Server Actions can. Session refresh itself happens in
 * proxy.ts, so a thrown error here is expected and safe to swallow.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — safe to ignore, see doc comment above.
          }
        },
      },
    },
  );
}

export const getAuthedDoctor = cache(async (): Promise<{
  user: { id: string; email?: string };
  supabase: SupabaseClient;
}> => {
  const supabase = await createClient();
  const headerList = await headers();
  const doctorId = headerList.get("x-doctor-id");

  if (doctorId) {
    return {
      user: {
        id: doctorId,
        email: headerList.get("x-doctor-email") ?? undefined,
      },
      supabase,
    };
  }

  // Fallback only — shouldn't happen given proxy.ts's matcher, but fail
  // safe (re-verify) rather than trust an unverified request.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  return { user, supabase };
});