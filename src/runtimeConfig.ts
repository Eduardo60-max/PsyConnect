import { Capacitor } from "@capacitor/core";

function trimTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value[end - 1] === "/") end--;
  return value.slice(0, end);
}

function readBundledEnv(definedValue: string | undefined, envKey: string): string {
  if (typeof definedValue === "string" && definedValue.trim()) return definedValue.trim();
  if (typeof process !== "undefined" && process.env && typeof process.env[envKey] === "string") {
    return process.env[envKey]!.trim();
  }
  return "";
}

export const API_BASE_URL = trimTrailingSlashes(
  readBundledEnv(typeof __PSYCONNECT_API_URL__ === "undefined" ? undefined : __PSYCONNECT_API_URL__, "BUN_PUBLIC_API_URL"),
);

export const APP_REDIRECT_URL = readBundledEnv(
  typeof __PSYCONNECT_APP_REDIRECT_URL__ === "undefined" ? undefined : __PSYCONNECT_APP_REDIRECT_URL__,
  "BUN_PUBLIC_APP_REDIRECT_URL",
);

let cachedSupabaseUrl = readBundledEnv(
  typeof __PSYCONNECT_SUPABASE_URL__ === "undefined" ? undefined : __PSYCONNECT_SUPABASE_URL__,
  "BUN_PUBLIC_SUPABASE_URL",
);

let cachedSupabaseAnonKey = readBundledEnv(
  typeof __PSYCONNECT_SUPABASE_ANON_KEY__ === "undefined" ? undefined : __PSYCONNECT_SUPABASE_ANON_KEY__,
  "BUN_PUBLIC_SUPABASE_ANON_KEY",
);

export type RuntimeConfig = {
  apiBaseUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  isNative: boolean;
};

export function validateApiBaseUrl(): string | null {
  if (!Capacitor.isNativePlatform()) return null;
  if (!API_BASE_URL) {
    return "Configuração ausente no app Android: defina BUN_PUBLIC_API_URL com a URL HTTPS da API antes de gerar o build.";
  }
  if (!API_BASE_URL.startsWith("https://")) {
    return `A URL da API no app Android precisa usar HTTPS (valor atual: ${API_BASE_URL}).`;
  }
  return null;
}

export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  const apiError = validateApiBaseUrl();
  if (apiError) throw new Error(apiError);

  if (!cachedSupabaseUrl || !cachedSupabaseAnonKey) {
    const res = await fetch(`${API_BASE_URL}/api/public-config`);
    if (!res.ok) {
      throw new Error("Não foi possível carregar as configurações do servidor.");
    }
    const payload = (await res.json()) as { supabaseUrl?: string; supabaseAnonKey?: string };
    cachedSupabaseUrl = (payload.supabaseUrl ?? "").trim();
    cachedSupabaseAnonKey = (payload.supabaseAnonKey ?? "").trim();
  }

  if (!cachedSupabaseUrl || !cachedSupabaseAnonKey) {
    throw new Error(
      "Configuração do Supabase ausente. Defina SUPABASE_URL e SUPABASE_ANON_KEY no .env do servidor e tente novamente.",
    );
  }

  return {
    apiBaseUrl: API_BASE_URL,
    supabaseUrl: cachedSupabaseUrl,
    supabaseAnonKey: cachedSupabaseAnonKey,
    isNative: Capacitor.isNativePlatform(),
  };
}
