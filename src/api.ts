import type {
  Booking,
  CommunityGroup,
  Conversation,
  FeedPost,
  MoodDay,
  PostComment,
  ProBooking,
  ProChat,
} from "./types";
import { Capacitor } from "@capacitor/core";
import { localRequest } from "./localServer";

const API_BASE_URL = (typeof __PSYCONNECT_API_URL__ === "undefined" ? "" : __PSYCONNECT_API_URL__).replace(/\/+$/, "");

type RawGroup = {
  id: string;
  name: string;
  description: string;
  theme: string;
  adminId: string;
  members: number;
  joined: number;
  isTemporary: number;
  durationDays: number | null;
  accent: string;
};

type RawPost = Omit<FeedPost, "liked"> & { liked?: number };

export type SendMessageResult = {
  conversation: Conversation;
  replyDelayMs: number | null;
};

export type NewBookingPayload = Omit<Booking, "id" | "status" | "createdAt">;

type ApiUser = { name: string; email: string };

let currentApiUser: ApiUser | null = null;

// O App avisa quem está logado; assim cada aba usa a própria identidade
export function setApiUser(user: ApiUser | null) {
  currentApiUser = user ? { name: user.name, email: user.email } : null;
}

function toGroup(raw: RawGroup): CommunityGroup {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    theme: raw.theme,
    adminId: raw.adminId,
    members: raw.members,
    joined: Boolean(raw.joined),
    isTemporary: Boolean(raw.isTemporary),
    durationDays: raw.durationDays ?? undefined,
    accent: raw.accent,
  };
}

function toPost(raw: RawPost): FeedPost {
  return { ...raw, liked: Boolean(raw.liked) };
}

function useLocalBackend() {
  if (Capacitor.isNativePlatform()) return true;
  try {
    return window.localStorage.getItem("psyconect_force_local") === "1";
  } catch {
    return false;
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  // No app Android os dados ficam no próprio aparelho
  if (useLocalBackend()) return localRequest<T>(url, options);

  const res = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Falha na requisição: ${res.status}`);
  }
  return res.json();
}

function handleFor(name: string) {
  const cleaned = name.trim().replace(/^(dra?|profa?|sra?)\.?\s+/i, "");
  const first = cleaned.split(/\s+/)[0] || "voce";
  return `@${first.toLowerCase()}`;
}

// Nome e e-mail de quem está logado
function getStoredUser(): { name: string; handle: string; email: string } {
  let name = currentApiUser?.name ?? "";
  let email = currentApiUser?.email ?? "";

  if (!name && !email) {
    try {
      const stored = window.localStorage.getItem("psyconect_user");
      const parsed = stored ? (JSON.parse(stored) as { name?: string; email?: string }) : {};
      name = String(parsed.name ?? "");
      email = String(parsed.email ?? "");
    } catch {
      // ignora e usa o padrão
    }
  }

  name = name.trim();
  return { name: name || "Você", handle: name ? handleFor(name) : "@voce", email: email.trim() };
}

export async function fetchGroups(): Promise<CommunityGroup[]> {
  const raw = await request<RawGroup[]>("/api/groups");
  return raw.map(toGroup);
}

export async function createGroupRequest(group: CommunityGroup): Promise<CommunityGroup[]> {
  const raw = await request<RawGroup[]>("/api/groups", {
    method: "POST",
    body: JSON.stringify(group),
  });
  return raw.map(toGroup);
}

export async function toggleGroupJoinRequest(groupId: string): Promise<{ joined: boolean; members: number }> {
  const result = await request<{ joined: number; members: number }>(`/api/groups/${groupId}/join`, { method: "POST" });
  return { joined: Boolean(result.joined), members: result.members };
}

export async function fetchGroupPosts(groupId: string): Promise<FeedPost[]> {
  const raw = await request<RawPost[]>(`/api/groups/${groupId}/posts`);
  return raw.map(toPost);
}

export async function addGroupPostRequest(groupId: string, body: string): Promise<FeedPost[]> {
  const user = getStoredUser();
  const raw = await request<RawPost[]>(`/api/groups/${groupId}/posts`, {
    method: "POST",
    body: JSON.stringify({ body, author: user.name, handle: user.handle }),
  });
  return raw.map(toPost);
}

export async function togglePostLikeRequest(postId: string): Promise<{ liked: boolean; likes: number }> {
  return request<{ liked: boolean; likes: number }>(`/api/posts/${postId}/like`, { method: "POST" });
}

export async function fetchPostComments(postId: string): Promise<PostComment[]> {
  return request<PostComment[]>(`/api/posts/${postId}/comments`);
}

export async function addPostCommentRequest(postId: string, body: string): Promise<PostComment[]> {
  const user = getStoredUser();
  return request<PostComment[]>(`/api/posts/${postId}/comments`, {
    method: "POST",
    body: JSON.stringify({ body, author: user.name, handle: user.handle }),
  });
}

export async function fetchMoodWeek(email: string): Promise<MoodDay[]> {
  return request<MoodDay[]>(`/api/mood?email=${encodeURIComponent(email)}`);
}

export async function saveMoodRequest(email: string, mood: number, note: string): Promise<MoodDay[]> {
  return request<MoodDay[]>("/api/mood", {
    method: "POST",
    body: JSON.stringify({ email, mood, note }),
  });
}

export async function fetchBookings(email: string): Promise<Booking[]> {
  return request<Booking[]>(`/api/bookings?email=${encodeURIComponent(email)}`);
}

export async function createBookingRequest(email: string, payload: NewBookingPayload): Promise<Booking[]> {
  return request<Booking[]>("/api/bookings", {
    method: "POST",
    body: JSON.stringify({ email, patientName: getStoredUser().name, ...payload }),
  });
}

export async function cancelBookingRequest(email: string, id: string): Promise<Booking[]> {
  return request<Booking[]>(`/api/bookings/${id}/cancel`, {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function rescheduleBookingRequest(email: string, id: string, slot: string): Promise<Booking[]> {
  return request<Booking[]>(`/api/bookings/${id}/reschedule`, {
    method: "POST",
    body: JSON.stringify({ email, slot }),
  });
}

export async function toggleChallengeDayRequest(groupId: string, day: number): Promise<number[]> {
  return request<number[]>(`/api/groups/${groupId}/challenge-days/${day}`, { method: "POST" });
}

export async function fetchChallengeDays(groupId: string): Promise<number[]> {
  return request<number[]>(`/api/groups/${groupId}/challenge-days`);
}

export async function fetchConversations(): Promise<Conversation[]> {
  const user = getStoredUser();
  return request<Conversation[]>(
    `/api/conversations?email=${encodeURIComponent(user.email)}&name=${encodeURIComponent(user.name)}`,
  );
}

export async function sendConversationMessageRequest(conversationId: number, text: string): Promise<SendMessageResult> {
  const user = getStoredUser();
  return request<SendMessageResult>(`/api/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ text, email: user.email }),
  });
}

