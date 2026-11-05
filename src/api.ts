import type { CommunityGroup, Conversation, FeedPost } from "./types";
import { Capacitor } from "@capacitor/core";

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

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  if (Capacitor.isNativePlatform()) {
    if (!API_BASE_URL) {
      throw new Error("Configure BUN_PUBLIC_API_URL com o endereço HTTPS da API antes de gerar o app mobile.");
    }
    if (!API_BASE_URL.startsWith("https://")) {
      throw new Error("A API do app mobile deve usar HTTPS.");
    }
  }

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

type RawPost = Omit<FeedPost, "liked"> & { liked?: number };

function toPost(raw: RawPost): FeedPost {
  return { ...raw, liked: Boolean(raw.liked) };
}

export async function fetchGroupPosts(groupId: string): Promise<FeedPost[]> {
  const raw = await request<RawPost[]>(`/api/groups/${groupId}/posts`);
  return raw.map(toPost);
}

export async function addGroupPostRequest(groupId: string, body: string): Promise<FeedPost[]> {
  const raw = await request<RawPost[]>(`/api/groups/${groupId}/posts`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
  return raw.map(toPost);
}

export async function togglePostLikeRequest(postId: string): Promise<{ liked: boolean; likes: number }> {
  return request<{ liked: boolean; likes: number }>(`/api/posts/${postId}/like`, { method: "POST" });
}

export async function toggleChallengeDayRequest(groupId: string, day: number): Promise<number[]> {
  return request<number[]>(`/api/groups/${groupId}/challenge-days/${day}`, { method: "POST" });
}

export async function fetchChallengeDays(groupId: string): Promise<number[]> {
  return request<number[]>(`/api/groups/${groupId}/challenge-days`);
}

export async function fetchConversations(): Promise<Conversation[]> {
  return request<Conversation[]>("/api/conversations");
}

export async function sendConversationMessageRequest(conversationId: number, text: string): Promise<Conversation> {
  return request<Conversation>(`/api/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}