import { useEffect, useState } from "react";
import type { AdminSurveySummary, CurrentUser, ModerationReport, PendingDoctorItem } from "./types";
import {
  fetchAdminDoctors,
  fetchAdminReports,
  fetchAdminSurveys,
  fetchAdminSurveysCsv,
  resolveAdminReportRequest,
  reviewDoctorRequest,
} from "./api";
import { ProfileScreen } from "./ProfileScreen";

type AdminAppProps = {
  user: CurrentUser;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onUserUpdated: (user: CurrentUser) => void;
  onLogout: () => void;
};

type AdminTab = "doctors" | "reports" | "surveys" | "profile";

const STATUS_BADGE: Record<PendingDoctorItem["status"], string> = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  recusado: "Recusado",
};

export function AdminApp({ user, theme, onToggleTheme, onUserUpdated, onLogout }: Readonly<AdminAppProps>) {
  const [tab, setTab] = useState<AdminTab>("doctors");
  const [doctors, setDoctors] = useState<PendingDoctorItem[]>([]);
  const [doctorFilter, setDoctorFilter] = useState<"all" | "pendente" | "aprovado" | "recusado">("pendente");
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [surveys, setSurveys] = useState<AdminSurveySummary | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const [csvFeedback, setCsvFeedback] = useState("");

  const loadAll = async () => {
    setLoading(true);
    setError("");
    try {
      const [loadedDoctors, loadedReports, loadedSurveys] = await Promise.all([
        fetchAdminDoctors(),
        fetchAdminReports(),
        fetchAdminSurveys(),
      ]);
      setDoctors(loadedDoctors);
      setReports(loadedReports);
      setSurveys(loadedSurveys);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar o painel administrativo.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, [user.id]);

  const pendingDoctorsCount = doctors.filter(d => d.status === "pendente").length;
  const openReportsCount = reports.filter(r => r.status === "open").length;
  const visibleDoctors = doctorFilter === "all" ? doctors : doctors.filter(d => d.status === doctorFilter);

  const handleReviewDoctor = async (doctorUserId: string, decision: "aprovado" | "recusado") => {
    setBusyId(doctorUserId);
    setError("");
    try {
      const updated = await reviewDoctorRequest(doctorUserId, decision, rejectionReasons[doctorUserId]);
      setDoctors(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar médico.");
    } finally {
      setBusyId(null);
    }
  };

  const handleResolveReport = async (reportId: string, action: "dismiss" | "remove_content") => {
    setBusyId(reportId);
    setError("");
    try {
      const updated = await resolveAdminReportRequest(reportId, action);
      setReports(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao tratar denúncia.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDownloadCsv = async () => {
    setCsvFeedback("");
    try {
      const csv = await fetchAdminSurveysCsv();
      const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `psyconnect-panas-anonimo-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setCsvFeedback(err instanceof Error ? err.message : "Erro ao baixar CSV.");
    }
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="brand-mark">PsyConnect · Administração</p>
          <span className="brand-subtitle">Aprovação de profissionais, moderação e métricas</span>
        </div>
        <nav className="nav-links" aria-label="Navegação administrativa">
          <button type="button" className={tab === "doctors" ? "nav-link active" : "nav-link"} onClick={() => setTab("doctors")}>
            Médicos
            {pendingDoctorsCount > 0 && <span className="nav-badge">{pendingDoctorsCount}</span>}
          </button>
          <button type="button" className={tab === "reports" ? "nav-link active" : "nav-link"} onClick={() => setTab("reports")}>
            Moderação
            {openReportsCount > 0 && <span className="nav-badge">{openReportsCount}</span>}
          </button>
          <button type="button" className={tab === "surveys" ? "nav-link active" : "nav-link"} onClick={() => setTab("surveys")}>
            PANAS
          </button>
          <button type="button" className={tab === "profile" ? "nav-link active" : "nav-link"} onClick={() => setTab("profile")}>
            Perfil
          </button>
        </nav>
        <div className="topbar-user">
          <span className="topbar-greeting">Admin: {user.name.split(" ")[0]}</span>
          <button
            type="button"
            className="theme-toggle"
            onClick={onToggleTheme}
            aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          <button type="button" className="secondary-btn" onClick={onLogout}>
            Sair
          </button>
        </div>
      </header>

      {loading && (
        <main className="screen">
          <p className="empty-state">Carregando dados administrativos...</p>
        </main>
      )}

      {!loading && error && (
        <main className="screen">
          <div className="empty-state network-error-box">
            <p>{error}</p>
            <button type="button" className="primary-btn small" onClick={loadAll}>
              Tentar de novo
            </button>
          </div>
        </main>
      )}

      {!loading && !error && tab === "doctors" && (
        <main className="screen">
          <section className="section-heading">
            <div>
              <p className="eyebrow">Validação de CRM</p>
              <h2>Profissionais cadastrados</h2>
            </div>
            <button type="button" className="secondary-btn small" onClick={loadAll}>
              Atualizar
            </button>
          </section>

          <div className="group-chips" role="tablist" aria-label="Filtrar médicos por status">
            {(["pendente", "aprovado", "recusado", "all"] as const).map(filter => (
              <button
                key={filter}
                type="button"
                className={doctorFilter === filter ? "group-chip active" : "group-chip"}
                onClick={() => setDoctorFilter(filter)}
              >
                {filter === "all" ? "Todos" : STATUS_BADGE[filter]}
              </button>
            ))}
          </div>

          <div className="group-section">
            {visibleDoctors.length === 0 ? (
              <p className="empty-state">Nenhum médico nessa categoria.</p>
            ) : (
              <div className="bookings-list">
                {visibleDoctors.map(doc => (
                  <article key={doc.userId} className="booking-card">
                    <div className="booking-card-top">
                      <div className="booking-card-title">
                        <h3>{doc.name}</h3>
                        <p>{doc.email}</p>
                      </div>
                      <span
                        className={`status-badge ${
                          doc.status === "aprovado"
                            ? "status-confirmed"
                            : doc.status === "pendente"
                              ? "status-rescheduled"
                              : "status-canceled"
                        }`}
                      >
                        {STATUS_BADGE[doc.status]}
                      </span>
                    </div>
                    <div className="booking-card-meta">
                      <span>
                        CRM/{doc.crmUf} {doc.crm}
                      </span>
                      <span>{doc.specialty}</span>
                    </div>

                    {doc.rejectionReason && (
                      <p className="booking-reason">
                        <strong>Motivo da recusa:</strong> {doc.rejectionReason}
                      </p>
                    )}

                    <input
                      type="text"
                      className="mood-note"
                      placeholder="Motivo caso decida recusar (opcional)"
                      value={rejectionReasons[doc.userId] ?? ""}
                      onChange={e => setRejectionReasons(curr => ({ ...curr, [doc.userId]: e.target.value }))}
                      maxLength={300}
                    />

                    <div className="booking-actions">
                      <button
                        type="button"
                        className="primary-btn small"
                        disabled={busyId === doc.userId || doc.status === "aprovado"}
                        onClick={() => handleReviewDoctor(doc.userId, "aprovado")}
                      >
                        Aprovar
                      </button>
                      <button
                        type="button"
                        className="secondary-btn small danger-btn"
                        disabled={busyId === doc.userId || doc.status === "recusado"}
                        onClick={() => handleReviewDoctor(doc.userId, "recusado")}
                      >
                        Recusar
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </main>
      )}

      {!loading && !error && tab === "reports" && (
        <main className="screen">
          <section className="section-heading">
            <div>
              <p className="eyebrow">Comunidade segura</p>
              <h2>Denúncias registradas</h2>
            </div>
            <button type="button" className="secondary-btn small" onClick={loadAll}>
              Atualizar
            </button>
          </section>

          {reports.length === 0 ? (
            <p className="empty-state">Nenhuma denúncia registrada até o momento.</p>
          ) : (
            <div className="bookings-list">
              {reports.map(report => (
                <article key={report.id} className="booking-card">
                  <div className="booking-card-top">
                    <div className="booking-card-title">
                      <h3>
                        Tipo: {report.targetType} · por {report.reporterName}
                      </h3>
                      <p>{new Date(report.createdAt).toLocaleString("pt-BR")}</p>
                    </div>
                    <span
                      className={`status-badge ${
                        report.status === "open" ? "status-rescheduled" : "status-confirmed"
                      }`}
                    >
                      {report.status === "open" ? "Aberta" : report.status === "reviewed" ? "Removido" : "Dispensada"}
                    </span>
                  </div>
                  <p className="booking-reason">
                    <strong>Motivo:</strong> {report.reason}
                  </p>
                  {report.reportedUserName && (
                    <p className="booking-reason">
                      <strong>Usuário denunciado:</strong> {report.reportedUserName}
                    </p>
                  )}
                  {report.targetPreview && (
                    <p className="booking-reason">
                      <strong>Conteúdo:</strong> "{report.targetPreview}"
                    </p>
                  )}

                  {report.status === "open" && (
                    <div className="booking-actions">
                      {(report.targetType === "post" || report.targetType === "comment") && (
                        <button
                          type="button"
                          className="secondary-btn small danger-btn"
                          disabled={busyId === report.id}
                          onClick={() => handleResolveReport(report.id, "remove_content")}
                        >
                          Remover conteúdo
                        </button>
                      )}
                      <button
                        type="button"
                        className="secondary-btn small"
                        disabled={busyId === report.id}
                        onClick={() => handleResolveReport(report.id, "dismiss")}
                      >
                        Dispensar
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </main>
      )}

      {!loading && !error && tab === "surveys" && surveys && (
        <main className="screen">
          <section className="section-heading">
            <div>
              <p className="eyebrow">Métrica de IHC · UX</p>
              <h2>Respostas PANAS (anonimizadas)</h2>
            </div>
            <button
              type="button"
              className="primary-btn"
              disabled={surveys.rows.length === 0}
              onClick={handleDownloadCsv}
            >
              Exportar CSV anônimo
            </button>
          </section>

          {csvFeedback && <p className="field-error">{csvFeedback}</p>}

          <div className="stats-grid">
            <div className="stat-tile">
              <strong>{surveys.totalResponses}</strong>
              <span>respostas registradas</span>
            </div>
            <div className="stat-tile">
              <strong>{surveys.completedSessions}</strong>
              <span>sessões completas (antes+depois)</span>
            </div>
            <div className="stat-tile">
              <strong>
                {surveys.avgPositiveBefore ?? "—"} → {surveys.avgPositiveAfter ?? "—"}
              </strong>
              <span>Afeto positivo médio</span>
            </div>
            <div className="stat-tile">
              <strong>
                {surveys.avgNegativeBefore ?? "—"} → {surveys.avgNegativeAfter ?? "—"}
              </strong>
              <span>Afeto negativo médio</span>
            </div>
          </div>

          <div className="group-section">
            {surveys.rows.length === 0 ? (
              <p className="empty-state">Nenhuma resposta PANAS registrada ainda.</p>
            ) : (
              <div className="insight-card survey-table-wrap">
                <table className="survey-table">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Sessão</th>
                      <th>Momento</th>
                      <th>Afeto +</th>
                      <th>Afeto -</th>
                      <th>Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {surveys.rows.map(row => (
                      <tr key={row.id}>
                        <td>{row.anonymousCode}</td>
                        <td>{row.sessionId}</td>
                        <td>{row.moment === "before" ? "Antes" : row.moment === "after" ? "Depois" : row.moment}</td>
                        <td>{row.scorePositive ?? "—"}</td>
                        <td>{row.scoreNegative ?? "—"}</td>
                        <td>{new Date(row.createdAt).toLocaleString("pt-BR")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      )}

      {!loading && !error && tab === "profile" && (
        <ProfileScreen
          user={user}
          theme={theme}
          onToggleTheme={onToggleTheme}
          onUserUpdated={onUserUpdated}
          onLogout={onLogout}
        />
      )}
    </div>
  );
}
