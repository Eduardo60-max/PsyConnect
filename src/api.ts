import type { CommunityGroup, Conversation, FeedPost } from "./types";

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
  const res = await fetch(url, {
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

export async function fetchGroupPosts(groupId: string): Promise<FeedPost[]> {
  return request<FeedPost[]>(`/api/groups/${groupId}/posts`);
}

export async function addGroupPostRequest(groupId: string, body: string): Promise<FeedPost[]> {
  return request<FeedPost[]>(`/api/groups/${groupId}/posts`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
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