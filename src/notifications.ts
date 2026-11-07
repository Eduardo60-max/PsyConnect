export type NotificationKind = "booking" | "message" | "group" | "challenge" | "system";

export type NotificationTarget = {
  screen: "home" | "bookings" | "messages" | "groups";
  groupId?: string;
  conversationId?: number;
};

export type AppNotification = {
  id: string;
  key?: string;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: number;
  read: boolean;
  target?: NotificationTarget;
};

export type NewNotification = Omit<AppNotification, "id" | "createdAt" | "read">;

export const NOTIFICATION_KEY_PREFIX = "psyconect_notifs_";
const MAX_NOTIFICATIONS = 30;

const KINDS: NotificationKind[] = ["booking", "message", "group", "challenge", "system"];

function storageKey(email: string) {
  return `${NOTIFICATION_KEY_PREFIX}${email.trim().toLowerCase()}`;
}

function isNotification(value: unknown): value is AppNotification {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    typeof item.body === "string" &&
    typeof item.createdAt === "number" &&
    typeof item.read === "boolean" &&
    typeof item.kind === "string" &&
    KINDS.includes(item.kind as NotificationKind)
  );
}

function welcomeNotification(): AppNotification {
  return {
    id: "welcome",
    kind: "system",
    title: "Bem-vindo(a) ao PsyConect 💜",
    body: "Aqui você recebe avisos de sessões, mensagens, grupos e desafios.",
    createdAt: Date.now(),
    read: false,
    target: { screen: "home" },
  };
}

// Primeira vez de um e-mail: começa com a mensagem de boas-vindas
export function loadNotifications(email: string): AppNotification[] {
  try {
    const raw = window.localStorage.getItem(storageKey(email));
    if (raw === null) return [welcomeNotification()];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isNotification).slice(0, MAX_NOTIFICATIONS) : [];
  } catch {
    return [];
  }
}

export function saveNotifications(email: string, items: AppNotification[]) {
  try {
    window.localStorage.setItem(storageKey(email), JSON.stringify(items.slice(0, MAX_NOTIFICATIONS)));
  } catch {
    // sem espaço ou armazenamento bloqueado: as notificações só não persistem
  }
}

// Adiciona no topo; se vier com "key" repetida, ignora (evita avisos duplicados)
export function addToList(items: AppNotification[], input: NewNotification): AppNotification[] {
  if (input.key && items.some(item => item.key === input.key)) return items;
  const created: AppNotification = {
    ...input,
    id: `n-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    createdAt: Date.now(),
    read: false,
  };
  return [created, ...items].slice(0, MAX_NOTIFICATIONS);
}

export function timeAgo(timestamp: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 45) return "agora";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `há ${Math.max(1, minutes)} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  return `há ${Math.floor(hours / 24)} d`;
}