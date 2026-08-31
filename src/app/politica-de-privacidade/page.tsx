import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Política de Privacidade | Sunrise Celebrations",
  description: "Como a Sunrise Celebrations trata dados pessoais no atendimento e no Sunrise OS.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="Política de Privacidade">
      <LegalSection title="1. Quem somos">
        <p>A Sunrise Serviços de Bares e Restaurantes Ltda., nome empresarial da Sunrise Celebrations, inscrita no CNPJ nº 05.904.097/0001-80 e estabelecida na Av. Zezé Diogo, 4959, Praia do Futuro, Fortaleza/CE, é responsável pelo tratamento descrito nesta política.</p>
        <p>O Sunrise OS é a ferramenta interna utilizada para organizar contatos, atendimentos, orçamentos, propostas, contratos, pagamentos e a operação dos eventos.</p>
      </LegalSection>

      <LegalSection title="2. Dados que podemos tratar">
        <p>Podemos tratar nome, telefone, e-mail, informações do evento, preferências de serviços, histórico de atendimento, propostas, escolhas de cardápio, dados contratuais e registros de pagamento. Documentos de identificação e endereço são solicitados somente quando necessários à contratação.</p>
        <p>Nas conversas pelo WhatsApp, também podemos receber conteúdo de mensagens e dados técnicos necessários para identificar a conversa, registrar entregas e manter o histórico do atendimento.</p>
      </LegalSection>

      <LegalSection title="3. Para que usamos os dados">
        <ul className="list-disc space-y-1 pl-5">
          <li>responder contatos e organizar o atendimento;</li>
          <li>preparar orçamentos, propostas e contratos;</li>
          <li>planejar e executar eventos e serviços contratados;</li>
          <li>registrar pagamentos, cobranças e obrigações legais;</li>
          <li>proteger o sistema, prevenir fraudes e manter registros de auditoria;</li>
          <li>cumprir obrigações legais e exercer direitos em processos administrativos ou judiciais.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Atendimento pelo WhatsApp e assistência por IA">
        <p>O atendimento inicial pode utilizar automação e inteligência artificial para coletar informações básicas e organizar a triagem. Decisões sobre preço, disponibilidade, contrato, pagamento, desconto e reagendamento são encaminhadas para uma pessoa da equipe.</p>
        <p>Quando um atendente assume a conversa, as respostas automáticas ficam pausadas naquele atendimento. O uso do WhatsApp também está sujeito às políticas e aos termos da Meta e do WhatsApp.</p>
      </LegalSection>

      <LegalSection title="5. Bases legais">
        <p>O tratamento pode ocorrer para executar procedimentos solicitados antes da contratação, cumprir contrato, atender obrigação legal ou regulatória, exercer direitos, prevenir fraudes e atender interesses legítimos da operação, sempre com avaliação dos direitos do titular. Quando necessário, solicitaremos consentimento específico.</p>
      </LegalSection>

      <LegalSection title="6. Compartilhamento e operadores">
        <p>Os dados podem ser processados por fornecedores de infraestrutura, autenticação, banco de dados, hospedagem, comunicação e suporte estritamente necessários ao Sunrise OS, incluindo serviços da Meta/WhatsApp, Supabase e Vercel. Também podem ser compartilhados com fornecedores envolvidos no evento quando isso for necessário à execução do serviço.</p>
        <p>Não vendemos dados pessoais. Exigimos que prestadores tratem os dados conforme nossas instruções, suas obrigações contratuais e a legislação aplicável.</p>
      </LegalSection>

      <LegalSection title="7. Armazenamento, segurança e retenção">
        <p>Adotamos controles de acesso por perfil, autenticação, registros operacionais e medidas técnicas compatíveis com a natureza dos dados. Nenhum ambiente é totalmente imune a incidentes, mas atuamos para prevenir acessos, alterações e divulgações indevidas.</p>
        <p>Os dados são mantidos pelo tempo necessário ao atendimento, à contratação, à execução do evento e ao cumprimento de obrigações legais, contábeis e de defesa de direitos. Depois disso, podem ser eliminados ou anonimizados, salvo quando a conservação for permitida ou exigida por lei.</p>
      </LegalSection>

      <LegalSection title="8. Direitos do titular">
        <p>Nos termos da Lei Geral de Proteção de Dados, o titular pode solicitar confirmação e acesso, correção, informação sobre compartilhamentos, anonimização, bloqueio ou eliminação quando cabíveis, portabilidade nos limites regulamentares e revisão de decisões tomadas exclusivamente por meios automatizados.</p>
        <p>As solicitações podem ser feitas pelo canal oficial de atendimento da Sunrise Celebrations utilizado na conversa, proposta ou contrato. Para proteger o titular, poderemos pedir informações adicionais para confirmar sua identidade.</p>
      </LegalSection>

      <LegalSection title="9. Atualizações desta política">
        <p>Esta política pode ser atualizada para refletir mudanças no sistema, na operação ou na legislação. A versão vigente permanecerá publicada nesta página com a respectiva data de atualização.</p>
      </LegalSection>
    </LegalPage>
  );
}
