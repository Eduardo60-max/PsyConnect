import type { ModerationReport, PendingDoctorItem, ProfessionalStatus } from "./types";
import type { AuthContext } from "./supabaseServer";
import { getSupabaseAdmin } from "./supabaseServer";
import { SPECIALTIES } from "./authValidation";

export async function updateMyProfile(
  userId: string,
  input: { name?: string; acceptedHealthDataAt?: string },
): Promise<{ error?: string; status?: number }> {
  const updates: Record<string, unknown> = {};
  if (typeof input.name === "string") {
    const clean = input.name.trim().replaceAll(/\s+/g, " ");
    if (clean.length < 5 || !clean.includes(" ") || clean.length > 80) {
      return { error: "Informe nome e sobrenome (entre 5 e 80 caracteres).", status: 400 };
    }
    updates.name = clean;
  }
  if (typeof input.acceptedHealthDataAt === "string" && input.acceptedHealthDataAt) {
    updates.accepted_health_data_at = input.acceptedHealthDataAt;
  }
  if (Object.keys(updates).length === 0) return {};

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("profiles").update(updates).eq("id", userId);
  if (error) return { error: error.message, status: 500 };
  return {};
}

export async function updateDoctorProfile(
  doctorId: string,
  input: { roleTitle?: string; specialty?: string; bio?: string; experience?: string; priceLabel?: string },
): Promise<{ error?: string; status?: number }> {
  const updates: Record<string, unknown> = {};
  if (typeof input.roleTitle === "string") {
    const clean = input.roleTitle.trim().slice(0, 60);
    if (clean.length < 2) return { error: "Título profissional muito curto.", status: 400 };
    updates.role_title = clean;
  }
  if (typeof input.specialty === "string") {
    if (!(SPECIALTIES as readonly string[]).includes(input.specialty)) {
      return { error: "Especialidade inválida.", status: 400 };
    }
    updates.specialty = input.specialty;
  }
  if (typeof input.bio === "string") {
    updates.bio = input.bio.trim().slice(0, 500);
  }
  if (typeof input.experience === "string") {
    updates.experience = input.experience.trim().slice(0, 60);
  }
  if (typeof input.priceLabel === "string") {
    updates.price_label = input.priceLabel.trim().slice(0, 40) || "Gratuito (teste)";
  }

  if (Object.keys(updates).length === 0) return {};
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("professional_profiles").update(updates).eq("user_id", doctorId);
  if (error) return { error: error.message, status: 500 };
  return {};
}

export async function listDoctorsForAdmin(statusFilter?: string): Promise<PendingDoctorItem[]> {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("professional_profiles")
    .select("user_id, crm, crm_uf, specialty, status, rejection_reason, created_at")
    .order("created_at", { ascending: false });

  if (statusFilter && ["pendente", "aprovado", "recusado"].includes(statusFilter)) {
    query = query.eq("status", statusFilter);
  }

  const { data: pros, error } = await query;
  if (error) throw new Error(error.message);
  if (!pros || pros.length === 0) return [];

  const userIds = pros.map(p => String(p.user_id));
  const { data: profiles } = await supabase.from("profiles").select("id, name, email").in("id", userIds);
  const profileMap = new Map(
    (profiles ?? []).map(p => [String(p.id), { name: String(p.name), email: String(p.email) }]),
  );

  return pros.map(pro => {
    const profile = profileMap.get(String(pro.user_id));
    return {
      userId: String(pro.user_id),
      name: profile?.name ?? "Médico(a)",
      email: profile?.email ?? "",
      crm: String(pro.crm),
      crmUf: String(pro.crm_uf),
      specialty: String(pro.specialty),
      status: pro.status as ProfessionalStatus,
      rejectionReason: pro.rejection_reason ? String(pro.rejection_reason) : null,
      createdAt: String(pro.created_at),
    };
  });
}

