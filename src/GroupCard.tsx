import type { CommunityGroup } from "./types";
import { avatarInitial } from "./utils";

type GroupCardProps = {
  group: CommunityGroup;
  categoryLabel: string;
  onToggleJoin: (groupId: string) => void;
  onOpenDetail: (groupId: string) => void;
};

export function GroupCard({
  group,
  categoryLabel,
  onToggleJoin,
  onOpenDetail,
}: Readonly<GroupCardProps>) {
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

      {group.adminName && (
        <p className="group-card-admin-role">
          {group.adminName}
          {group.adminSpecialty ? ` · ${group.adminSpecialty}` : ""}
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
