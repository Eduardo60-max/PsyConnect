import type {
  BlockedUser,
  ChallengeRankEntry,
  CommunityGroup,
  FeedPost,
  ModerationReport,
  ReportTargetType,
} from "./types";
import type { AuthContext } from "./supabaseServer";
import { getSupabaseAdmin } from "./supabaseServer";
import { categories } from "./data";
import { formatTimeLabel, handleFor } from "./timeUtils";

type GroupRow = {
  id: string;
  name: string;
  description: string;
  theme: string;
  admin_id: string | null;
  is_temporary: boolean;
  duration_days: number | null;
  accent: string;
};

type PostRow = {
  id: string;
  group_id: string;
  user_id: string;
  author_name: string;
  author_handle: string;
  body: string;
  created_at: string;
};

type ProfileBrief = {
  id: string;
  name: string;
};

type ProBrief = {
  user_id: string;
  specialty: string;
  accent: string;
  status: string;
};

const VALID_THEMES = new Set(categories.map(c => c.id));
const VALID_ACCENTS = new Set(["#8b5cf6", "#0f766e", "#db2777", "#f59e0b", "#16a34a", "#2563eb", "#be123c", "#7c3aed"]);

export async function listBlockedUserIds(userId: string): Promise<Set<string>> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from("user_blocks").select("blocked_id").eq("blocker_id", userId);
  return new Set((data ?? []).map(row => String(row.blocked_id)));
}

