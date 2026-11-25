import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { CurrentUser, ProfessionalStatus, UserRole } from "./types";

let adminClient: SupabaseClient | null = null;

export function getPublicSupabaseConfig() {
  const supabaseUrl = (process.env.SUPABASE_URL ?? process.env.BUN_PUBLIC_SUPABASE_URL ?? "").trim();
  const supabaseAnonKey = (process.env.SUPABASE_ANON_KEY ?? process.env.BUN_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
  return { supabaseUrl, supabaseAnonKey };
}

export function getSupabaseAdmin(): SupabaseClient {
  if (adminClient) return adminClient;

  const { supabaseUrl } = getPublicSupabaseConfig();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      "Configuração do servidor incompleta: defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.",
    );
  }

  adminClient = createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return adminClient;
}

function adminEmailSet(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map(email => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export type AuthContext = CurrentUser;

export type AuthCheck =
  | { ok: true; user: AuthContext }
  | { ok: false; status: number; error: string };

type ProfileRow = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  birth_date: string | null;
  anonymous_code: string;
  accepted_terms_at: string | null;
  accepted_health_data_at: string | null;
};

type ProfessionalRow = {
  user_id: string;
  crm: string;
  crm_uf: string;
  specialty: string;
  role_title: string;
  bio: string;
  experience: string;
  price_label: string;
  accent: string;
  status: ProfessionalStatus;
  rejection_reason: string | null;
};

function makeAnonymousCode(userId: string): string {
  return `P-${userId.replaceAll("-", "").slice(0, 6).toUpperCase()}`;
}

async function ensureProfile(supabase: SupabaseClient, authUser: User): Promise<ProfileRow> {
  const { data: existing } = await supabase
    .from("profiles")
    .select("id, email, name, role, birth_date, anonymous_code, accepted_terms_at, accepted_health_data_at")
    .eq("id", authUser.id)
    .maybeSingle<ProfileRow>();

  const email = (authUser.email ?? existing?.email ?? "").trim().toLowerCase();
  const isAdminEmail = email ? adminEmailSet().has(email) : false;

  if (existing) {
    if (isAdminEmail && existing.role !== "admin") {
      await supabase.from("profiles").update({ role: "admin" }).eq("id", existing.id);
      return { ...existing, role: "admin" };
    }
    return existing;
  }

  const meta = (authUser.user_metadata ?? {}) as Record<string, unknown>;
  const rawRole = meta.role === "medico" ? "medico" : "paciente";
  const role: UserRole = isAdminEmail ? "admin" : rawRole;
  const fallbackName = email.split("@")[0] || "Usuário";
  const name = typeof meta.name === "string" && meta.name.trim() ? meta.name.trim() : fallbackName;
  const birthDate =
    typeof meta.birthDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(meta.birthDate) ? meta.birthDate : null;
  const acceptedTermsAt = typeof meta.acceptedTermsAt === "string" ? meta.acceptedTermsAt : null;
  const acceptedHealthDataAt = typeof meta.acceptedHealthDataAt === "string" ? meta.acceptedHealthDataAt : null;

  const insertPayload = {
    id: authUser.id,
    email,
    name,
    role,
    birth_date: birthDate,
    anonymous_code: makeAnonymousCode(authUser.id),
    accepted_terms_at: acceptedTermsAt,
    accepted_health_data_at: acceptedHealthDataAt,
  };

  const { data: created, error } = await supabase
    .from("profiles")
    .upsert(insertPayload, { onConflict: "id" })
    .select("id, email, name, role, birth_date, anonymous_code, accepted_terms_at, accepted_health_data_at")
    .single<ProfileRow>();

  if (error || !created) {
    throw new Error(error?.message ?? "Não foi possível carregar o perfil do usuário.");
  }

  if (rawRole === "medico") {
    await supabase.from("professional_profiles").upsert(
      {
        user_id: authUser.id,
        crm: typeof meta.crm === "string" && meta.crm.trim() ? meta.crm.trim() : "000000",
        crm_uf: typeof meta.crmUf === "string" && meta.crmUf.trim() ? meta.crmUf.trim() : "SP",
        specialty: typeof meta.specialty === "string" && meta.specialty.trim() ? meta.specialty.trim() : "Outra",
        status: "pendente",
        accepted_truth_at: typeof meta.acceptedTruthAt === "string" ? meta.acceptedTruthAt : null,
      },
      { onConflict: "user_id" },
    );
  }

  return created;
}

export async function authenticateRequest(req: Request): Promise<AuthCheck> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) {
    return { ok: false, status: 401, error: "Faça login para continuar." };
  }

  let supabase: SupabaseClient;
  try {
    supabase = getSupabaseAdmin();
  } catch (err) {
    return { ok: false, status: 500, error: err instanceof Error ? err.message : "Erro de configuração." };
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return { ok: false, status: 401, error: "Sessão expirada ou inválida. Entre novamente." };
  }

  try {
    const profile = await ensureProfile(supabase, data.user);
    let professional: CurrentUser["professional"] = null;

    if (profile.role === "medico") {
      const { data: proRow } = await supabase
        .from("professional_profiles")
        .select("user_id, crm, crm_uf, specialty, role_title, bio, experience, price_label, accent, status, rejection_reason")
        .eq("user_id", profile.id)
        .maybeSingle<ProfessionalRow>();

      if (proRow) {
        professional = {
          crm: proRow.crm,
          crmUf: proRow.crm_uf,
          specialty: proRow.specialty,
          roleTitle: proRow.role_title,
          bio: proRow.bio,
          experience: proRow.experience,
          priceLabel: proRow.price_label,
          accent: proRow.accent,
          status: proRow.status,
          rejectionReason: proRow.rejection_reason,
        };
      }
    }

    return {
      ok: true,
      user: {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        role: profile.role,
        anonymousCode: profile.anonymous_code,
        birthDate: profile.birth_date,
        acceptedTermsAt: profile.accepted_terms_at,
        acceptedHealthDataAt: profile.accepted_health_data_at,
        professional,
      },
    };
  } catch (err) {
    return {
      ok: false,
      status: 500,
      error: err instanceof Error ? err.message : "Não foi possível validar sua conta.",
    };
  }
}

export function isApprovedDoctor(user: AuthContext): boolean {
  return user.role === "medico" && user.professional?.status === "aprovado";
}

export function isAdmin(user: AuthContext): boolean {
  return user.role === "admin";
}
