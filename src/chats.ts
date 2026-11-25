import type { Conversation, ConversationMessage, ProChat } from "./types";
import { getSupabaseAdmin } from "./supabaseServer";
import { colorFor } from "./proUtils";
import { formatTimeLabel } from "./timeUtils";

type ConversationRow = {
  id: number;
  patient_id: string;
  doctor_id: string;
  created_at: string;
};

type MessageRow = {
  id: number;
  conversation_id: number;
  sender_id: string;
  body: string;
  created_at: string;
};

async function loadMessagesByConversation(conversationIds: number[]): Promise<Map<number, MessageRow[]>> {
  const byChat = new Map<number, MessageRow[]>();
  if (conversationIds.length === 0) return byChat;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id, body, created_at")
    .in("conversation_id", conversationIds)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw new Error(error.message);

  for (const row of (data ?? []) as MessageRow[]) {
    const list = byChat.get(row.conversation_id) ?? [];
    list.push(row);
    byChat.set(row.conversation_id, list);
  }
  return byChat;
}

function toView(rows: MessageRow[] | undefined, viewerId: string): ConversationMessage[] {
  return (rows ?? []).map(row => ({
    id: row.id,
    sender: row.sender_id === viewerId ? "me" : "them",
    text: row.body,
    time: formatTimeLabel(row.created_at),
  }));
}

export async function ensureChat(patientId: string, doctorId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  await supabase
    .from("conversations")
    .upsert({ patient_id: patientId, doctor_id: doctorId }, { onConflict: "patient_id,doctor_id" });
}

export async function listPatientChats(patientId: string): Promise<Conversation[]> {
  const supabase = getSupabaseAdmin();
  const { data: chats, error } = await supabase
    .from("conversations")
    .select("id, patient_id, doctor_id, created_at")
    .eq("patient_id", patientId)
    .order("id", { ascending: true });

  if (error) throw new Error(error.message);
  const chatRows = (chats ?? []) as ConversationRow[];
  if (chatRows.length === 0) return [];

  const doctorIds = [...new Set(chatRows.map(c => c.doctor_id))];
  const [messagesMap, { data: profiles }, { data: pros }] = await Promise.all([
    loadMessagesByConversation(chatRows.map(c => c.id)),
    supabase.from("profiles").select("id, name").in("id", doctorIds),
    supabase.from("professional_profiles").select("user_id, role_title, specialty, accent").in("user_id", doctorIds),
  ]);

  const nameMap = new Map((profiles ?? []).map(p => [String(p.id), String(p.name)]));
  const proMap = new Map((pros ?? []).map(p => [String(p.user_id), p]));

  return chatRows.map(chat => {
    const pro = proMap.get(chat.doctor_id);
    const roleTitle = pro?.role_title ? String(pro.role_title) : "Médico(a)";
    const specialty = pro?.specialty ? String(pro.specialty) : "Atendimento";
    return {
      id: chat.id,
      otherUserId: chat.doctor_id,
      name: nameMap.get(chat.doctor_id) ?? "Profissional",
      context: `${roleTitle} · ${specialty}`,
      accent: pro?.accent ? String(pro.accent) : "#7c3aed",
      messages: toView(messagesMap.get(chat.id), patientId),
    };
  });
}

export async function listProChats(doctorId: string): Promise<ProChat[]> {
  const supabase = getSupabaseAdmin();
  const { data: chats, error } = await supabase
    .from("conversations")
    .select("id, patient_id, doctor_id, created_at")
    .eq("doctor_id", doctorId);

  if (error) throw new Error(error.message);
  const chatRows = (chats ?? []) as ConversationRow[];
  if (chatRows.length === 0) return [];

  const patientIds = [...new Set(chatRows.map(c => c.patient_id))];
  const [messagesMap, { data: profiles }] = await Promise.all([
    loadMessagesByConversation(chatRows.map(c => c.id)),
    supabase.from("profiles").select("id, name, email").in("id", patientIds),
  ]);

  const patientMap = new Map(
    (profiles ?? []).map(p => [String(p.id), { name: String(p.name), email: String(p.email) }]),
  );

  return chatRows
    .map(chat => {
      const rows = messagesMap.get(chat.id) ?? [];
      const patient = patientMap.get(chat.patient_id);
      const patientEmail = patient?.email ?? "";
      const lastAt = rows.at(-1) ? new Date(rows.at(-1)!.created_at).getTime() : new Date(chat.created_at).getTime();

      return {
        lastAt,
        view: {
          id: chat.id,
          otherUserId: chat.patient_id,
          name: patient?.name ?? "Paciente",
          context: patientEmail ? `Paciente · ${patientEmail}` : "Paciente",
          accent: colorFor(patientEmail || chat.patient_id),
          patientEmail,
          messages: toView(rows, doctorId),
        },
      };
    })
    .sort((a, b) => b.lastAt - a.lastAt)
    .map(item => item.view);
}

export async function getConversationMessages(
  viewerId: string,
  conversationId: number,
): Promise<{ messages?: ConversationMessage[]; error?: string; status?: number }> {
  if (!Number.isInteger(conversationId) || conversationId <= 0) {
    return { error: "Conversa inválida.", status: 400 };
  }
  const supabase = getSupabaseAdmin();
  const { data: chat } = await supabase
    .from("conversations")
    .select("id, patient_id, doctor_id")
    .eq("id", conversationId)
    .maybeSingle<ConversationRow>();

  if (!chat) return { error: "Conversa não encontrada.", status: 404 };
  if (chat.patient_id !== viewerId && chat.doctor_id !== viewerId) {
    return { error: "Você não tem acesso a esta conversa.", status: 403 };
  }

  const messagesMap = await loadMessagesByConversation([conversationId]);
  return { messages: toView(messagesMap.get(conversationId), viewerId) };
}

export async function addChatMessage(
  senderId: string,
  mode: "patient" | "doctor",
  conversationId: number,
  body: string,
): Promise<{ error?: string; status?: number }> {
  if (!Number.isInteger(conversationId) || conversationId <= 0) {
    return { error: "Conversa inválida.", status: 400 };
  }
  const cleanText = body.trim();
  if (!cleanText) return { error: "A mensagem não pode estar vazia.", status: 400 };
  if (cleanText.length > 1000) return { error: "A mensagem pode ter no máximo 1000 caracteres.", status: 400 };

  const supabase = getSupabaseAdmin();
  const { data: chat } = await supabase
    .from("conversations")
    .select("id, patient_id, doctor_id")
    .eq("id", conversationId)
    .maybeSingle<ConversationRow>();

  if (!chat) return { error: "Conversa não encontrada.", status: 404 };

  const isOwner = mode === "patient" ? chat.patient_id === senderId : chat.doctor_id === senderId;
  if (!isOwner) {
    return { error: "Você não tem permissão para enviar mensagem nesta conversa.", status: 403 };
  }

  const otherId = mode === "patient" ? chat.doctor_id : chat.patient_id;
  const { data: block } = await supabase
    .from("user_blocks")
    .select("blocker_id")
    .or(`and(blocker_id.eq.${senderId},blocked_id.eq.${otherId}),and(blocker_id.eq.${otherId},blocked_id.eq.${senderId})`)
    .limit(1)
    .maybeSingle();

  if (block) {
    return { error: "Não é possível enviar mensagens porque um dos usuários bloqueou o outro.", status: 403 };
  }

  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: senderId,
    body: cleanText,
  });

  if (error) return { error: error.message, status: 500 };
  return {};
}