export async function listBlockedUsers(userId: string): Promise<BlockedUser[]> {
  const supabase = getSupabaseAdmin();
  const { data: blocks, error } = await supabase
    .from("user_blocks")
    .select("blocked_id, created_at")
    .eq("blocker_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  if (!blocks || blocks.length === 0) return [];

  const ids = blocks.map(item => String(item.blocked_id));
  const { data: profiles } = await supabase.from("profiles").select("id, name").in("id", ids);
  const nameById = new Map((profiles ?? []).map(p => [String(p.id), String(p.name)]));

  return blocks.map(row => ({
    id: String(row.blocked_id),
    name: nameById.get(String(row.blocked_id)) ?? "Usuário",
    createdAt: String(row.created_at),
  }));
}

export async function blockUser(blockerId: string, targetUserId: string): Promise<{ error?: string; status?: number }> {
  if (!targetUserId || blockerId === targetUserId) {
    return { error: "Usuário inválido para bloqueio.", status: 400 };
  }
  const supabase = getSupabaseAdmin();
  const { data: target } = await supabase.from("profiles").select("id").eq("id", targetUserId).maybeSingle();
  if (!target) return { error: "Usuário não encontrado.", status: 404 };

  const { error } = await supabase
    .from("user_blocks")
    .upsert({ blocker_id: blockerId, blocked_id: targetUserId }, { onConflict: "blocker_id,blocked_id" });
  if (error) return { error: error.message, status: 500 };
  return {};
}

export async function unblockUser(blockerId: string, targetUserId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  await supabase.from("user_blocks").delete().eq("blocker_id", blockerId).eq("blocked_id", targetUserId);
}

export async function listGroups(userId: string): Promise<CommunityGroup[]> {
  const supabase = getSupabaseAdmin();
  const [{ data: groups, error }, { data: members }] = await Promise.all([
    supabase
      .from("groups")
      .select("id, name, description, theme, admin_id, is_temporary, duration_days, accent")
      .order("created_at", { ascending: true }),
    supabase.from("group_members").select("group_id, user_id"),
  ]);

  if (error) throw new Error(error.message);

  const adminIds = [...new Set((groups ?? []).map(g => g.admin_id).filter(Boolean) as string[])];
  let profileMap = new Map<string, ProfileBrief>();
  let proMap = new Map<string, ProBrief>();

  if (adminIds.length > 0) {
    const [{ data: profiles }, { data: pros }] = await Promise.all([
      supabase.from("profiles").select("id, name").in("id", adminIds),
      supabase.from("professional_profiles").select("user_id, specialty, accent, status").in("user_id", adminIds),
    ]);
    profileMap = new Map((profiles ?? []).map(p => [String(p.id), p as ProfileBrief]));
    proMap = new Map((pros ?? []).map(p => [String(p.user_id), p as ProBrief]));
  }

  const countByGroup = new Map<string, number>();
  const joinedSet = new Set<string>();
  for (const row of members ?? []) {
    const gid = String(row.group_id);
    countByGroup.set(gid, (countByGroup.get(gid) ?? 0) + 1);
    if (String(row.user_id) === userId) joinedSet.add(gid);
  }

  return ((groups ?? []) as GroupRow[]).map(group => {
    const adminProfile = group.admin_id ? profileMap.get(group.admin_id) : undefined;
    const adminPro = group.admin_id ? proMap.get(group.admin_id) : undefined;
    return {
      id: group.id,
      name: group.name,
      description: group.description,
      theme: group.theme,
      adminId: group.admin_id,
      adminName: adminProfile?.name,
      adminSpecialty: adminPro?.specialty,
      adminAccent: adminPro?.accent ?? group.accent,
      members: countByGroup.get(group.id) ?? 0,
      joined: joinedSet.has(group.id),
      isTemporary: group.is_temporary,
      durationDays: group.duration_days ?? undefined,
      accent: group.accent,
    };
  });
}

export async function createGroup(
  user: AuthContext,
  input: {
    name: string;
    description: string;
    theme: string;
    adminId?: string | null;
    isTemporary: boolean;
    durationDays?: number | null;
    accent: string;
  },
): Promise<{ error?: string; status?: number }> {
  const name = input.name.trim().slice(0, 80);
  const description = input.description.trim().slice(0, 400);
  const theme = VALID_THEMES.has(input.theme) ? input.theme : "";
  const accent = VALID_ACCENTS.has(input.accent) ? input.accent : "#7c3aed";
  const isTemporary = Boolean(input.isTemporary);
  const durationDays = isTemporary ? Number(input.durationDays) : null;

  if (name.length < 3) return { error: "Informe um nome de grupo com pelo menos 3 caracteres.", status: 400 };
  if (description.length < 5) return { error: "Descreva o objetivo do grupo.", status: 400 };
  if (!theme) return { error: "Escolha um tema válido para o grupo.", status: 400 };
  if (isTemporary && (!Number.isInteger(durationDays) || (durationDays ?? 0) < 1 || (durationDays ?? 0) > 90)) {
    return { error: "A duração do desafio deve estar entre 1 e 90 dias.", status: 400 };
  }

  const supabase = getSupabaseAdmin();
  let resolvedAdminId: string | null = null;
  if (user.role === "medico" && user.professional?.status === "aprovado") {
    resolvedAdminId = user.id;
  } else if (input.adminId) {
    const { data: pro } = await supabase
      .from("professional_profiles")
      .select("user_id")
      .eq("user_id", input.adminId)
      .eq("status", "aprovado")
      .maybeSingle();
    if (pro) resolvedAdminId = String(pro.user_id);
  }

  const id = `grp-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const { error } = await supabase.from("groups").insert({
    id,
    name,
    description,
    theme,
    admin_id: resolvedAdminId,
    is_temporary: isTemporary,
    duration_days: durationDays,
    accent,
  });

  if (error) return { error: error.message, status: 500 };

  await supabase.from("group_members").upsert({ group_id: id, user_id: user.id }, { onConflict: "group_id,user_id" });
  return {};
}

export async function toggleGroupJoin(
  userId: string,
  groupId: string,
): Promise<{ joined: boolean; members: number } | null> {
  const supabase = getSupabaseAdmin();
  const { data: group } = await supabase.from("groups").select("id").eq("id", groupId).maybeSingle();
  if (!group) return null;

  const { data: existing } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();

  let joined = false;
  if (existing) {
    await supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", userId);
    joined = false;
  } else {
    await supabase.from("group_members").insert({ group_id: groupId, user_id: userId });
    joined = true;
  }

  const { count } = await supabase
    .from("group_members")
    .select("*", { count: "exact", head: true })
    .eq("group_id", groupId);

  return { joined, members: count ?? 0 };
}

async function hydratePosts(user: AuthContext, rows: PostRow[]): Promise<FeedPost[]> {
  if (rows.length === 0) return [];
  const supabase = getSupabaseAdmin();
  const blocked = await listBlockedUserIds(user.id);
  const visibleRows = rows.filter(row => !blocked.has(row.user_id));
  if (visibleRows.length === 0) return [];

  const postIds = visibleRows.map(row => row.id);
  const groupIds = [...new Set(visibleRows.map(row => row.group_id))];

  const [{ data: likeRows }, { data: commentRows }, { data: groupRows }] = await Promise.all([
    supabase.from("likes").select("post_id, user_id").in("post_id", postIds),
    supabase.from("comments").select("post_id, user_id").in("post_id", postIds),
    supabase.from("groups").select("id, name, theme, admin_id").in("id", groupIds),
  ]);

  const likesCount = new Map<string, number>();
  const likedByMe = new Set<string>();
  for (const row of likeRows ?? []) {
    const pid = String(row.post_id);
    likesCount.set(pid, (likesCount.get(pid) ?? 0) + 1);
    if (String(row.user_id) === user.id) likedByMe.add(pid);
  }

  const commentsCount = new Map<string, number>();
  for (const row of commentRows ?? []) {
    if (blocked.has(String(row.user_id))) continue;
    const pid = String(row.post_id);
    commentsCount.set(pid, (commentsCount.get(pid) ?? 0) + 1);
  }

  const groupMap = new Map(
    (groupRows ?? []).map(g => [
      String(g.id),
      { name: String(g.name), theme: String(g.theme), adminId: g.admin_id ? String(g.admin_id) : null },
    ]),
  );

  return visibleRows.map(row => {
    const groupInfo = groupMap.get(row.group_id);
    const canDelete =
      row.user_id === user.id || user.role === "admin" || (groupInfo?.adminId !== null && groupInfo?.adminId === user.id);

    return {
      id: row.id,
      groupId: row.group_id,
      groupName: groupInfo?.name,
      groupTheme: groupInfo?.theme,
      userId: row.user_id,
      author: row.author_name,
      handle: row.author_handle,
      body: row.body,
      time: formatTimeLabel(row.created_at),
      createdAt: row.created_at,
      likes: likesCount.get(row.id) ?? 0,
      comments: commentsCount.get(row.id) ?? 0,
      liked: likedByMe.has(row.id),
      canDelete,
    };
  });
}

export async function listPosts(user: AuthContext, groupId: string): Promise<FeedPost[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("posts")
    .select("id, group_id, user_id, author_name, author_handle, body, created_at")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(60);

  if (error) throw new Error(error.message);
  return hydratePosts(user, (data ?? []) as PostRow[]);
}

export async function listHomeFeed(user: AuthContext, theme = "all"): Promise<FeedPost[]> {
  const supabase = getSupabaseAdmin();
  let groupIds: string[] | null = null;
  if (theme !== "all") {
    const { data: themeGroups } = await supabase.from("groups").select("id").eq("theme", theme);
    groupIds = (themeGroups ?? []).map(g => String(g.id));
    if (groupIds.length === 0) return [];
  }

  let query = supabase
    .from("posts")
    .select("id, group_id, user_id, author_name, author_handle, body, created_at")
    .order("created_at", { ascending: false })
    .limit(30);

  if (groupIds) query = query.in("group_id", groupIds);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return hydratePosts(user, (data ?? []) as PostRow[]);
}

export async function addPost(
  user: AuthContext,
  groupId: string,
  body: string,
): Promise<{ error?: string; status?: number }> {
  const cleanBody = body.trim();
  if (!cleanBody) return { error: "O post não pode estar vazio.", status: 400 };
  if (cleanBody.length > 1000) return { error: "O post pode ter no máximo 1000 caracteres.", status: 400 };

  const supabase = getSupabaseAdmin();
  const { data: group } = await supabase.from("groups").select("id").eq("id", groupId).maybeSingle();
  if (!group) return { error: "Grupo não encontrado.", status: 404 };

  const { error } = await supabase.from("posts").insert({
    id: `post-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    group_id: groupId,
    user_id: user.id,
    author_name: user.name,
    author_handle: handleFor(user.name),
    body: cleanBody,
  });

  if (error) return { error: error.message, status: 500 };
  return {};
}

