import { useState, type SyntheticEvent } from "react";
import type { Category, CommunityGroup, FeedPost, PostComment, Professional } from "./types";
import { avatarInitial } from "./utils";
import { addPostCommentRequest, fetchPostComments } from "./api";
import { ChallengeStatsPanel } from "./ChallengeStatsPanel";

type GroupRoomProps = {
  group: CommunityGroup;
  admin: Professional | undefined;
  category: Category | undefined;
  posts: FeedPost[];
  completedDays: number[];
  userName: string;
  showWelcome: boolean;
  onDismissWelcome: () => void;
  onToggleDay: (groupId: string, day: number) => void;
  onAddPost: (groupId: string, body: string) => void;
  onToggleLike: (groupId: string, postId: string) => void;
  onLeave: (groupId: string) => void;
  onBack: () => void;
};

type Tab = "mural" | "desafio" | "sobre";

export function GroupRoom({
  group,
  admin,
  category,
  posts,
  completedDays,
  userName,
  showWelcome,
  onDismissWelcome,
  onToggleDay,
  onAddPost,
  onToggleLike,
  onLeave,
  onBack,
}: Readonly<GroupRoomProps>) {
  const [tab, setTab] = useState<Tab>("mural");
  const [draft, setDraft] = useState("");

  const [openPostId, setOpenPostId] = useState<string | null>(null);
  const [commentsByPost, setCommentsByPost] = useState<Record<string, PostComment[]>>({});
  const [loadingPostId, setLoadingPostId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentError, setCommentError] = useState("");
  const [isSendingComment, setIsSendingComment] = useState(false);

  const duration = group.durationDays ?? 0;
  const hasChallenge = group.isTemporary && duration > 0;
  const progressPercent = duration > 0 ? Math.round((completedDays.length / duration) * 100) : 0;

  const handlePost = (event: SyntheticEvent) => {
    event.preventDefault();
    if (!draft.trim()) return;
    onAddPost(group.id, draft.trim());
    setDraft("");
    onDismissWelcome();
  };

  const handleIntroduce = () => {
    setTab("mural");
    setDraft("Oi, pessoal! Estou chegando agora no grupo. Prazer em conhecer vocês 💜");
  };

  const handleLeave = () => {
    if (window.confirm(`Sair do grupo "${group.name}"?`)) onLeave(group.id);
  };

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

  return (
    <main className="screen group-room">
      <button type="button" className="secondary-btn small" onClick={onBack}>
        ← Voltar aos grupos
      </button>

      <section className="room-hero" style={{ background: `linear-gradient(135deg, ${group.accent}, #2563eb)` }}>
        <div className="room-hero-top">
          <div>
            <p className="room-hero-eyebrow">
              {category?.label}
              {group.isTemporary ? " · Desafio" : ""}
            </p>
            <h2>{group.name}</h2>
          </div>
          <span className="room-member-badge">✓ Você é membro</span>
        </div>
        <p className="room-hero-meta">
          {group.members.toLocaleString("pt-BR")} participantes · {posts.length} publicações
          {admin ? ` · com ${admin.name}` : ""}
        </p>
      </section>

      {showWelcome && (
        <output className="welcome-banner">
          <div>
            <strong>Você entrou em {group.name}! 🎉</strong>
            <p>Este é o seu espaço. Que tal começar se apresentando para o grupo?</p>
          </div>
          <div className="welcome-actions">
            <button type="button" className="primary-btn small" onClick={handleIntroduce}>
              Me apresentar
            </button>
            <button type="button" className="icon-btn" aria-label="Fechar aviso" onClick={onDismissWelcome}>
              ✕
            </button>
          </div>
        </output>
      )}

      <div className="room-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "mural"} className={tab === "mural" ? "room-tab active" : "room-tab"} onClick={() => setTab("mural")}>
          Mural
        </button>
        {hasChallenge && (
          <button type="button" role="tab" aria-selected={tab === "desafio"} className={tab === "desafio" ? "room-tab active" : "room-tab"} onClick={() => setTab("desafio")}>
            Desafio
          </button>
        )}
        <button type="button" role="tab" aria-selected={tab === "sobre"} className={tab === "sobre" ? "room-tab active" : "room-tab"} onClick={() => setTab("sobre")}>
          Sobre
        </button>
      </div>

      {tab === "mural" && (
        <section className="room-content">
          <form onSubmit={handlePost} className="group-post-composer">
            <textarea
              value={draft}
              onChange={event => setDraft(event.target.value)}
              placeholder="Compartilhe algo com o grupo..."
              rows={2}
            />
            <button type="submit" className="primary-btn small">
              Publicar
            </button>
          </form>

          {posts.length === 0 && <p className="empty-state">Ainda não há publicações. Seja a primeira pessoa a postar!</p>}

          {posts.map(post => {
            const isOpen = openPostId === post.id;
            const comments = commentsByPost[post.id] ?? [];
            const commentCount = Math.max(post.comments, comments.length);

            return (
              <article key={post.id} className="feed-card feed-card-compact">
                <div className="feed-card-top">
                  <div className="avatar">{avatarInitial(post.author)}</div>
                  <div>
                    <div className="feed-author-row">
                      <strong>{post.author}</strong>
                      <span>{post.handle}</span>
                      <span>•</span>
                      <span>{post.time}</span>
                    </div>
                  </div>
                </div>
                <p className="feed-body">{post.body}</p>
                <div className="feed-actions">
                  <button
                    type="button"
                    className={post.liked ? "like-btn liked" : "like-btn"}
                    onClick={() => onToggleLike(group.id, post.id)}
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
                        <button type="submit" className="primary-btn small" disabled={isSendingComment || !commentDraft.trim()}>
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
        </section>
      )}

      {tab === "desafio" && hasChallenge && (
        <section className="room-content">
          <div className="challenge-tracker">
            <div className="challenge-tracker-header">
              <strong>Acompanhamento do desafio</strong>
              <span>
                {completedDays.length} de {duration} dias concluídos
              </span>
            </div>
            <div className="progress-bar-track">
              <div className="progress-bar-fill" style={{ width: `${progressPercent}%`, backgroundColor: group.accent }} />
            </div>
            <div className="challenge-days">
              {Array.from({ length: duration }, (_, index) => index + 1).map(day => {
                const done = completedDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    className={done ? "challenge-day done" : "challenge-day"}
                    style={done ? { backgroundColor: group.accent, borderColor: group.accent } : undefined}
                    onClick={() => onToggleDay(group.id, day)}
                    aria-pressed={done}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          <ChallengeStatsPanel
            groupId={group.id}
            total={duration}
            accent={group.accent}
            completedDays={completedDays}
            userName={userName}
          />
        </section>
      )}

      {tab === "sobre" && (
        <section className="room-content">
          <div className="insight-card">
            <h3>Sobre o grupo</h3>
            <p className="group-detail-description">{group.description}</p>

            {admin && (
              <div className="group-card-admin group-detail-admin">
                <div className="avatar" style={{ backgroundColor: admin.accent }}>
                  {avatarInitial(admin.name)}
                </div>
                <div>
                  <p className="group-card-admin-name">{admin.name}</p>
                  <p className="group-card-admin-role">
                    {admin.role} · {admin.specialty} · responsável pelo grupo
                  </p>
                </div>
              </div>
            )}

            <button type="button" className="secondary-btn leave-btn" onClick={handleLeave}>
              Sair do grupo
            </button>
          </div>
        </section>
      )}
    </main>
  );
}