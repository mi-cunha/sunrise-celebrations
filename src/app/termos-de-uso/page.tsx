import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Termos de Uso | Sunrise Celebrations",
  description: "Condições de uso dos canais digitais e do Sunrise OS.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Termos de Uso">
      <LegalSection title="1. Aplicação destes termos">
        <p>Estes termos regulam o uso dos canais digitais da Sunrise Celebrations e do Sunrise OS. O Sunrise OS é uma ferramenta interna; seu acesso é restrito a pessoas autorizadas pela Sunrise.</p>
        <p>Propostas, contratos e condições comerciais específicas prevalecem sobre estes termos quando tratarem diretamente do serviço contratado.</p>
      </LegalSection>

      <LegalSection title="2. Atendimento e informações fornecidas">
        <p>Ao iniciar um atendimento, o interessado deve fornecer informações verdadeiras e atualizadas sobre o evento. Orçamentos e disponibilidade podem mudar até a aprovação formal, o pagamento do sinal ou outra confirmação prevista na proposta ou no contrato.</p>
        <p>Mensagens automatizadas podem auxiliar a triagem, mas não representam aprovação de preço, reserva de data, concessão de desconto ou celebração de contrato.</p>
      </LegalSection>

      <LegalSection title="3. Uso autorizado do sistema">
        <p>Usuários internos devem proteger suas credenciais, acessar apenas informações necessárias às suas funções e respeitar os níveis de permissão definidos pela Sunrise. É proibido compartilhar contas, tentar contornar controles de segurança ou utilizar dados para finalidade alheia à operação.</p>
      </LegalSection>

      <LegalSection title="4. Propriedade intelectual">
        <p>A identidade visual, os textos, os modelos, o software e os materiais da Sunrise permanecem protegidos pela legislação aplicável. O acesso aos canais digitais não transfere direitos de propriedade intelectual nem autoriza reprodução ou exploração comercial sem permissão.</p>
      </LegalSection>

      <LegalSection title="5. Serviços de terceiros">
        <p>O funcionamento pode depender de serviços de terceiros, incluindo WhatsApp/Meta, hospedagem, banco de dados e autenticação. Esses serviços possuem termos próprios e podem apresentar indisponibilidades fora do controle direto da Sunrise.</p>
      </LegalSection>

      <LegalSection title="6. Privacidade e exclusão de dados">
        <p>O tratamento de dados pessoais segue a nossa Política de Privacidade. As instruções para solicitar exclusão estão disponíveis na página Exclusão de Dados, ambas acessíveis pelos links ao final desta página.</p>
      </LegalSection>

      <LegalSection title="7. Alterações e contato">
        <p>Podemos atualizar estes termos para refletir mudanças técnicas, operacionais ou legais. Dúvidas podem ser encaminhadas pelo canal oficial da Sunrise Celebrations informado no atendimento, na proposta ou no contrato.</p>
      </LegalSection>
    </LegalPage>
  );
}