export async function deletePost(user: AuthContext, postId: string): Promise<{ error?: string; status?: number }> {
  const supabase = getSupabaseAdmin();
  const { data: post } = await supabase.from("posts").select("id, user_id, group_id").eq("id", postId).maybeSingle();
  if (!post) return { error: "Publicação não encontrada.", status: 404 };

  let isGroupAdmin = false;
  if (user.role === "medico") {
    const { data: group } = await supabase.from("groups").select("admin_id").eq("id", post.group_id).maybeSingle();
    isGroupAdmin = Boolean(group?.admin_id && String(group.admin_id) === user.id);
  }

  if (String(post.user_id) !== user.id && user.role !== "admin" && !isGroupAdmin) {
    return { error: "Você não tem permissão para remover esta publicação.", status: 403 };
  }

  const { error } = await supabase.from("posts").delete().eq("id", postId);
  if (error) return { error: error.message, status: 500 };
  return {};
}

export async function togglePostLike(
  userId: string,
  postId: string,
): Promise<{ liked: boolean; likes: number } | null> {
  const supabase = getSupabaseAdmin();
  const { data: post } = await supabase.from("posts").select("id").eq("id", postId).maybeSingle();
  if (!post) return null;

  const { data: existing } = await supabase
    .from("likes")
    .select("post_id")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle();

  let liked = false;
  if (existing) {
    await supabase.from("likes").delete().eq("post_id", postId).eq("user_id", userId);
    liked = false;
  } else {
    await supabase.from("likes").insert({ post_id: postId, user_id: userId });
    liked = true;
  }

  const { count } = await supabase.from("likes").select("*", { count: "exact", head: true }).eq("post_id", postId);
  return { liked, likes: count ?? 0 };
}

