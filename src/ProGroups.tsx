import { useState, type SyntheticEvent } from "react";
import type { CommunityGroup, FeedPost } from "./types";
import { categories } from "./data";
import { addGroupPostRequest, fetchGroupPosts } from "./api";
import { avatarInitial } from "./utils";

type ProGroupsProps = {
  groups: CommunityGroup[];
  proName: string;
};

export function ProGroups({ groups, proName }: Readonly<ProGroupsProps>) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [postsByGroup, setPostsByGroup] = useState<Record<string, FeedPost[]>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const handleToggle = (groupId: string) => {
    setError("");
    if (openId === groupId) {
      setOpenId(null);
      return;
    }
    setOpenId(groupId);
    if (postsByGroup[groupId]) return;

    fetchGroupPosts(groupId)
      .then(posts => setPostsByGroup(current => ({ ...current, [groupId]: posts })))
      .catch(() => setError("Não foi possível carregar as publicações."));
  };

  const handlePublish = async (event: SyntheticEvent, group: CommunityGroup) => {
    event.preventDefault();
    const text = (drafts[group.id] ?? "").trim();
    if (!text || busyId) return;

    setBusyId(group.id);
    setError("");
    try {
      const posts = await addGroupPostRequest(group.id, text);
      setPostsByGroup(current => ({ ...current, [group.id]: posts }));
      setDrafts(current => ({ ...current, [group.id]: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível publicar.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="screen">
      <section className="section-heading">
        <div>
          <p className="eyebrow">Meus grupos</p>
          <h2>Grupos que você administra.</h2>
        </div>
      </section>

      {error && <p className="field-error">{error}</p>}

      {groups.length === 0 && <p className="empty-state">Você ainda não administra nenhum grupo.</p>}

      <div className="pro-groups">
        {groups.map(group => {
          const isOpen = openId === group.id;
          const posts = postsByGroup[group.id] ?? [];
          const label = categories.find(category => category.id === group.theme)?.label ?? group.theme;

          return (
            <article key={group.id} className="insight-card pro-group-card">
              <div className="pro-group-head">
                <span className="chip-dot" style={{ backgroundColor: group.accent }} />
                <div>
                  <h3>{group.name}</h3>
                  <p className="suggested-group-meta">
                    {label}
                    {group.isTemporary ? ` · Desafio de ${group.durationDays} dias` : " · Grupo permanente"} ·{" "}
                    {group.members.toLocaleString("pt-BR")} participantes
                  </p>
                </div>
                <button type="button" className="secondary-btn small" onClick={() => handleToggle(group.id)} aria-expanded={isOpen}>
                  {isOpen ? "Fechar" : "Gerenciar"}
                </button>
              </div>

              {isOpen && (
                <div className="pro-group-body">
                  <form onSubmit={event => handlePublish(event, group)} className="group-post-composer">
                    <textarea
                      value={drafts[group.id] ?? ""}
                      onChange={event => setDrafts(current => ({ ...current, [group.id]: event.target.value }))}
                      placeholder="Publicar um aviso ou orientação para o grupo..."
                      rows={2}
                    />
                    <button type="submit" className="primary-btn small" disabled={busyId === group.id || !(drafts[group.id] ?? "").trim()}>
                      {busyId === group.id ? "..." : "Publicar"}
                    </button>
                  </form>

                  {posts.length === 0 && <p className="comments-empty">Ainda não há publicações neste grupo.</p>}

                  {posts.map(post => (
                    <div key={post.id} className="feed-card feed-card-compact">
                      <div className="feed-card-top">
                        <div className="avatar">{avatarInitial(post.author)}</div>
                        <div className="feed-author-row">
                          <strong>{post.author}</strong>
                          {post.author === proName && <span className="pro-badge">Responsável</span>}
                          <span>{post.handle}</span>
                          <span>•</span>
                          <span>{post.time}</span>
                        </div>
                      </div>
                      <p className="feed-body">{post.body}</p>
                      <div className="feed-actions">
                        <span>♡ {post.likes}</span>
                        <span>💬 {post.comments}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </main>
  );
}