import type { Metadata } from "next";
import { Prose } from "@/components/site/prose";
import { brand } from "@/lib/brand";

export const metadata: Metadata = { title: "Política de privacidade" };

export default function PrivacyPage() {
  return (
    <Prose title="Política de Privacidade" updated="setembro de 2026">
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
      <h2>3. Uso de inteligência artificial</h2>
      <p>
        Utilizamos provedores de IA para ler o documento e explicar os resultados em linguagem simples. Cálculos, regras e estimativas são feitos por um motor
        determinístico próprio. Os provedores atuam como operadores, sem uso dos dados para finalidades próprias, conforme seus termos.
      </p>
      <h2>4. Compartilhamento</h2>
      <p>
        Podemos compartilhar dados estritamente necessários com parceiros envolvidos na solução que você decidir avaliar (ex.: comercializadoras ou projetos de
        geração compartilhada), sempre vinculados a esta finalidade. Não vendemos dados pessoais.
      </p>
      <h2>5. Armazenamento e segurança</h2>
      <p>
        As faturas são armazenadas em ambiente privado, com criptografia em trânsito e acesso restrito. Os dados são mantidos enquanto necessários às finalidades
        acima ou por prazos legais, e depois eliminados ou anonimizados.
      </p>
      <h2>6. Seus direitos</h2>
      <p>
        Você pode solicitar confirmação de tratamento, acesso, correção, anonimização, portabilidade, eliminação e revogação do consentimento. Para parar de receber
        mensagens, responda &quot;SAIR&quot; no WhatsApp ou use o link do e-mail.
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
