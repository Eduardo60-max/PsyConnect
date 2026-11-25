import type { PostComment } from "./types";
import type { AuthContext } from "./supabaseServer";
import { getSupabaseAdmin } from "./supabaseServer";
import { listBlockedUserIds } from "./db";
import { formatTimeLabel, handleFor } from "./timeUtils";

type CommentRow = {
  id: string;
  post_id: string;
  user_id: string;
  author_name: string;
  author_handle: string;
  body: string;
  created_at: string;
};

export async function listComments(user: AuthContext, postId: string): Promise<PostComment[]> {
  const supabase = getSupabaseAdmin();
  const [blocked, { data, error }] = await Promise.all([
    listBlockedUserIds(user.id),
    supabase
      .from("comments")
      .select("id, post_id, user_id, author_name, author_handle, body, created_at")
      .eq("post_id", postId)
      .order("created_at", { ascending: true }),
  ]);

  if (error) throw new Error(error.message);

  return ((data ?? []) as CommentRow[])
    .filter(row => !blocked.has(row.user_id))
    .map(row => ({
      id: row.id,
      postId: row.post_id,
      userId: row.user_id,
      author: row.author_name,
      handle: row.author_handle,
      body: row.body,
      time: formatTimeLabel(row.created_at),
      canDelete: row.user_id === user.id || user.role === "admin",
    }));
}

export async function addComment(
  user: AuthContext,
  postId: string,
  body: string,
): Promise<{ error?: string; status?: number }> {
  const text = body.trim();
  if (!text) return { error: "O comentário não pode estar vazio.", status: 400 };
  if (text.length > 500) return { error: "O comentário pode ter no máximo 500 caracteres.", status: 400 };

  const supabase = getSupabaseAdmin();
  const { data: post } = await supabase.from("posts").select("id").eq("id", postId).maybeSingle();
  if (!post) return { error: "Publicação não encontrada.", status: 404 };

  const { error } = await supabase.from("comments").insert({
    id: `comment-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    post_id: postId,
    user_id: user.id,
    author_name: user.name,
    author_handle: handleFor(user.name),
    body: text,
  });

  if (error) return { error: error.message, status: 500 };
  return {};
}

export async function deleteComment(user: AuthContext, commentId: string): Promise<{ error?: string; status?: number }> {
  const supabase = getSupabaseAdmin();
  const { data: comment } = await supabase.from("comments").select("id, user_id").eq("id", commentId).maybeSingle();
  if (!comment) return { error: "Comentário não encontrado.", status: 404 };
  if (String(comment.user_id) !== user.id && user.role !== "admin") {
    return { error: "Você não tem permissão para remover este comentário.", status: 403 };
  }

  const { error } = await supabase.from("comments").delete().eq("id", commentId);
  if (error) return { error: error.message, status: 500 };
  return {};
}
