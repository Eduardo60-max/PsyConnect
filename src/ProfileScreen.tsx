import { useEffect, useState, type SyntheticEvent } from "react";
import type { BlockedUser, CurrentUser } from "./types";
import { SPECIALTIES } from "./authValidation";
import {
  fetchBlockedUsers,
  unblockUserRequest,
  updateDoctorProfileRequest,
  updateMyProfileRequest,
} from "./api";
import { LegalModal } from "./LegalModal";
import { CrisisNotice } from "./CrisisNotice";

type ProfileScreenProps = {
  user: CurrentUser;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onUserUpdated: (user: CurrentUser) => void;
  onUnblockedUser?: () => void;
  onLogout: () => void;
};

const ROLE_LABEL: Record<CurrentUser["role"], string> = {
  paciente: "Paciente",
  medico: "Médico(a)",
  admin: "Administração",
};

export function ProfileScreen({
  user,
  theme,
  onToggleTheme,
  onUserUpdated,
  onUnblockedUser,
  onLogout,
}: Readonly<ProfileScreenProps>) {
  const [name, setName] = useState(user.name);
  const [savingBasic, setSavingBasic] = useState(false);
  const [basicFeedback, setBasicFeedback] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const [roleTitle, setRoleTitle] = useState(user.professional?.roleTitle ?? "Médico(a)");
  const [specialty, setSpecialty] = useState(user.professional?.specialty ?? SPECIALTIES[0]);
  const [experience, setExperience] = useState(user.professional?.experience ?? "");
  const [priceLabel, setPriceLabel] = useState(user.professional?.priceLabel ?? "Gratuito (teste)");
  const [bio, setBio] = useState(user.professional?.bio ?? "");
  const [savingPro, setSavingPro] = useState(false);
  const [proFeedback, setProFeedback] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [blockedLoading, setBlockedLoading] = useState(true);
  const [legal, setLegal] = useState<"terms" | "privacy" | null>(null);

  useEffect(() => {
    setName(user.name);
    if (user.professional) {
      setRoleTitle(user.professional.roleTitle);
      setSpecialty(user.professional.specialty);
      setExperience(user.professional.experience);
      setPriceLabel(user.professional.priceLabel);
      setBio(user.professional.bio);
    }
  }, [user]);

  useEffect(() => {
    setBlockedLoading(true);
    fetchBlockedUsers()
      .then(setBlocked)
      .catch(() => setBlocked([]))
      .finally(() => setBlockedLoading(false));
  }, [user.id]);

  const handleSaveBasic = async (event: SyntheticEvent) => {
    event.preventDefault();
    setSavingBasic(true);
    setBasicFeedback(null);
    try {
      const updated = await updateMyProfileRequest({ name });
      onUserUpdated(updated);
      setBasicFeedback({ kind: "ok", text: "Perfil atualizado." });
    } catch (error) {
      setBasicFeedback({ kind: "error", text: error instanceof Error ? error.message : "Erro ao atualizar." });
    } finally {
      setSavingBasic(false);
    }
  };

  const handleSavePro = async (event: SyntheticEvent) => {
    event.preventDefault();
    setSavingPro(true);
    setProFeedback(null);
    try {
      const updated = await updateDoctorProfileRequest({
        roleTitle,
        specialty,
        experience,
        priceLabel,
        bio,
      });
      onUserUpdated(updated);
      setProFeedback({ kind: "ok", text: "Dados profissionais salvos." });
    } catch (error) {
      setProFeedback({ kind: "error", text: error instanceof Error ? error.message : "Erro ao salvar." });
    } finally {
      setSavingPro(false);
    }
  };

  const handleUnblock = async (targetId: string) => {
    try {
      const updated = await unblockUserRequest(targetId);
      setBlocked(updated);
      onUnblockedUser?.();
    } catch {
      // ignora erro transitório
    }
  };

  return (
    <main className="screen profile-screen">
      <section className="section-heading">
        <div>
          <p className="eyebrow">Minha conta</p>
          <h2>Perfil e privacidade</h2>
        </div>
        <button type="button" className="secondary-btn danger-btn" onClick={onLogout}>
          Sair da conta
        </button>
      </section>

      <div className="profile-grid">
        <section className="insight-card">
          <h3>Dados da conta</h3>
          <div className="summary-card">
            <div>
              <strong>Papel</strong>
              <p>{ROLE_LABEL[user.role]}</p>
            </div>
            <div>
              <strong>Código anônimo (pesquisa)</strong>
              <p>{user.anonymousCode}</p>
            </div>
          </div>

          <form onSubmit={handleSaveBasic} className="booking-form">
            <label>
              Nome completo
              <input type="text" value={name} onChange={e => setName(e.target.value)} maxLength={80} required />
            </label>
            <label>
              E-mail
              <input type="email" value={user.email} disabled />
            </label>
            <button type="submit" className="primary-btn small" disabled={savingBasic}>
              {savingBasic ? "Salvando..." : "Salvar nome"}
            </button>
          </form>

          {basicFeedback && (
            <p className={basicFeedback.kind === "ok" ? "booking-feedback ok" : "field-error"}>{basicFeedback.text}</p>
          )}
        </section>

        {user.role === "medico" && user.professional && (
          <section className="insight-card">
            <h3>Perfil profissional (CRM/{user.professional.crmUf} {user.professional.crm})</h3>
            <form onSubmit={handleSavePro} className="booking-form">
              <label>
                Título de exibição
                <input
                  type="text"
                  value={roleTitle}
                  onChange={e => setRoleTitle(e.target.value)}
                  placeholder="Ex: Psiquiatra / Psicoterapeuta"
                  maxLength={60}
                />
              </label>
              <label>
                Especialidade
                <select value={specialty} onChange={e => setSpecialty(e.target.value)}>
                  {SPECIALTIES.map(item => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Experiência
                <input
                  type="text"
                  value={experience}
                  onChange={e => setExperience(e.target.value)}
                  placeholder="Ex: 6 anos"
                  maxLength={60}
                />
              </label>
              <label>
                Valor exibido (fase de testes sem cobrança)
                <input
                  type="text"
                  value={priceLabel}
                  onChange={e => setPriceLabel(e.target.value)}
                  placeholder="Gratuito (teste)"
                  maxLength={40}
                />
              </label>
              <label>
                Apresentação para pacientes
                <textarea
                  rows={3}
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="Fale brevemente sobre sua abordagem..."
                  maxLength={500}
                />
              </label>
              <button type="submit" className="primary-btn small" disabled={savingPro}>
                {savingPro ? "Salvando..." : "Atualizar perfil profissional"}
              </button>
            </form>
            {proFeedback && (
              <p className={proFeedback.kind === "ok" ? "booking-feedback ok" : "field-error"}>{proFeedback.text}</p>
            )}
          </section>
        )}

        <section className="insight-card">
          <h3>Preferências e LGPD</h3>
          <p className="group-detail-description">
            Consentimento para dados de saúde:{" "}
            <strong>{user.acceptedHealthDataAt ? "Registrado" : "Pendente (será pedido ao usar pesquisa)"}</strong>.
          </p>
          <div className="profile-actions-row">
            <button type="button" className="secondary-btn small" onClick={onToggleTheme}>
              {theme === "dark" ? "☀️ Mudar para tema claro" : "🌙 Mudar para tema escuro"}
            </button>
            <button type="button" className="text-link" onClick={() => setLegal("terms")}>
              Termos de uso
            </button>
            <button type="button" className="text-link" onClick={() => setLegal("privacy")}>
              Política de privacidade
            </button>
          </div>

          <div className="blocked-section">
            <h4>Usuários bloqueados</h4>
            {blockedLoading ? (
              <p className="comments-empty">Carregando...</p>
            ) : blocked.length === 0 ? (
              <p className="comments-empty">Você não bloqueou ninguém.</p>
            ) : (
              <ul className="suggested-group-list">
                {blocked.map(item => (
                  <li key={item.id} className="blocked-row">
                    <span>{item.name}</span>
                    <button type="button" className="secondary-btn small" onClick={() => handleUnblock(item.id)}>
                      Desbloquear
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="insight-card">
          <CrisisNotice />
        </section>
      </div>

      {legal && <LegalModal kind={legal} onClose={() => setLegal(null)} />}
    </main>
  );
}
