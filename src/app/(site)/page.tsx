import { ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { OpenChatButton } from "@/components/chat/open-chat-button";
import { QuizFunnel } from "@/components/forms/quiz-funnel";
import { Marquee } from "@/components/magicui/marquee";
import { CountUp } from "@/components/motion/count-up";
import { Marker } from "@/components/motion/marker";
import { Reveal } from "@/components/motion/reveal";
import { ScrubWords } from "@/components/motion/scrub-words";
import { SmoothScroll } from "@/components/motion/smooth-scroll";
import { SplitReveal } from "@/components/motion/split-reveal";
import { AnnotatedInvoice } from "@/components/site/annotated-invoice";
import { ProcessSteps, type ProcessStep } from "@/components/site/process-steps";
import { StickyCta } from "@/components/site/sticky-cta";
import { FAQ } from "@/content/faq";
import { successFeeText } from "@/lib/brand";
import { DISTRIBUTORS } from "@/modules/invoice/distributors";

const DISTRIBUTOR_NAMES = [...new Set(DISTRIBUTORS.filter((d) => d.states.length).map((d) => d.name))];

const FRONTS = [
  {
    title: "Cobranças indevidas",
    text: "Leitura estimada, classe ou tarifa incorreta, multas sem fundamento. O que foi pago indevidamente pode ser restituído em dobro, com correção.",
    law: "CDC, art. 42 · REN ANEEL 1.000/2021",
  },
  {
    title: "ICMS pago a mais",
    text: "Na indústria, o ICMS da energia consumida na produção pode gerar crédito, com laudo técnico. No Grupo A, o imposto só incide sobre a demanda efetivamente utilizada.",
    law: "LC 87/96, art. 33 · Súmula 391, STJ",
  },
  {
    title: "Contrato e tarifa",
    text: "Demanda contratada ajustada ao uso real, modalidade tarifária adequada e, quando fizer sentido, energia por assinatura ou Mercado Livre.",
    law: "Redução daqui para frente",
  },
];

const STEPS: ProcessStep[] = [
  { meta: "30 segundos", title: "Diagnóstico", text: "Cinco perguntas sobre a operação e uma fatura recente. O resultado preliminar sai na hora." },
  { meta: "Até 60 faturas", title: "Auditoria técnica", text: "Cada fatura é conferida contra as regras vigentes no período: leitura, tarifa, demanda, energia reativa e tributos." },
  { meta: "Sem ação judicial", title: "Pedido administrativo", text: "Protocolamos junto à distribuidora e, se necessário, à ouvidoria e à ANEEL. Laudos e documentação ficam por nossa conta." },
  { meta: "Honorários de êxito", title: "Restituição", text: "O valor retorna à empresa, em devolução ou crédito. Os honorários incidem apenas sobre o que for efetivamente recuperado." },
];

/** Casos ILUSTRATIVOS (valores fictícios) — sinalizados como tal na página. */
const CASES = [
  { who: "Padaria", where: "SP · Grupo B", issue: "Leitura estimada por 14 meses seguidos", period: "14 faturas", value: 12_480, kind: "Restituição em dobro" },
  { who: "Metalúrgica", where: "MG · Grupo A", issue: "Multa de reativo com fator de potência acima de 0,92", period: "22 faturas", value: 42_600, kind: "Restituição em dobro" },
  { who: "Indústria de alimentos", where: "SC · Grupo A", issue: "ICMS da energia de produção nunca aproveitado", period: "60 meses", value: 186_400, kind: "Crédito de ICMS" },
];

/** Na landing, só as dúvidas que antecedem o diagnóstico (a IA conhece todas). */
const FAQ_HOME = FAQ.filter((f) => !/Mercado Livre|solar por assinatura|instalar placas/i.test(f.q));

function SectionLabel({ n, children, dark }: { n: string; children: React.ReactNode; dark?: boolean }) {
  return (
    <p className={`flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.16em] ${dark ? "text-white/55" : "text-stone"}`}>
      <span>{n}</span>
      <span className={`h-px w-8 ${dark ? "bg-white/25" : "bg-line"}`} />
      <span>{children}</span>
    </p>
  );
}

export default function HomePage() {
  return (
    <div className="bg-paper text-foreground">
      <SmoothScroll />

      {/* ================= HERO ================= */}
      <section id="analisar" className="relative scroll-mt-16">
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-10 px-4 pb-14 pt-8 sm:px-6 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)] lg:gap-16 lg:pb-20 lg:pt-16">
          <div className="flex min-w-0 flex-col justify-center">
            <h1 className="font-serif text-[46px] leading-[0.98] tracking-[-0.015em] sm:text-[68px] lg:text-[84px]">
              <SplitReveal as="span" immediate className="block">
                O que sua empresa pagou a mais em energia
              </SplitReveal>
              <span className="rise-in block italic" style={{ animationDelay: "0.55s" }}>
                <Marker>pode voltar.</Marker>
              </span>
            </h1>
            <p className="rise-in mt-8 hidden flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11.5px] uppercase tracking-[0.12em] text-stone sm:flex" style={{ animationDelay: "0.8s" }}>
              <span>Auditoria técnica</span>
              <span className="h-3 w-px bg-line" />
              <span>REN ANEEL 1.000/2021</span>
              <span className="h-3 w-px bg-line" />
              <span>CDC, art. 42</span>
              <span className="h-3 w-px bg-line" />
              <span>LC 87/96</span>
            </p>
          </div>

          <div className="rise-in" style={{ animationDelay: "0.35s" }}>
            <QuizFunnel />
          </div>
        </div>

        {/* Faixa de fatos */}
        <div className="border-y border-line">
          <dl className="mx-auto grid max-w-6xl grid-cols-3 divide-x divide-line px-0 sm:px-6">
            {[
              { v: 60, prefix: "", l: "faturas no período revisável" },
              { v: 12, prefix: "", l: "regras técnicas por fatura" },
              { v: 0, prefix: "R$ ", l: "de custo inicial" },
            ].map((k) => (
              <div key={k.l} className="flex flex-col-reverse gap-1 px-4 py-6 sm:px-8 sm:py-8">
                <dt className="text-[12.5px] leading-snug text-stone sm:text-sm">{k.l}</dt>
                <dd className="font-serif text-[40px] leading-none sm:text-[56px]">
                  <CountUp value={k.v} prefix={k.prefix} />
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="py-6">
          <p className="mb-3 text-center font-mono text-[10.5px] uppercase tracking-[0.18em] text-stone">Faturas das principais distribuidoras do país</p>
          <div className="relative">
            <Marquee className="[--duration:80s] [--gap:3.5rem]">
              {DISTRIBUTOR_NAMES.map((n) => (
                <span key={n} className="whitespace-nowrap text-[15px] font-medium tracking-tight text-stone/80">
                  {n}
                </span>
              ))}
            </Marquee>
            <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-paper" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-paper" />
          </div>
        </div>
      </section>

      {/* ================= MÉTODO: FATURA ANOTADA ================= */}
      <section id="metodo" className="scroll-mt-16 border-t border-line py-20 sm:py-28">
        <div className="mx-auto grid max-w-6xl gap-14 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-20">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionLabel n="01">Método</SectionLabel>
            <SplitReveal className="mt-6 font-serif text-[40px] leading-[1.02] tracking-[-0.01em] sm:text-[54px]">
              Uma fatura tem dezenas de itens regulados. Quase ninguém confere.
            </SplitReveal>
            <Reveal>
              <p data-reveal-item className="mt-6 max-w-md text-[17px] leading-relaxed text-stone">
                Leitura, demanda, energia reativa, classe tarifária e tributos seguem regras da ANEEL e da legislação. Quando algo sai do padrão, o erro costuma se repetir todo mês — até alguém perceber.
              </p>
            </Reveal>
          </div>
          <AnnotatedInvoice />
        </div>
      </section>

      {/* ================= ONDE ESTÃO OS VALORES ================= */}
      <section className="bg-ink py-20 text-white sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionLabel n="02" dark>
            Onde estão os valores
          </SectionLabel>
          <SplitReveal className="mt-6 max-w-3xl font-serif text-[40px] leading-[1.02] tracking-[-0.01em] sm:text-[58px]">
            Três frentes. Uma única auditoria.
          </SplitReveal>
          <Reveal className="mt-14 border-t border-white/15">
            {FRONTS.map((f, i) => (
              <div key={f.title} data-reveal-item className="grid gap-4 border-b border-white/15 py-8 md:grid-cols-[80px_minmax(0,1fr)_minmax(0,1.4fr)] md:gap-8">
                <span className="font-mono text-[13px] text-white/45">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="font-serif text-[32px] leading-none sm:text-[38px]">{f.title}</h3>
                <div>
                  <p className="text-[16px] leading-relaxed text-white/75">{f.text}</p>
                  <p className="mt-3 font-mono text-[11.5px] uppercase tracking-[0.1em] text-volt">{f.law}</p>
                </div>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ================= PRAZO (frase que acende no scroll) ================= */}
      <section className="py-24 sm:py-36">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <ScrubWords className="font-serif text-[36px] leading-[1.08] tracking-[-0.01em] sm:text-[60px]">
            O direito de reaver valores pagos a mais prescreve em cinco anos. A cada mês, uma fatura deixa de poder ser revisada.
          </ScrubWords>
        </div>
      </section>

      {/* ================= COMO TRABALHAMOS ================= */}
      <section id="como-funciona" className="scroll-mt-16 border-t border-line bg-paper-2/60 py-20 sm:py-28">
        <div className="mx-auto grid max-w-6xl gap-14 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-20">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionLabel n="03">Como trabalhamos</SectionLabel>
            <SplitReveal className="mt-6 font-serif text-[40px] leading-[1.02] tracking-[-0.01em] sm:text-[54px]">
              Nós conduzimos. Você acompanha.
            </SplitReveal>
            <Reveal>
              <p data-reveal-item className="mt-6 max-w-md text-[17px] leading-relaxed text-stone">
                Da primeira fatura à restituição, cuidamos da análise, dos laudos e dos protocolos. Sua equipe não precisa parar para isso.
              </p>
              <div data-reveal-item className="mt-8 max-w-md border-l-2 border-volt pl-5">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-stone">Honorários de êxito</p>
                <p className="mt-2 text-[16px] leading-relaxed">Sem mensalidade e sem custo inicial: {successFeeText()}.</p>
              </div>
            </Reveal>
          </div>
          <ProcessSteps steps={STEPS} />
        </div>
      </section>

      {/* ================= CASOS ================= */}
      <section id="casos" className="scroll-mt-16 border-t border-line bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionLabel n="04">Casos</SectionLabel>
          <SplitReveal className="mt-6 max-w-3xl font-serif text-[40px] leading-[1.02] tracking-[-0.01em] sm:text-[54px]">
            O que uma auditoria costuma encontrar.
          </SplitReveal>

          <Reveal className="mt-14">
            <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,0.6fr)_minmax(0,0.9fr)] gap-6 border-b border-line pb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-stone md:grid">
              <span>Empresa</span>
              <span>Ocorrência</span>
              <span>Período</span>
              <span className="text-right">Valor possível</span>
            </div>
            {CASES.map((c) => (
              <div
                key={c.who}
                data-reveal-item
                className="grid gap-2 border-b border-line py-7 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,0.6fr)_minmax(0,0.9fr)] md:items-baseline md:gap-6"
              >
                <div>
                  <p className="text-[17px] font-medium">{c.who}</p>
                  <p className="font-mono text-[11.5px] text-stone">{c.where}</p>
                </div>
                <p className="text-[16px] leading-snug">{c.issue}</p>
                <p className="text-[15px] text-stone">{c.period}</p>
                <div className="md:text-right">
                  <p className="font-serif text-[38px] leading-none">
                    <CountUp value={c.value} prefix="R$ " />
                  </p>
                  <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.1em] text-stone">{c.kind}</p>
                </div>
              </div>
            ))}
          </Reveal>
          <p className="mt-5 text-[12.5px] text-stone">Casos ilustrativos, com valores fictícios. O resultado real depende da comprovação e da análise de cada caso.</p>
        </div>
      </section>

      {/* ================= DÚVIDAS ================= */}
      <section id="faq" className="scroll-mt-16 border-t border-line py-20 sm:py-28">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-20">
          <div>
            <SectionLabel n="05">Dúvidas</SectionLabel>
            <SplitReveal className="mt-6 font-serif text-[40px] leading-[1.02] tracking-[-0.01em] sm:text-[54px]">
              Antes de começar.
            </SplitReveal>
            <p className="mt-6 text-[15px] text-stone">
              Outra pergunta? <OpenChatButton className="font-medium text-foreground underline underline-offset-4 hover:no-underline" label="Fale com nosso assistente" />
            </p>
          </div>
          <Reveal className="border-t border-line">
            {FAQ_HOME.map((f) => (
              <details key={f.q} data-reveal-item className="group border-b border-line py-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-[17px] font-medium">
                  {f.q}
                  <span className="relative size-4 shrink-0 text-stone" aria-hidden>
                    <span className="absolute left-0 top-1/2 h-px w-4 bg-current" />
                    <span className="absolute left-1/2 top-0 h-4 w-px bg-current transition-transform duration-300 group-open:rotate-90" />
                  </span>
                </summary>
                <p className="mt-3 max-w-2xl text-[15.5px] leading-relaxed text-stone">{f.a}</p>
              </details>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ================= CTA FINAL ================= */}
      <section className="bg-ink text-white">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
          <SplitReveal className="max-w-4xl font-serif text-[48px] leading-[0.98] tracking-[-0.015em] sm:text-[88px]">Comece pelo diagnóstico.</SplitReveal>
          <Reveal className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
            <Link
              data-reveal-item
              href="#analisar"
              className="group inline-flex h-13 items-center gap-2 rounded-full bg-white px-7 text-[15px] font-medium text-ink transition-colors hover:bg-volt"
            >
              Iniciar diagnóstico <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <p data-reveal-item className="text-[15px] text-white/65">
              Cinco perguntas. Sem custo e sem compromisso.
            </p>
          </Reveal>
          <div className="mt-20 flex flex-wrap gap-x-8 gap-y-3 border-t border-white/15 pt-6 text-[13px] text-white/55">
            <Link href="/guia-conta-de-energia" className="inline-flex items-center gap-1 hover:text-white">
              Guia: como ler a conta de energia <ArrowUpRight className="size-3.5" />
            </Link>
            <Link href="/gd-por-assinatura" className="inline-flex items-center gap-1 hover:text-white">
              Energia por assinatura <ArrowUpRight className="size-3.5" />
            </Link>
            <Link href="/mercado-livre" className="inline-flex items-center gap-1 hover:text-white">
              Mercado Livre de energia <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </section>

      <StickyCta />
    </div>
  );
}
