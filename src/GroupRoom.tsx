import { useState, type SyntheticEvent } from "react";
import type { Category, ChallengeRankEntry, CommunityGroup, FeedPost } from "./types";
import { avatarInitial } from "./utils";
import { ChallengeStatsPanel } from "./ChallengeStatsPanel";
import { PostFeedList } from "./PostFeedList";

type GroupRoomProps = {
  group: CommunityGroup;
  category: Category | undefined;
  posts: FeedPost[];
  completedDays: number[];
  ranking: ChallengeRankEntry[];
  currentUserId: string;
  showWelcome: boolean;
  onDismissWelcome: () => void;
  onToggleDay: (groupId: string, day: number) => void;
  onAddPost: (groupId: string, body: string) => void;
  onToggleLike: (groupId: string, postId: string) => void;
  onDeletePost: (groupId: string, postId: string) => void;
  onBlockedUser: (blockedUserId: string) => void;
  onLeave: (groupId: string) => void;
  onBack: () => void;
};

type Tab = "mural" | "desafio" | "sobre";

export function GroupRoom({
  group,
  category,
  posts,
  completedDays,
  ranking,
  currentUserId,
  showWelcome,
  onDismissWelcome,
  onToggleDay,
  onAddPost,
  onToggleLike,
  onDeletePost,
  onBlockedUser,
  onLeave,
  onBack,
}: Readonly<GroupRoomProps>) {
  const [tab, setTab] = useState<Tab>("mural");
  const [draft, setDraft] = useState("");

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
          {group.adminName ? ` · com ${group.adminName}` : ""}
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
        <button
          type="button"
          role="tab"
          aria-selected={tab === "mural"}
          className={tab === "mural" ? "room-tab active" : "room-tab"}
          onClick={() => setTab("mural")}
        >
          Mural
        </button>
        {hasChallenge && (
          <button
            type="button"
            role="tab"
            aria-selected={tab === "desafio"}
            className={tab === "desafio" ? "room-tab active" : "room-tab"}
            onClick={() => setTab("desafio")}
          >
            Desafio
          </button>
        )}
        <button
          type="button"
          role="tab"
          aria-selected={tab === "sobre"}
          className={tab === "sobre" ? "room-tab active" : "room-tab"}
          onClick={() => setTab("sobre")}
        >
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
              maxLength={1000}
            />
            <button type="submit" className="primary-btn small" disabled={!draft.trim()}>
              Publicar
            </button>
          </form>

          <PostFeedList
            posts={posts}
            currentUserId={currentUserId}
            adminId={group.adminId}
            emptyMessage="Ainda não há publicações. Seja a primeira pessoa a postar!"
            compact
            onToggleLike={post => onToggleLike(group.id, post.id)}
            onDeletedPost={postId => onDeletePost(group.id, postId)}
            onBlockedUser={onBlockedUser}
          />
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
            total={duration}
            accent={group.accent}
            completedDays={completedDays}
            ranking={ranking}
          />
        </section>
      )}

      {tab === "sobre" && (
        <section className="room-content">
          <div className="insight-card">
            <h3>Sobre o grupo</h3>
            <p className="group-detail-description">{group.description}</p>

            {group.adminName && (
              <div className="group-card-admin group-detail-admin">
                <div className="avatar" style={{ backgroundColor: group.adminAccent ?? group.accent }}>
                  {avatarInitial(group.adminName)}
                </div>
                <div>
                  <p className="group-card-admin-name">{group.adminName}</p>
                  <p className="group-card-admin-role">
                    {group.adminSpecialty ? `${group.adminSpecialty} · ` : ""}responsável pelo grupo
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
