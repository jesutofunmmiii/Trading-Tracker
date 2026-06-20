// Browser-side Supabase client (singleton-friendly factory).
// Used by client components and TanStack Query fetchers.

import { createBrowserClient } from "@supabase/ssr";

function readEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local (see .env.example)."
    );
  }
  return { url, anonKey };
}

export function createClient() {
  const { url, anonKey } = readEnv();
  return createBrowserClient(url, anonKey);
}
