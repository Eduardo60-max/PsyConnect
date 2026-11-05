import type { Category, CommunityGroup, Professional } from "./types.ts";
import { GroupCard } from "./GroupCard.tsx";

type GroupsScreenProps = {
  groups: CommunityGroup[];
  categories: Category[];
  professionals: Professional[];
  activeCategory: string;
  onSelectCategory: (categoryId: string) => void;
  onToggleJoin: (groupId: string) => void;
  onOpenDetail: (groupId: string) => void;
  onOpenCreate: () => void;
};

export function GroupsScreen({
  groups,
  categories,
  professionals,
  activeCategory,
  onSelectCategory,
  onToggleJoin,
  onOpenDetail,
  onOpenCreate,
}: GroupsScreenProps) {
  const visibleGroups = activeCategory === "all" ? groups : groups.filter(group => group.theme === activeCategory);
  const permanentGroups = visibleGroups.filter(group => !group.isTemporary);
  const temporaryGroups = visibleGroups.filter(group => group.isTemporary);
  const joinedCount = groups.filter(group => group.joined).length;
  const categoryChips = [{ id: "all", label: "Todos", accent: "#4f46e5" }, ...categories];

  return (
    <main className="screen">
      <section className="section-heading groups-hero">
        <div className="groups-hero-copy">
          <p className="eyebrow">Comunidade</p>
          <h2>Encontre um grupo para o seu objetivo de saúde e bem-estar.</h2>
          <p className="groups-hero-description">
            Descubra espaços de apoio, desafios temporários e rotinas de cuidado em um só lugar.
          </p>
        </div>
        <div className="groups-hero-stats">
          <div className="stat-pill">
            <strong>{groups.length}</strong>
            <span>grupos ativos</span>
          </div>
          <div className="stat-pill">
            <strong>{joinedCount}</strong>
            <span>participações</span>
          </div>
        </div>
        <button type="button" className="primary-btn" onClick={onOpenCreate}>
          + Criar grupo
        </button>
      </section>

      {joinedCount > 0 && (
      <div className="my-groups-strip">
        <p className="eyebrow">Meus grupos</p>
        <div className="my-groups-list">
          {groups
            .filter(group => group.joined)
            .map(group => (
              <button key={group.id} type="button" className="my-group-btn" onClick={() => onOpenDetail(group.id)}>
                <span className="chip-dot" style={{ backgroundColor: group.accent }} />
                {group.name}
                <span className="my-group-enter">Entrar →</span>
              </button>
            ))}
        </div>
      </div>
    )}
      <div className="group-chips" role="tablist" aria-label="Filtrar grupos por tema">
        {categoryChips.map(category => (
          <button
            key={category.id}
            type="button"
            className={activeCategory === category.id ? "group-chip active" : "group-chip"}
            onClick={() => onSelectCategory(category.id)}
          >
            <span className="chip-dot" style={{ backgroundColor: category.accent }} />
            {category.label}
          </button>
        ))}
      </div>

      {temporaryGroups.length > 0 && (
        <div className="group-section">
          <h3 className="group-section-title">Desafios e programas temporários</h3>
          <div className="group-grid">
            {temporaryGroups.map(group => (
              <GroupCard
                key={group.id}
                group={group}
                admin={professionals.find(professional => professional.id === group.adminId)}
                categoryLabel={categories.find(category => category.id === group.theme)?.label ?? group.theme}
                onToggleJoin={onToggleJoin}
                onOpenDetail={onOpenDetail}
              />
            ))}
          </div>
        </div>
      )}

      <div className="group-section">
        <h3 className="group-section-title">Grupos permanentes</h3>
        {permanentGroups.length === 0 ? (
          <p className="empty-state">Nenhum grupo encontrado para este tema ainda.</p>
        ) : (
          <div className="group-grid">
            {permanentGroups.map(group => (
              <GroupCard
                key={group.id}
                group={group}
                admin={professionals.find(professional => professional.id === group.adminId)}
                categoryLabel={categories.find(category => category.id === group.theme)?.label ?? group.theme}
                onToggleJoin={onToggleJoin}
                onOpenDetail={onOpenDetail}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}