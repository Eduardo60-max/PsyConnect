import { useState, type SyntheticEvent } from "react";
import type { Category, CommunityGroup, FeedPost } from "./types";
import { avatarInitial } from "./utils";
import { PostFeedList } from "./PostFeedList";

type GroupDetailModalProps = {
  group: CommunityGroup;
  category: Category | undefined;
  posts: FeedPost[];
  completedDays: number[];
  currentUserId: string;
  onToggleDay: (groupId: string, day: number) => void;
  onToggleJoin: (groupId: string) => void;
  onAddPost: (groupId: string, body: string) => void;
  onToggleLike: (groupId: string, postId: string) => void;
  onDeletePost: (groupId: string, postId: string) => void;
  onBlockedUser: (blockedUserId: string) => void;
  onClose: () => void;
};

export function GroupDetailModal({
  group,
  category,
  posts,
  completedDays,
  currentUserId,
  onToggleDay,
  onToggleJoin,
  onAddPost,
  onToggleLike,
  onDeletePost,
  onBlockedUser,
  onClose,
}: Readonly<GroupDetailModalProps>) {
  const [draft, setDraft] = useState("");

  const handlePost = (event: SyntheticEvent) => {
    event.preventDefault();
    if (!draft.trim()) return;
    onAddPost(group.id, draft.trim());
    setDraft("");
  };

  const progressPercent = group.durationDays
    ? Math.round((completedDays.length / group.durationDays) * 100)
    : 0;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={`Grupo ${group.name}`} onClick={onClose}>
      <div className="modal-card modal-card-wide" onClick={event => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">{category?.label}</p>
            <h3>{group.name}</h3>
          </div>
          <button type="button" className="icon-btn" aria-label="Fechar" onClick={onClose}>
            ✕
          </button>
        </div>

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

        <div className="group-detail-meta">
          <span>{group.members.toLocaleString("pt-BR")} participantes</span>
          <span>{posts.length} publicações</span>
          <button
            type="button"
            className={group.joined ? "primary-btn small ghost" : "primary-btn small"}
            onClick={() => onToggleJoin(group.id)}
          >
            {group.joined ? "Participando" : "Participar do grupo"}
          </button>
        </div>

        {group.isTemporary && group.durationDays && (
          <div className="challenge-tracker">
            <div className="challenge-tracker-header">
              <strong>Acompanhamento do desafio</strong>
              <span>
                {completedDays.length} de {group.durationDays} dias concluídos
              </span>
            </div>
            <div className="progress-bar-track">
              <div className="progress-bar-fill" style={{ width: `${progressPercent}%`, backgroundColor: group.accent }} />
            </div>
            <div className="challenge-days">
              {Array.from({ length: group.durationDays }, (_, index) => index + 1).map(day => {
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
        )}

        <div className="group-detail-feed">
          <form onSubmit={handlePost} className="group-post-composer">
            <textarea
              value={draft}
              onChange={event => setDraft(event.target.value)}
              placeholder="Compartilhe algo com o grupo..."
              rows={2}
              maxLength={1000}
            />
            <button type="submit" className="secondary-btn small" disabled={!draft.trim()}>
              Publicar
            </button>
          </form>

          <PostFeedList
            posts={posts}
            currentUserId={currentUserId}
            adminId={group.adminId}
            emptyMessage="Ainda não há publicações neste grupo. Seja a primeira pessoa a postar!"
            compact
            onToggleLike={post => onToggleLike(group.id, post.id)}
            onDeletedPost={postId => onDeletePost(group.id, postId)}
            onBlockedUser={onBlockedUser}
          />
        </div>
      </div>
    </div>
  );
}
