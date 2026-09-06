"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * QueryClient is created inside useState (not as a module-level singleton)
 * so each browser session gets its own instance — a module-level client
 * would be shared across requests if this ever ran on the server, and
 * would leak cached data between different signed-in users.
 *
 * Defaults: staleTime > 0 so switching tabs/screens doesn't immediately
 * refetch data that's still fresh — appointments/patients/profile data
 * doesn't change fast enough server-side to need instant refetch on every
 * focus, and realtime subscriptions (see AppointmentList) are what
 * actually keep query data current, not polling.
 */
export default function QueryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
