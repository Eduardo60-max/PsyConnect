type LegalModalProps = {
  kind: "terms" | "privacy";
  onClose: () => void;
};

// TEXTOS PROVISÓRIOS: substitua pelos textos revisados (de preferência por um advogado)
const CONTENT = {
  terms: {
    title: "Termos de uso",
    paragraphs: [
      "O PsyConnect é uma plataforma de apoio ao bem-estar emocional que conecta pessoas a grupos de apoio e a profissionais de saúde.",
      "O PsyConnect não substitui atendimento de emergência. Em crise, ligue para o CVV (188, 24h, gratuito) ou para o SAMU (192).",
      "Nesta fase de testes, nenhum pagamento é realizado e o agendamento não gera cobrança.",
      "Você se compromete a tratar as outras pessoas com respeito. Conteúdos ofensivos podem ser removidos e contas podem ser bloqueadas.",
    ],
  },
  privacy: {
    title: "Política de privacidade",
    paragraphs: [
      "Tratamos seus dados conforme a Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018).",
      "Informações sobre saúde e humor são dados pessoais sensíveis. Usamos esses dados apenas para oferecer as funções do app e, com o seu consentimento, para avaliar a qualidade da experiência nos testes.",
      "Você pode pedir acesso, correção ou exclusão dos seus dados a qualquer momento pelo canal de contato da equipe.",
      "Os dados não são vendidos nem compartilhados com terceiros sem o seu consentimento.",
    ],
  },
} as const;

export function LegalModal({ kind, onClose }: Readonly<LegalModalProps>) {
  const content = CONTENT[kind];

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={content.title} onClick={onClose}>
      <div className="modal-card" onClick={event => event.stopPropagation()}>
        <div className="modal-header">
          <h3>{content.title}</h3>
          <button type="button" className="icon-btn" aria-label="Fechar" onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="auth-notice">Texto provisório para a fase de testes.</p>
        {content.paragraphs.map(paragraph => (
          <p key={paragraph} className="group-detail-description">
            {paragraph}
          </p>
        ))}
        <button type="button" className="primary-btn full-width" onClick={onClose}>
          Entendi
        </button>
      </div>
    </div>
  );
}