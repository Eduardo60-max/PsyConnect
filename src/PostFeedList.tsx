import { useState, type SyntheticEvent } from "react";
import type { FeedPost, PostComment, ReportTargetType } from "./types";
import { avatarInitial } from "./utils";
import {
  addPostCommentRequest,
  blockUserRequest,
  deleteCommentRequest,
  deletePostRequest,
  fetchPostComments,
} from "./api";
import { ReportModal } from "./ReportModal";

type PostFeedListProps = {
  posts: FeedPost[];
  currentUserId: string;
  adminId?: string | null;
  emptyMessage: string;
  compact?: boolean;
  showGroupBadge?: boolean;
  onToggleLike: (post: FeedPost) => void;
  onDeletedPost: (postId: string) => void;
  onBlockedUser: (blockedUserId: string) => void;
  onFindSupport?: (theme: string) => void;
};

type ReportTarget = {
  targetType: ReportTargetType;
  targetId: string;
  reportedUserId: string;
  targetLabel: string;
};

export function PostFeedList({
  posts,
  currentUserId,
  adminId,
  emptyMessage,
  compact = false,
  showGroupBadge = false,
  onToggleLike,
  onDeletedPost,
  onBlockedUser,
  onFindSupport,
}: Readonly<PostFeedListProps>) {
  const [openPostId, setOpenPostId] = useState<string | null>(null);
  const [commentsByPost, setCommentsByPost] = useState<Record<string, PostComment[]>>({});
  const [loadingPostId, setLoadingPostId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentError, setCommentError] = useState("");
  const [isSendingComment, setIsSendingComment] = useState(false);

  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [actionNotice, setActionNotice] = useState("");

  const handleToggleComments = (postId: string) => {
    setCommentError("");
    setCommentDraft("");
    if (openPostId === postId) {
      setOpenPostId(null);
      return;
    }
    setOpenPostId(postId);
    if (commentsByPost[postId] || postId.startsWith("temp-")) return;

    setLoadingPostId(postId);
    fetchPostComments(postId)
      .then(comments => setCommentsByPost(current => ({ ...current, [postId]: comments })))
      .catch(() => setCommentError("Não foi possível carregar os comentários."))
      .finally(() => setLoadingPostId(null));
  };

  const handleSendComment = async (event: SyntheticEvent, postId: string) => {
    event.preventDefault();
    const text = commentDraft.trim();
    if (!text || isSendingComment) return;

    setIsSendingComment(true);
    setCommentError("");
    try {
      const comments = await addPostCommentRequest(postId, text);
      setCommentsByPost(current => ({ ...current, [postId]: comments }));
      setCommentDraft("");
    } catch (error) {
      setCommentError(error instanceof Error ? error.message : "Não foi possível enviar o comentário.");
    } finally {
      setIsSendingComment(false);
    }
  };

  const handleDeletePost = async (post: FeedPost) => {
    if (!window.confirm("Remover esta publicação permanentemente?")) return;
    try {
      await deletePostRequest(post.id);
      onDeletedPost(post.id);
    } catch (error) {
      setActionNotice(error instanceof Error ? error.message : "Não foi possível remover a publicação.");
    }
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    if (!window.confirm("Remover este comentário?")) return;
    try {
      await deleteCommentRequest(commentId);
      setCommentsByPost(current => ({
        ...current,
        [postId]: (current[postId] ?? []).filter(c => c.id !== commentId),
      }));
    } catch (error) {
      setCommentError(error instanceof Error ? error.message : "Não foi possível remover o comentário.");
    }
  };

  const handleBlockUser = async (targetUserId: string, targetName: string) => {
    if (!window.confirm(`Bloquear ${targetName}? Você não verá mais publicações ou comentários dessa pessoa.`)) return;
    try {
      await blockUserRequest(targetUserId);
      setCommentsByPost(current => {
        const next: Record<string, PostComment[]> = {};
        for (const [pid, list] of Object.entries(current)) {
          next[pid] = list.filter(c => c.userId !== targetUserId);
        }
        return next;
      });
      onBlockedUser(targetUserId);
      setActionNotice(`${targetName} foi bloqueado(a). Você pode gerenciar bloqueios no seu Perfil.`);
    } catch (error) {
      setActionNotice(error instanceof Error ? error.message : "Não foi possível bloquear o usuário.");
    }
  };

  return (
    <>
      {actionNotice && (
        <output className="auth-success" onClick={() => setActionNotice("")}>
          {actionNotice}
        </output>
      )}

      {posts.length === 0 && <p className="empty-state">{emptyMessage}</p>}

      {posts.map(post => {
        const isOpen = openPostId === post.id;
        const comments = commentsByPost[post.id] ?? [];
        const commentCount = Math.max(post.comments, comments.length);
        const isOwnPost = post.userId === currentUserId;
        const isResponsible = Boolean(adminId && post.userId === adminId);

        return (
          <article key={post.id} className={compact ? "feed-card feed-card-compact" : "feed-card"}>
            <div className="feed-card-top">
              <div className="avatar">{avatarInitial(post.author)}</div>
              <div className="feed-card-head-info">
                <div className="feed-author-row">
                  <strong>{post.author}</strong>
                  {isResponsible && <span className="pro-badge">Responsável</span>}
                  <span>{post.handle}</span>
                  <span>•</span>
                  <span>{post.time}</span>
                </div>
                {showGroupBadge && post.groupName && <p className="feed-group">{post.groupName}</p>}
              </div>
            </div>

            <p className="feed-body">{post.body}</p>

            <div className="feed-actions feed-actions-wrap">
              <div className="feed-actions-left">
                <button
                  type="button"
                  className={post.liked ? "like-btn liked" : "like-btn"}
                  onClick={() => onToggleLike(post)}
                  aria-pressed={Boolean(post.liked)}
                  aria-label={post.liked ? "Remover curtida" : "Curtir"}
                >
                  {post.liked ? "♥" : "♡"} {post.likes}
                </button>
                <button
                  type="button"
                  className={isOpen ? "like-btn comment-toggle open" : "like-btn comment-toggle"}
                  onClick={() => handleToggleComments(post.id)}
                  aria-expanded={isOpen}
                  aria-label={isOpen ? "Ocultar comentários" : "Ver comentários"}
                >
                  💬 {commentCount}
                </button>
              </div>

              <div className="feed-moderation-actions">
                {onFindSupport && post.groupTheme && (
                  <button type="button" className="text-link" onClick={() => onFindSupport(post.groupTheme!)}>
                    Encontrar apoio
                  </button>
                )}
                {post.canDelete && !post.id.startsWith("temp-") && (
                  <button type="button" className="text-link danger-link" onClick={() => handleDeletePost(post)}>
                    Remover
                  </button>
                )}
                {!isOwnPost && !post.id.startsWith("temp-") && (
                  <>
                    <button
                      type="button"
                      className="text-link muted-link"
                      onClick={() =>
                        setReportTarget({
                          targetType: "post",
                          targetId: post.id,
                          reportedUserId: post.userId,
                          targetLabel: `publicação de ${post.author}`,
                        })
                      }
                    >
                      Denunciar
                    </button>
                    <button
                      type="button"
                      className="text-link muted-link"
                      onClick={() => handleBlockUser(post.userId, post.author)}
                    >
                      Bloquear
                    </button>
                  </>
                )}
              </div>
            </div>

            {isOpen && (
              <div className="comments-section">
                {loadingPostId === post.id && <p className="comments-empty">Carregando comentários...</p>}
                {loadingPostId !== post.id && comments.length === 0 && (
                  <p className="comments-empty">Ainda não há comentários. Comece a conversa!</p>
                )}

                {comments.map(comment => (
                  <div key={comment.id} className="comment-item">
                    <div className="avatar avatar-small">{avatarInitial(comment.author)}</div>
                    <div className="comment-bubble">
                      <div className="comment-meta">
                        <strong>{comment.author}</strong>
                        <span>{comment.handle}</span>
                        <span>•</span>
                        <span>{comment.time}</span>
                        {comment.canDelete && (
                          <button
                            type="button"
                            className="text-link danger-link comment-action-link"
                            onClick={() => handleDeleteComment(post.id, comment.id)}
                          >
                            Remover
                          </button>
                        )}
                        {comment.userId !== currentUserId && (
                          <>
                            <button
                              type="button"
                              className="text-link muted-link comment-action-link"
                              onClick={() =>
                                setReportTarget({
                                  targetType: "comment",
                                  targetId: comment.id,
                                  reportedUserId: comment.userId,
                                  targetLabel: `comentário de ${comment.author}`,
                                })
                              }
                            >
                              Denunciar
                            </button>
                            <button
                              type="button"
                              className="text-link muted-link comment-action-link"
                              onClick={() => handleBlockUser(comment.userId, comment.author)}
                            >
                              Bloquear
                            </button>
                          </>
                        )}
                      </div>
                      <p>{comment.body}</p>
                    </div>
                  </div>
                ))}

                {post.id.startsWith("temp-") ? (
                  <p className="comments-empty">Aguarde a publicação ser salva para comentar.</p>
                ) : (
                  <form onSubmit={event => handleSendComment(event, post.id)} className="comment-form">
                    <input
                      type="text"
                      value={commentDraft}
                      onChange={event => setCommentDraft(event.target.value)}
                      placeholder="Escreva um comentário acolhedor..."
                      maxLength={500}
                      aria-label="Escrever comentário"
                    />
                    <button
                      type="submit"
                      className="primary-btn small"
                      disabled={isSendingComment || !commentDraft.trim()}
                    >
                      {isSendingComment ? "..." : "Enviar"}
                    </button>
                  </form>
                )}

                {commentError && <p className="field-error">{commentError}</p>}
              </div>
            )}
          </article>
        );
      })}

      {reportTarget && (
        <ReportModal
          targetType={reportTarget.targetType}
          targetId={reportTarget.targetId}
          reportedUserId={reportTarget.reportedUserId}
          targetLabel={reportTarget.targetLabel}
          onClose={() => setReportTarget(null)}
          onSubmitted={() => {
            setReportTarget(null);
            setActionNotice("Denúncia enviada para análise da equipe. Obrigado por ajudar a manter o espaço seguro.");
          }}
        />
      )}
    </>
  );
}
