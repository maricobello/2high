import type { Metadata } from "next";
import { Prose } from "@/components/site/prose";
import Link from "next/link";
import { brand } from "@/lib/brand";
import { CONSENT_VERSION } from "@/modules/leads/schema";

export const metadata: Metadata = { title: "Política de privacidade" };

export default function PrivacyPage() {
  return (
    <Prose title="Política de Privacidade" updated={`setembro de 2026 (versão ${CONSENT_VERSION})`}>
      <p>
        Esta política explica como {brand.legalName || brand.name} (&quot;nós&quot;) trata dados pessoais na plataforma {brand.name}, em conformidade com a Lei
        Geral de Proteção de Dados (Lei 13.709/2018 — LGPD).
      </p>
      <h2>1. Dados coletados</h2>
      <ul>
        <li>Dados de contato: nome, empresa, CNPJ, WhatsApp, e-mail, estado e cidade.</li>
        <li>Fatura de energia enviada e os dados extraídos dela (distribuidora, unidade consumidora, consumo, demanda, tarifas, valores).</li>
        <li>Respostas do formulário e dos simuladores, e interações com o diagnóstico (ex.: cliques em &quot;falar com especialista&quot;).</li>
        <li>Dados técnicos mínimos (IP para prevenção de abuso, origem da visita/UTM).</li>
      </ul>
      <h2>2. Finalidades e bases legais</h2>
      <ul>
        <li>Gerar o diagnóstico preliminar solicitado — execução de procedimentos preliminares a pedido do titular (art. 7º, V).</li>
        <li>Contato comercial sobre o resultado e envio de mensagens de acompanhamento — consentimento (art. 7º, I), revogável a qualquer momento.</li>
        <li>Segurança, prevenção a fraudes e cumprimento de obrigações legais — legítimo interesse e obrigação legal.</li>
      </ul>
      <h2>3. Uso de inteligência artificial e atendimento automatizado</h2>
      <p>
        Utilizamos provedores de IA para ler o documento, explicar os resultados em linguagem simples e responder dúvidas no chat e no WhatsApp. Cálculos, regras e
        estimativas são feitos por um motor determinístico próprio — a IA não toma decisões sobre valores. Você pode pedir atendimento humano a qualquer momento e
        solicitar a revisão de qualquer resultado (art. 20 da LGPD).
      </p>
      <p>
        Conversas no chat do site sem vínculo com um protocolo não são armazenadas. Quando você está na página do seu diagnóstico, a conversa é registrada no seu
        atendimento para dar continuidade.
      </p>
      <h2>3.1 Operadores e transferência internacional</h2>
      <p>
        Usamos fornecedores de infraestrutura (hospedagem, banco de dados, armazenamento), envio de e-mail/WhatsApp e IA. Alguns podem processar dados fora do
        Brasil; nesses casos a transferência ocorre com garantias contratuais adequadas (art. 33 da LGPD) e apenas com os dados necessários à finalidade.
      </p>
      <h2>4. Compartilhamento</h2>
      <p>
        Podemos compartilhar dados estritamente necessários com parceiros envolvidos na solução que você decidir avaliar (ex.: comercializadoras ou projetos de
        geração compartilhada), sempre vinculados a esta finalidade. Não vendemos dados pessoais.
      </p>
      <h2>5. Armazenamento, segurança e retenção</h2>
      <p>
        As faturas são armazenadas em ambiente privado, com criptografia em trânsito e acesso restrito à equipe responsável. Registramos a versão desta política
        aceita, a data e um identificador técnico anonimizado como evidência do consentimento.
      </p>
      <ul>
        <li>Leads sem continuidade comercial: dados e faturas eliminados em até 24 meses do último contato.</li>
        <li>Clientes: pelo período do relacionamento e prazos legais aplicáveis.</li>
        <li>Pedidos de exclusão: atendidos em até 15 dias, salvo obrigação legal de guarda.</li>
      </ul>
      <h2>5.1 Cookies</h2>
      <p>Usamos apenas cookies e armazenamento local essenciais (segurança, sessão do painel e continuidade do formulário). Não usamos cookies de publicidade.</p>
      <h2>6. Seus direitos</h2>
      <p>
        Você pode solicitar confirmação de tratamento, acesso, correção, anonimização, portabilidade, eliminação e revogação do consentimento pelo{" "}
        <Link className="text-primary" href="/privacidade/solicitacao">
          formulário de solicitação do titular
        </Link>
        . Para parar de receber mensagens, responda &quot;SAIR&quot; no WhatsApp.
      </p>
      <h2>7. Contato do encarregado (DPO)</h2>
      <p>
        <a className="text-primary" href={`mailto:${brand.dpoEmail}`}>
          {brand.dpoEmail}
        </a>
      </p>
    </Prose>
  );
}