export async function listChallengeDays(userId: string, groupId: string): Promise<number[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("challenge_progress")
    .select("day")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .order("day", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map(row => Number(row.day));
}

export async function toggleChallengeDay(
  userId: string,
  groupId: string,
  day: number,
): Promise<{ days?: number[]; error?: string; status?: number }> {
  const supabase = getSupabaseAdmin();
  const { data: group } = await supabase
    .from("groups")
    .select("is_temporary, duration_days")
    .eq("id", groupId)
    .maybeSingle();

  if (!group || !group.is_temporary || !group.duration_days) {
    return { error: "Este grupo não possui desafio ativo.", status: 400 };
  }
  if (!Number.isInteger(day) || day < 1 || day > Number(group.duration_days)) {
    return { error: "Dia fora do intervalo do desafio.", status: 400 };
  }

  const { data: existing } = await supabase
    .from("challenge_progress")
    .select("day")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .eq("day", day)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("challenge_progress")
      .delete()
      .eq("group_id", groupId)
      .eq("user_id", userId)
      .eq("day", day);
  } else {
    await supabase.from("challenge_progress").insert({ group_id: groupId, user_id: userId, day });
  }

  return { days: await listChallengeDays(userId, groupId) };
}

export async function listChallengeRanking(userId: string, groupId: string): Promise<ChallengeRankEntry[]> {
  const supabase = getSupabaseAdmin();
  const [blocked, { data: rows, error }] = await Promise.all([
    listBlockedUserIds(userId),
    supabase.from("challenge_progress").select("user_id").eq("group_id", groupId),
  ]);

  if (error) throw new Error(error.message);

  const countByUser = new Map<string, number>();
  for (const row of rows ?? []) {
    const uid = String(row.user_id);
    if (blocked.has(uid)) continue;
    countByUser.set(uid, (countByUser.get(uid) ?? 0) + 1);
  }

  if (!countByUser.has(userId)) {
    countByUser.set(userId, 0);
  }

  const userIds = [...countByUser.keys()];
  const { data: profiles } = await supabase.from("profiles").select("id, name").in("id", userIds);
  const nameMap = new Map((profiles ?? []).map(p => [String(p.id), String(p.name)]));

  return userIds
    .map(uid => {
      const fullName = nameMap.get(uid) ?? "Participante";
      const firstName = fullName.trim().split(/\s+/)[0] || "Participante";
      return {
        name: firstName,
        done: countByUser.get(uid) ?? 0,
        isYou: uid === userId,
      };
    })
    .sort((a, b) => b.done - a.done || Number(b.isYou) - Number(a.isYou))
    .slice(0, 15);
}

export async function createReport(
  reporterId: string,
  input: { targetType: string; targetId: string; reason: string; reportedUserId?: string },
): Promise<{ error?: string; status?: number }> {
  const allowedTargets: ReportTargetType[] = ["post", "comment", "user", "message"];
  if (!allowedTargets.includes(input.targetType as ReportTargetType)) {
    return { error: "Tipo de denúncia inválido.", status: 400 };
  }
  const targetId = input.targetId.trim();
  const reason = input.reason.trim().slice(0, 400);
  if (!targetId) return { error: "Item denunciado inválido.", status: 400 };
  if (reason.length < 3) return { error: "Descreva o motivo da denúncia.", status: 400 };

  const supabase = getSupabaseAdmin();
  let reportedUserId: string | null = input.reportedUserId?.trim() || null;

  if (!reportedUserId && input.targetType === "post") {
    const { data } = await supabase.from("posts").select("user_id").eq("id", targetId).maybeSingle();
    if (data?.user_id) reportedUserId = String(data.user_id);
  } else if (!reportedUserId && input.targetType === "comment") {
    const { data } = await supabase.from("comments").select("user_id").eq("id", targetId).maybeSingle();
    if (data?.user_id) reportedUserId = String(data.user_id);
  } else if (!reportedUserId && input.targetType === "user") {
    reportedUserId = targetId;
  }

  const { error } = await supabase.from("reports").insert({
    reporter_id: reporterId,
    target_type: input.targetType,
    target_id: targetId,
    reported_user_id: reportedUserId,
    reason,
    status: "open",
  });

  if (error) return { error: error.message, status: 500 };
  return {};
}
