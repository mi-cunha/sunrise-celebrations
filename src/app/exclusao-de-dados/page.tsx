import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Exclusão de Dados | Sunrise Celebrations",
  description: "Como solicitar acesso, correção ou exclusão de dados pessoais tratados pela Sunrise Celebrations.",
};

export default function DataDeletionPage() {
  return (
    <LegalPage title="Exclusão de Dados">
      <LegalSection title="Como fazer a solicitação">
        <p>Para solicitar acesso, correção ou exclusão de dados pessoais, envie uma mensagem pelo canal oficial da Sunrise Celebrations no qual ocorreu o atendimento, identificado na conversa, proposta ou contrato.</p>
        <p>Na mensagem, escreva <strong>“Solicitação de privacidade”</strong> e informe:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>nome utilizado no atendimento;</li>
          <li>telefone ou e-mail associado ao contato;</li>
          <li>qual direito deseja exercer;</li>
          <li>quando possível, a data aproximada do atendimento ou evento.</li>
        </ul>
        <p>Não envie senha, código de autenticação ou dados bancários.</p>
      </LegalSection>

      <LegalSection title="Confirmação de identidade">
        <p>Para evitar que terceiros obtenham ou apaguem dados indevidamente, poderemos solicitar informações adicionais compatíveis com o cadastro. A confirmação será limitada ao necessário para validar a identidade e localizar os registros.</p>
      </LegalSection>

      <LegalSection title="Análise e resposta">
        <p>A Sunrise confirmará o recebimento e analisará a solicitação nos prazos previstos na legislação aplicável. Se não for possível atender integralmente ao pedido, explicaremos o motivo, como nos casos de conservação exigida por obrigação legal, contábil, contratual ou para exercício regular de direitos.</p>
      </LegalSection>

      <LegalSection title="O que acontece após a exclusão">
        <p>Os dados elegíveis serão apagados ou anonimizados nos sistemas sob controle da Sunrise. Cópias de segurança podem permanecer por período limitado até sua substituição automática, com acesso restrito e sem uso para novas finalidades.</p>
        <p>A exclusão no Sunrise OS não elimina automaticamente dados mantidos de forma independente pelo WhatsApp, Meta ou por outros serviços usados pelo próprio titular. Pedidos relativos a essas plataformas devem ser realizados também pelos canais disponibilizados por elas.</p>
      </LegalSection>

      <LegalSection title="Responsável pelo tratamento">
        <p>Sunrise Serviços de Bares e Restaurantes Ltda. — CNPJ 05.904.097/0001-80 — Av. Zezé Diogo, 4959, Praia do Futuro, Fortaleza/CE.</p>
      </LegalSection>
    </LegalPage>
  );
}