export async function reviewDoctor(
  admin: AuthContext,
  doctorUserId: string,
  decision: "aprovado" | "recusado",
  rejectionReason?: string,
): Promise<{ error?: string; status?: number }> {
  if (decision !== "aprovado" && decision !== "recusado") {
    return { error: "Decisão inválida (use aprovado ou recusado).", status: 400 };
  }

  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase
    .from("professional_profiles")
    .select("user_id")
    .eq("user_id", doctorUserId)
    .maybeSingle();

  if (!existing) return { error: "Cadastro profissional não encontrado.", status: 404 };

  const reason = decision === "recusado" ? (rejectionReason ?? "").trim().slice(0, 300) || null : null;
  const { error } = await supabase
    .from("professional_profiles")
    .update({
      status: decision,
      rejection_reason: reason,
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("user_id", doctorUserId);

  if (error) return { error: error.message, status: 500 };
  return {};
}

export async function listReportsForAdmin(): Promise<ModerationReport[]> {
  const supabase = getSupabaseAdmin();
  const { data: rows, error } = await supabase
    .from("reports")
    .select("id, reporter_id, target_type, target_id, reported_user_id, reason, status, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0) return [];

  const profileIds = [
    ...new Set(rows.flatMap(r => [r.reporter_id, r.reported_user_id].filter(Boolean) as string[])),
  ];
  const postIds = rows.filter(r => r.target_type === "post").map(r => String(r.target_id));
  const commentIds = rows.filter(r => r.target_type === "comment").map(r => String(r.target_id));

  const [{ data: profiles }, { data: posts }, { data: comments }] = await Promise.all([
    profileIds.length > 0 ? supabase.from("profiles").select("id, name").in("id", profileIds) : Promise.resolve({ data: [] }),
    postIds.length > 0 ? supabase.from("posts").select("id, body").in("id", postIds) : Promise.resolve({ data: [] }),
    commentIds.length > 0
      ? supabase.from("comments").select("id, body").in("id", commentIds)
      : Promise.resolve({ data: [] }),
  ]);

  const nameMap = new Map((profiles ?? []).map(p => [String(p.id), String(p.name)]));
  const postMap = new Map((posts ?? []).map(p => [String(p.id), String(p.body)]));
  const commentMap = new Map((comments ?? []).map(c => [String(c.id), String(c.body)]));

  return rows.map(row => {
    const targetId = String(row.target_id);
    const targetType = row.target_type as ModerationReport["targetType"];
    let targetPreview: string | null = null;
    if (targetType === "post") targetPreview = postMap.get(targetId) ?? "(Publicação já removida)";
    else if (targetType === "comment") targetPreview = commentMap.get(targetId) ?? "(Comentário já removido)";

    return {
      id: String(row.id),
      targetType,
      targetId,
      reason: String(row.reason),
      status: row.status as ModerationReport["status"],
      createdAt: String(row.created_at),
      reporterName: nameMap.get(String(row.reporter_id)) ?? "Usuário",
      reportedUserId: row.reported_user_id ? String(row.reported_user_id) : null,
      reportedUserName: row.reported_user_id ? (nameMap.get(String(row.reported_user_id)) ?? "Usuário") : null,
      targetPreview,
    };
  });
}

export async function resolveReport(
  admin: AuthContext,
  reportId: string,
  action: "dismiss" | "remove_content",
): Promise<{ error?: string; status?: number }> {
  if (action !== "dismiss" && action !== "remove_content") {
    return { error: "Ação inválida.", status: 400 };
  }

  const supabase = getSupabaseAdmin();
  const { data: report } = await supabase
    .from("reports")
    .select("id, target_type, target_id")
    .eq("id", reportId)
    .maybeSingle();

  if (!report) return { error: "Denúncia não encontrada.", status: 404 };

  if (action === "remove_content") {
    if (report.target_type === "post") {
      await supabase.from("posts").delete().eq("id", String(report.target_id));
    } else if (report.target_type === "comment") {
      await supabase.from("comments").delete().eq("id", String(report.target_id));
    }
  }

  const nextStatus = action === "dismiss" ? "dismissed" : "reviewed";
  const { error } = await supabase
    .from("reports")
    .update({ status: nextStatus, reviewed_by: admin.id, reviewed_at: new Date().toISOString() })
    .eq("id", reportId);

  if (error) return { error: error.message, status: 500 };
  return {};
}
