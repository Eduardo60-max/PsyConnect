import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

const memoryCache = new Map<string, string>();

function canUseLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export async function getStoredString(key: string): Promise<string | null> {
  if (Capacitor.isNativePlatform()) {
    const { value } = await Preferences.get({ key });
    if (value !== null) {
      memoryCache.set(key, value);
      return value;
    }
    // Migração suave de dados que estavam só em localStorage
    if (canUseLocalStorage()) {
      try {
        const legacy = window.localStorage.getItem(key);
        if (legacy !== null) {
          await Preferences.set({ key, value: legacy });
          memoryCache.set(key, legacy);
          return legacy;
        }
      } catch {
        // ignora erro de armazenamento local
      }
    }
    return null;
  }

  if (!canUseLocalStorage()) return memoryCache.get(key) ?? null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return memoryCache.get(key) ?? null;
  }
}

export async function setStoredString(key: string, value: string): Promise<void> {
  memoryCache.set(key, value);
  if (Capacitor.isNativePlatform()) {
    await Preferences.set({ key, value });
  }
  if (canUseLocalStorage()) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // armazenamento bloqueado ou cheio
    }
  }
}

export async function removeStoredString(key: string): Promise<void> {
  memoryCache.delete(key);
  if (Capacitor.isNativePlatform()) {
    await Preferences.remove({ key });
  }
  if (canUseLocalStorage()) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignora erro de armazenamento local
    }
  }
}

// Adaptador assíncrono compatível com Supabase Auth (sobrevive ao fechar o app Android)
export const supabaseStorageAdapter = {
  getItem: (key: string) => getStoredString(key),
  setItem: (key: string, value: string) => setStoredString(key, value),
  removeItem: (key: string) => removeStoredString(key),
};
