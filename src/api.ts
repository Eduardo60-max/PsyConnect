import type {
  AdminSurveySummary,
  AvailabilitySlot,
  BlockedUser,
  Booking,
  ChallengeRankEntry,
  CommunityGroup,
  Conversation,
  CurrentUser,
  FeedPost,
  ModerationReport,
  MoodDay,
  PendingDoctorItem,
  PostComment,
  ProBooking,
  ProChat,
  Professional,
  ReportTargetType,
} from "./types";
import type { PanasAnswers, PanasMoment, PanasRecord } from "./panas";
import { API_BASE_URL } from "./runtimeConfig";
import { getAccessToken } from "./supabaseClient";

export type SendMessageResult = {
  conversation: Conversation;
};

export type NewBookingPayload = {
  doctorId: string;
  slot: string;
  preference: string;
  reason: string;
};

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const token = await getAccessToken();
  const headers = new Headers(options?.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${url}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error("Sem conexão com a internet ou servidor indisponível.");
  }

  if (!res.ok) {
    let message = `Falha na requisição: ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (typeof body?.error === "string") message = body.error;
    } catch {
      // mantém mensagem padrão
    }
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

async function requestText(url: string): Promise<string> {
  const token = await getAccessToken();
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${url}`, { headers });
  } catch {
    throw new Error("Sem conexão com a internet ou servidor indisponível.");
  }

  if (!res.ok) {
    throw new Error(`Falha ao baixar arquivo (${res.status}).`);
  }
  return res.text();
}

