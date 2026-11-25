import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { APP_REDIRECT_URL } from "./runtimeConfig";
import { getSupabaseClient } from "./supabaseClient";

export type AuthCallbackResult = {
  handled: boolean;
  isRecovery?: boolean;
  message?: string;
  error?: string;
};

export function getAuthRedirectUrl(): string {
  if (Capacitor.isNativePlatform()) {
    return APP_REDIRECT_URL || "com.psyconnect.app://auth-callback";
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return APP_REDIRECT_URL || "http://localhost:3000";
}

function parseCallbackUrl(rawUrl: string): {
  code: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  type: string | null;
  errorDescription: string | null;
} {
  try {
    const parsed = new URL(rawUrl);
    const query = parsed.searchParams;
    const hash = new URLSearchParams(parsed.hash.startsWith("#") ? parsed.hash.slice(1) : parsed.hash);
    return {
      code: query.get("code") ?? hash.get("code"),
      accessToken: hash.get("access_token") ?? query.get("access_token"),
      refreshToken: hash.get("refresh_token") ?? query.get("refresh_token"),
      type: hash.get("type") ?? query.get("type"),
      errorDescription:
        query.get("error_description") ?? hash.get("error_description") ?? query.get("error") ?? hash.get("error"),
    };
  } catch {
    return { code: null, accessToken: null, refreshToken: null, type: null, errorDescription: null };
  }
}

export async function processAuthUrl(rawUrl: string): Promise<AuthCallbackResult> {
  const { code, accessToken, refreshToken, type, errorDescription } = parseCallbackUrl(rawUrl);

  if (errorDescription) {
    return { handled: true, error: decodeURIComponent(errorDescription.replaceAll("+", " ")) };
  }

  if (!code && !(accessToken && refreshToken)) {
    return { handled: false };
  }

  const supabase = await getSupabaseClient();

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return { handled: true, error: "Este link expirou ou já foi usado. Peça um novo na tela de login." };
    }
    const isRecovery = type === "recovery" || Boolean(data.session?.user?.recovery_sent_at && type !== "signup");
    return {
      handled: true,
      isRecovery,
      message: isRecovery ? undefined : "E-mail confirmado com sucesso!",
    };
  }

  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error) {
      return { handled: true, error: "Não foi possível validar o link. Peça um novo na tela de login." };
    }
    const isRecovery = type === "recovery";
    return {
      handled: true,
      isRecovery,
      message: isRecovery ? undefined : "E-mail confirmado com sucesso!",
    };
  }

  return { handled: false };
}

export function subscribeDeepLinks(onResult: (result: AuthCallbackResult) => void): () => void {
  let active = true;
  let removeAppListener: (() => Promise<void>) | null = null;
  let unsubscribeAuth: (() => void) | null = null;

  const handleUrl = async (url: string) => {
    const result = await processAuthUrl(url);
    if (!active || !result.handled) return;
    if (!Capacitor.isNativePlatform() && typeof window !== "undefined") {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    onResult(result);
  };

  if (typeof window !== "undefined") {
    void handleUrl(window.location.href);
  }

  if (Capacitor.isNativePlatform()) {
    void CapacitorApp.getLaunchUrl().then(launch => {
      if (launch?.url) void handleUrl(launch.url);
    });
    void CapacitorApp.addListener("appUrlOpen", event => {
      if (event.url) void handleUrl(event.url);
    }).then(handle => {
      if (active) removeAppListener = () => handle.remove();
      else void handle.remove();
    });
  }

  void getSupabaseClient()
    .then(supabase => {
      if (!active) return;
      const { data } = supabase.auth.onAuthStateChange(event => {
        if (event === "PASSWORD_RECOVERY" && active) {
          onResult({ handled: true, isRecovery: true });
        }
      });
      unsubscribeAuth = () => data.subscription.unsubscribe();
    })
    .catch(() => {
      // erro de configuração será exibido na inicialização principal
    });

  return () => {
    active = false;
    if (removeAppListener) void removeAppListener();
    if (unsubscribeAuth) unsubscribeAuth();
  };
}

export function subscribeAndroidBackButton(onBack: () => boolean): () => void {
  if (!Capacitor.isNativePlatform()) return () => {};
  let active = true;
  let removeListener: (() => Promise<void>) | null = null;

  void CapacitorApp.addListener("backButton", () => {
    const handled = onBack();
    if (!handled) {
      void CapacitorApp.minimizeApp();
    }
  }).then(handle => {
    if (active) removeListener = () => handle.remove();
    else void handle.remove();
  });

  return () => {
    active = false;
    if (removeListener) void removeListener();
  };
}
