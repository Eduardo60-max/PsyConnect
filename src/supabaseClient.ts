import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadRuntimeConfig } from "./runtimeConfig";
import { supabaseStorageAdapter } from "./storage";

let clientPromise: Promise<SupabaseClient> | null = null;

export function getSupabaseClient(): Promise<SupabaseClient> {
  if (!clientPromise) {
    clientPromise = loadRuntimeConfig().then(config =>
      createClient(config.supabaseUrl, config.supabaseAnonKey, {
        auth: {
          storage: supabaseStorageAdapter,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false, // tratamos URLs e deep links no nativeBridge
        },
      }),
    );
  }
  return clientPromise;
}

export function resetSupabaseClientCache() {
  clientPromise = null;
}

export async function getAccessToken(): Promise<string | null> {
  try {
    const supabase = await getSupabaseClient();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}