// ---- Perfil e profissionais ----
export async function updateMyProfileRequest(payload: {
  name?: string;
  acceptedHealthDataAt?: string;
}): Promise<CurrentUser> {
  return request<CurrentUser>("/api/me/profile", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function fetchProfessionals(): Promise<Professional[]> {
  return request<Professional[]>("/api/professionals");
}

// ---- Feed & Grupos ----
export async function fetchHomeFeed(theme = "all"): Promise<FeedPost[]> {
  return request<FeedPost[]>(`/api/feed?theme=${encodeURIComponent(theme)}`);
}

export async function fetchGroups(): Promise<CommunityGroup[]> {
  return request<CommunityGroup[]>("/api/groups");
}

export async function createGroupRequest(input: {
  name: string;
  description: string;
  theme: string;
  adminId?: string | null;
  isTemporary: boolean;
  durationDays?: number;
  accent: string;
}): Promise<CommunityGroup[]> {
  return request<CommunityGroup[]>("/api/groups", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function toggleGroupJoinRequest(groupId: string): Promise<{ joined: boolean; members: number }> {
  return request<{ joined: boolean; members: number }>(`/api/groups/${encodeURIComponent(groupId)}/join`, {
    method: "POST",
  });
}

export async function fetchGroupPosts(groupId: string): Promise<FeedPost[]> {
  return request<FeedPost[]>(`/api/groups/${encodeURIComponent(groupId)}/posts`);
}

export async function addGroupPostRequest(groupId: string, body: string): Promise<FeedPost[]> {
  return request<FeedPost[]>(`/api/groups/${encodeURIComponent(groupId)}/posts`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

export async function deletePostRequest(postId: string): Promise<void> {
  await request<{ ok: boolean }>(`/api/posts/${encodeURIComponent(postId)}`, { method: "DELETE" });
}

export async function togglePostLikeRequest(postId: string): Promise<{ liked: boolean; likes: number }> {
  return request<{ liked: boolean; likes: number }>(`/api/posts/${encodeURIComponent(postId)}/like`, {
    method: "POST",
  });
}

export async function fetchPostComments(postId: string): Promise<PostComment[]> {
  return request<PostComment[]>(`/api/posts/${encodeURIComponent(postId)}/comments`);
}

export async function addPostCommentRequest(postId: string, body: string): Promise<PostComment[]> {
  return request<PostComment[]>(`/api/posts/${encodeURIComponent(postId)}/comments`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

export async function deleteCommentRequest(commentId: string): Promise<void> {
  await request<{ ok: boolean }>(`/api/comments/${encodeURIComponent(commentId)}`, { method: "DELETE" });
}

export async function fetchChallengeDays(groupId: string): Promise<number[]> {
  return request<number[]>(`/api/groups/${encodeURIComponent(groupId)}/challenge-days`);
}

export async function toggleChallengeDayRequest(groupId: string, day: number): Promise<number[]> {
  return request<number[]>(`/api/groups/${encodeURIComponent(groupId)}/challenge-days/${day}`, {
    method: "POST",
  });
}

export async function fetchChallengeRanking(groupId: string): Promise<ChallengeRankEntry[]> {
  return request<ChallengeRankEntry[]>(`/api/groups/${encodeURIComponent(groupId)}/challenge-ranking`);
}

// ---- Diário de humor ----
export async function fetchMoodWeek(): Promise<MoodDay[]> {
  return request<MoodDay[]>("/api/mood");
}

export async function saveMoodRequest(mood: number, note: string): Promise<MoodDay[]> {
  return request<MoodDay[]>("/api/mood", {
    method: "POST",
    body: JSON.stringify({ mood, note }),
  });
}

// ---- Agendamentos (paciente) ----
export async function fetchBookings(): Promise<Booking[]> {
  return request<Booking[]>("/api/bookings");
}

export async function createBookingRequest(payload: NewBookingPayload): Promise<Booking[]> {
  return request<Booking[]>("/api/bookings", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function cancelBookingRequest(id: string): Promise<Booking[]> {
  return request<Booking[]>(`/api/bookings/${encodeURIComponent(id)}/cancel`, { method: "POST" });
}

export async function rescheduleBookingRequest(id: string, slot: string): Promise<Booking[]> {
  return request<Booking[]>(`/api/bookings/${encodeURIComponent(id)}/reschedule`, {
    method: "POST",
    body: JSON.stringify({ slot }),
  });
}

// ---- Mensagens (paciente) ----
export async function fetchConversations(): Promise<Conversation[]> {
  return request<Conversation[]>("/api/conversations");
}

export async function sendConversationMessageRequest(conversationId: number, text: string): Promise<SendMessageResult> {
  return request<SendMessageResult>(`/api/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

// ---- Segurança: bloqueios e denúncias ----
export async function fetchBlockedUsers(): Promise<BlockedUser[]> {
  return request<BlockedUser[]>("/api/blocks");
}

export async function blockUserRequest(userId: string): Promise<BlockedUser[]> {
  return request<BlockedUser[]>("/api/blocks", {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
}

export async function unblockUserRequest(userId: string): Promise<BlockedUser[]> {
  return request<BlockedUser[]>(`/api/blocks/${encodeURIComponent(userId)}`, { method: "DELETE" });
}

export async function createReportRequest(input: {
  targetType: ReportTargetType;
  targetId: string;
  reportedUserId?: string;
  reason: string;
}): Promise<void> {
  await request<{ ok: boolean }>("/api/reports", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// ---- Métricas IHC: PANAS ----
export async function fetchMyPanasRecords(): Promise<PanasRecord[]> {
  return request<PanasRecord[]>("/api/surveys/panas/me");
}

export async function submitPanasRequest(input: {
  sessionId: string;
  moment: PanasMoment;
  answers: PanasAnswers;
  consentAcceptedAt?: string;
}): Promise<{ record: PanasRecord; records: PanasRecord[] }> {
  return request<{ record: PanasRecord; records: PanasRecord[] }>("/api/surveys/panas", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// ---- Painel do profissional ----
export async function updateDoctorProfileRequest(payload: {
  roleTitle?: string;
  specialty?: string;
  bio?: string;
  experience?: string;
  priceLabel?: string;
}): Promise<CurrentUser> {
  return request<CurrentUser>("/api/pro/profile", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function fetchProAvailability(): Promise<AvailabilitySlot[]> {
  return request<AvailabilitySlot[]>("/api/pro/availability");
}

export async function addProSlotRequest(slotLabel: string, startsAt?: string | null): Promise<AvailabilitySlot[]> {
  return request<AvailabilitySlot[]>("/api/pro/availability", {
    method: "POST",
    body: JSON.stringify({ slotLabel, startsAt }),
  });
}

export async function removeProSlotRequest(slotId: string): Promise<AvailabilitySlot[]> {
  return request<AvailabilitySlot[]>(`/api/pro/availability/${encodeURIComponent(slotId)}`, {
    method: "DELETE",
  });
}

export async function fetchProBookings(): Promise<ProBooking[]> {
  return request<ProBooking[]>("/api/pro/bookings");
}

export async function proCancelBookingRequest(id: string): Promise<ProBooking[]> {
  return request<ProBooking[]>(`/api/pro/bookings/${encodeURIComponent(id)}/cancel`, { method: "POST" });
}

export async function proRescheduleBookingRequest(id: string, slot: string): Promise<ProBooking[]> {
  return request<ProBooking[]>(`/api/pro/bookings/${encodeURIComponent(id)}/reschedule`, {
    method: "POST",
    body: JSON.stringify({ slot }),
  });
}

export async function fetchProChats(): Promise<ProChat[]> {
  return request<ProChat[]>("/api/pro/chats");
}

export async function sendProMessageRequest(chatId: number, text: string): Promise<ProChat[]> {
  return request<ProChat[]>(`/api/pro/chats/${chatId}/messages`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

// ---- Painel Admin ----
export async function fetchAdminDoctors(status?: string): Promise<PendingDoctorItem[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return request<PendingDoctorItem[]>(`/api/admin/doctors${qs}`);
}

export async function reviewDoctorRequest(
  doctorUserId: string,
  decision: "aprovado" | "recusado",
  rejectionReason?: string,
): Promise<PendingDoctorItem[]> {
  return request<PendingDoctorItem[]>(`/api/admin/doctors/${encodeURIComponent(doctorUserId)}/review`, {
    method: "POST",
    body: JSON.stringify({ decision, rejectionReason }),
  });
}

export async function fetchAdminReports(): Promise<ModerationReport[]> {
  return request<ModerationReport[]>("/api/admin/reports");
}

export async function resolveAdminReportRequest(
  reportId: string,
  action: "dismiss" | "remove_content",
): Promise<ModerationReport[]> {
  return request<ModerationReport[]>(`/api/admin/reports/${encodeURIComponent(reportId)}/resolve`, {
    method: "POST",
    body: JSON.stringify({ action }),
  });
}

export async function fetchAdminSurveys(): Promise<AdminSurveySummary> {
  return request<AdminSurveySummary>("/api/admin/surveys");
}

export async function fetchAdminSurveysCsv(): Promise<string> {
  return requestText("/api/admin/surveys/csv");
}