// ---- Painel do profissional ----
export async function fetchProBookings(proId: string): Promise<ProBooking[]> {
  return request<ProBooking[]>(`/api/pro/bookings?proId=${encodeURIComponent(proId)}`);
}

export async function proCancelBookingRequest(proId: string, id: string): Promise<ProBooking[]> {
  return request<ProBooking[]>(`/api/pro/bookings/${id}/cancel`, {
    method: "POST",
    body: JSON.stringify({ proId }),
  });
}

export async function proRescheduleBookingRequest(proId: string, id: string, slot: string): Promise<ProBooking[]> {
  return request<ProBooking[]>(`/api/pro/bookings/${id}/reschedule`, {
    method: "POST",
    body: JSON.stringify({ proId, slot }),
  });
}

export async function fetchProChats(proId: string): Promise<ProChat[]> {
  return request<ProChat[]>(`/api/pro/chats?proId=${encodeURIComponent(proId)}`);
}

export type ProSendResult = {
  chats: ProChat[];
  replyDelayMs: number | null;
};

export async function sendProMessageRequest(proId: string, chatId: number, text: string): Promise<ProSendResult> {
  return request<ProSendResult>(`/api/pro/chats/${chatId}/messages`, {
    method: "POST",
    body: JSON.stringify({ proId, text }),
  });
}

export async function setProAutoRequest(proId: string, chatId: number, enabled: boolean): Promise<ProChat[]> {
  return request<ProChat[]>(`/api/pro/chats/${chatId}/auto`, {
    method: "POST",
    body: JSON.stringify({ proId, enabled }),
  });
}

export async function resetDemoRequest(): Promise<void> {
  await request<{ ok: boolean }>("/api/demo/reset", { method: "POST" });
}