import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

const clientCache = new Map<string, SupabaseClient>();

export const getSupabaseClient = (url: string, anonKey: string): SupabaseClient => {
  const cacheKey = `${url}|${anonKey}`;
  const cached = clientCache.get(cacheKey);
  if (cached) return cached;

  const client = createClient(url, anonKey);
  clientCache.set(cacheKey, client);
  return client;
};
