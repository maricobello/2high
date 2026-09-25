import { pageMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";
import { Printer } from "lucide-react";
import { Badge } from "@/components/ui/card";

export const metadata: Metadata = pageMetadata({
  path: "/guia-conta-de-energia",
  title: "Guia: 7 pontos que mais pesam na conta de energia da sua empresa",
  description: "Um guia prático para ler a fatura de energia da empresa e identificar pontos de atenção.",
});

const POINTS = [
  {
    t: "Demanda contratada x demanda medida",
    d: "Empresas em média tensão (Grupo A) pagam pela demanda contratada mesmo quando usam menos — e pagam mais caro quando ultrapassam. Compare os dois valores mês a mês: sobras constantes ou ultrapassagens frequentes indicam que o contrato merece revisão.",
  },
  {
    t: "Ultrapassagem de demanda",
    d: "Quando a demanda medida passa da contratada além da tolerância regulatória (5%), a parcela excedente é cobrada com tarifa de ultrapassagem. Procure na fatura por linhas com “ultrapassagem”.",
  },
  {
    t: "Energia reativa e fator de potência",
    d: "Fator de potência abaixo de 0,92 gera cobrança de energia reativa excedente. Em muitos casos, a correção (ex.: banco de capacitores) se paga rapidamente — mas depende de avaliação técnica no local.",
  },
  {
    t: "Modalidade tarifária",
    d: "No Grupo A, as modalidades Verde e Azul cobram ponta e demanda de formas diferentes. Quem consome pouco no horário de ponta costuma ter perfil diferente de quem opera 24h. A escolha certa depende do histórico de 12 meses.",
  },
  {
    t: "Variações que não batem com a operação",
    d: "Um salto de consumo sem mudança na operação pode ter causa técnica, mas também pode ser erro de leitura ou de faturamento. Compare o mês com o histórico impresso na própria fatura.",
  },
  {
    t: "Créditos de energia (geração distribuída)",
    d: "Se a empresa recebe créditos de energia solar, confira energia injetada, compensada e o saldo. Créditos acumulados têm validade — sobra constante pode indicar rateio ou dimensionamento inadequado.",
  },
  {
    t: "Como você compra a energia",
    d: "Empresas em baixa tensão podem avaliar energia por assinatura (geração compartilhada), sem instalar placas. Empresas do Grupo A podem avaliar o Mercado Livre de Energia. Ambas dependem de análise do perfil e das condições comerciais.",
  },
];

export default function GuidePage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <Badge tone="primary">Guia gratuito</Badge>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">7 pontos que mais pesam na conta de energia da sua empresa</h1>
      <p className="mt-4 text-muted">Um roteiro prático para ler a fatura com olhar técnico. Conteúdo informativo — cada caso depende de análise da unidade consumidora.</p>
      <ol className="mt-10 space-y-6">
        {POINTS.map((p, i) => (
          <li key={p.t} className="flex gap-4 rounded-2xl border border-border bg-white p-5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary font-mono text-sm font-semibold text-white">{i + 1}</span>
            <div>
              <h2 className="font-semibold">{p.t}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-foreground/80">{p.d}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-10 flex flex-col items-center gap-4 rounded-3xl bg-ink p-8 text-center text-white print:hidden">
        <p className="text-xl font-semibold">Quer que a gente verifique esses 7 pontos na sua fatura?</p>
        <Link href="/#analisar" className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold hover:bg-primary-hover">
          Fazer diagnóstico
        </Link>
        <p className="flex items-center gap-1.5 text-xs text-white/50">
          <Printer className="size-3" /> Dica: use “Imprimir → Salvar como PDF” para guardar este guia.
        </p>
      </div>
    </article>
  );
}
