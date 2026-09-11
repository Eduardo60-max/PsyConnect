import type { CommunityGroup, Professional } from "./types";
import { avatarInitial } from "./utils";

type GroupCardProps = {
  group: CommunityGroup;
  admin: Professional | undefined;
  categoryLabel: string;
  onToggleJoin: (groupId: string) => void;
  onOpenDetail: (groupId: string) => void;
};

export function GroupCard({
  group,
  admin,
  categoryLabel,
  onToggleJoin,
  onOpenDetail,
}: GroupCardProps) {
  return (
    <article className="feed-card">
      <div className="feed-card-top">
        <div className="avatar" style={{ backgroundColor: group.accent }}>
          {avatarInitial(group.name)}
        </div>
        <div>
          <div className="feed-author-row">
            <strong>{group.name}</strong>
            <span>•</span>
            <span>{categoryLabel}</span>
          </div>
          <p className="feed-group">{group.members.toLocaleString("pt-BR")} participantes</p>
        </div>
      </div>

      <p className="feed-body">{group.description}</p>

      {admin && (
        <p className="group-card-admin-role">
          {admin.name} · {admin.specialty}
        </p>
      )}

      <div className="feed-actions">
        <button type="button" className="text-link" onClick={() => onOpenDetail(group.id)}>
          Ver detalhes
        </button>
        <button
          type="button"
          className={group.joined ? "primary-btn small ghost" : "primary-btn small"}
          onClick={() => onToggleJoin(group.id)}
        >
          {group.joined ? "Participando" : "Participar"}
        </button>
      </div>
    </article>
  );
}
