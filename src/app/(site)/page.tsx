import { ArrowRight, ArrowUpRight, Check, Search, SolarPanel, Zap } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { OpenChatButton } from "@/components/chat/open-chat-button";
import { QuizFunnel } from "@/components/forms/quiz-funnel";
import { BlurFade } from "@/components/magicui/blur-fade";
import { DotPattern } from "@/components/magicui/dot-pattern";
import { DistributorStrip } from "@/components/site/distributor-strip";
import { HeroHeadline } from "@/components/site/hero-headline";
import { HERO_PHOTO, HeroScene } from "@/components/site/hero-scene";
import { BorderBeam } from "@/components/magicui/border-beam";
import { ScanDemo } from "@/components/site/scan-demo";
import { StickyCta } from "@/components/site/sticky-cta";
import { Eyebrow } from "@/components/ui/card";
import { FAQ } from "@/content/faq";
import { brand } from "@/lib/brand";
import { jsonLd, pageMetadata } from "@/lib/seo";
import { DISTRIBUTORS } from "@/modules/invoice/distributors";

const DISTRIBUTOR_NAMES = [...new Set(DISTRIBUTORS.filter((d) => d.states.length).map((d) => d.name))];

/** Manchetes reais (título exato e link). Contexto do setor, não endosso. */
const NEWS = [
  {
    outlet: "CNN Brasil",
    title: "Contas de luz vão subir até o triplo do IPCA em 2026",
    fact: "Reajustes de até 13,12% em algumas distribuidoras.",
    href: "https://www.cnnbrasil.com.br/economia/macroeconomia/contas-de-luz-vao-subir-ate-o-triplo-do-ipca-em-2026/",
  },
  {
    outlet: "CNN Brasil",
    title: "Aneel aprova reajuste médio de 6,50% nas tarifas da Cemig-D",
    fact: "Para a alta tensão (empresas e indústria), a alta média foi de 9,43%.",
    href: "https://www.cnnbrasil.com.br/infra/aneel-aprova-reajuste-medio-de-650-nas-tarifas-da-cemig-d/",
  },
  {
    outlet: "Exame",
    title: "Aneel prevê aumento de 8,6% na conta de luz em 2026, acima da inflação",
    fact: "Projeção da ANEEL para a alta média das tarifas no ano.",
    href: "https://exame.com/economia/aneel-preve-aumento-de-86-na-conta-de-luz-em-2026-acima-da-inflacao/",
  },
  {
    outlet: "Agência Brasil",
    title: "Conta de luz fica 10% mais cara em São Paulo",
    fact: "Reajuste médio de 10,18% na área da Enel São Paulo.",
    href: "https://agenciabrasil.ebc.com.br/economia/noticia/2026-07/conta-de-luz-fica-10-mais-cara-em-sao-paulo",
  },
];

const STATS = [
  {
    value: "12,31%",
    label: "foi a alta da energia elétrica residencial em 2025, contra 4,26% da inflação (IPCA).",
    source: "IBGE",
    href: "https://agenciadenoticias.ibge.gov.br/agencia-noticias/2012-agencia-de-noticias/noticias/45613-ipca-em-dezembro-vai-a-0-33-e-acumula-4-26-em-2025",
  },
  {
    value: "8,6%",
    label: "é a alta média das tarifas prevista pela ANEEL para 2026.",
    source: "CNN Brasil",
    href: "https://www.cnnbrasil.com.br/infra/conta-de-luz-deve-subir-86-em-2026-diz-aneel/",
  },
];

const STEPS = [
  { title: "Auditoria", text: "Lemos as faturas e mostramos o relatório antes do contrato." },
  { title: "Devolução", text: "Pedimos a devolução pela via administrativa, em dobro quando o erro é dela (CDC, art. 42)." },
  { title: "Gestão", text: "Demanda, tarifa e contratos, acompanhados todo mês." },
];

const FAQ_HOME = FAQ.filter((f) => f.home);

const SERVICES = [
  { icon: Search, title: "Auditoria de", sub: "faturas de energia" },
  { icon: SolarPanel, title: "Geração Distribuída", sub: "(energia solar por assinatura)" },
  { icon: Zap, title: "Mercado Livre", sub: "de Energia" },
];

export const metadata = pageMetadata({
  path: "/",
  absoluteTitle: true,
  title: `${brand.name} — Auditoria e gestão de energia para empresas`,
  description: "Sua empresa paga energia todo mês. Alguém confere? Auditamos a conta item por item e pedimos de volta o que foi cobrado errado. Diagnóstico sem custo.",
});

/** Dados estruturados (Organization, Service e FAQ) para buscadores e assistentes de IA. */
const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: brand.name,
      url: brand.appUrl,
      ...(brand.legalName ? { legalName: brand.legalName } : {}),
      ...(brand.legalCnpj ? { taxID: brand.legalCnpj } : {}),
    },
    {
      "@type": "Service",
      name: "Auditoria de faturas de energia",
      serviceType: "Auditoria e gestão de energia elétrica",
      provider: { "@type": "Organization", name: brand.name },
      areaServed: { "@type": "Country", name: "Brasil" },
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ_HOME.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ],
};

/** CTA padrão: verde da marca, texto escuro. */
const cta =
  "group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-7 text-[13px] font-bold uppercase tracking-[0.08em] text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";
/** CTA sobre fundo escuro (mesmo estilo). */
const ctaLight = cta;
/** Botões do topo (pílula verde e pílula contornada), como na identidade. */
const pill = `${cta} h-[52px] px-8 shadow-[0_0_32px_-8px_rgba(62,224,102,0.7)]`;
const pillOutline =
  "inline-flex h-[52px] items-center justify-center rounded-full border border-white/30 px-8 text-[13px] font-bold uppercase tracking-[0.08em] text-white transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
const arrow = <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />;

export default function HomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(STRUCTURED_DATA)} />
      {/* ================= HERO + QUIZ ================= */}
      <section id="analisar" className="relative scroll-mt-16 overflow-hidden bg-ink text-white">
        <HeroScene />
        <div className="relative mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-7 px-4 pb-14 pt-6 sm:px-6 md:pt-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-14 lg:px-10 lg:pb-20">
          <div className="flex min-w-0 flex-col justify-center">
            <p className="rise-in mb-4 flex items-center gap-3 font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-primary sm:text-[13px]">
              <span className="h-0.5 w-10 rounded-full bg-primary" aria-hidden />
              Auditoria e gestão de energia
            </p>
            <HeroHeadline />
            <p className="rise-in mt-5 max-w-xl text-base leading-relaxed text-white/80 lg:hidden" style={{ animationDelay: "0.5s" }}>
              Analisamos sua fatura e pedimos de volta o que foi cobrado errado. <span className="font-medium text-primary">Sem custo.</span>
            </p>
            <p className="rise-in mt-6 hidden max-w-xl text-lg leading-relaxed text-white/80 lg:block" style={{ animationDelay: "0.5s" }}>
              Nós analisamos sua fatura de energia, identificamos oportunidades de economia e estruturamos soluções em GD, Mercado Livre e muito mais.
            </p>
            <ul className="rise-in mt-9 hidden grid-cols-3 lg:grid" style={{ animationDelay: "0.65s" }}>
              {SERVICES.map(({ icon: Icon, title, sub }, i) => (
                <li key={title} className={i ? "border-l border-white/15 pl-6" : "pr-6"}>
                  <Icon className="size-8 text-primary" strokeWidth={1.5} aria-hidden />
                  <p className="mt-3 text-[15px] leading-snug text-white/90">
                    {title}
                    {sub && <span className="block text-white/70">{sub}</span>}
                  </p>
                </li>
              ))}
            </ul>
            <div className="rise-in mt-9 hidden flex-wrap gap-4 lg:flex" style={{ animationDelay: "0.75s" }}>
              <Link href="#analisar" className={pill}>
                Fazer uma análise gratuita {arrow}
              </Link>
              <Link href="#como-funciona" className={pillOutline}>
                Saiba mais
              </Link>
            </div>
          </div>
          {/* Sem animação de entrada: o quiz é o maior elemento da tela (LCP) e aparece já pintado */}
          <QuizFunnel />
        </div>

        <DistributorStrip names={DISTRIBUTOR_NAMES} />
      </section>

      {/* ================= NA IMPRENSA (contexto: a conta sobe) ================= */}
      <section id="imprensa" className="scroll-mt-16 bg-background py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <BlurFade className="max-w-2xl">
            <Eyebrow>Na imprensa</Eyebrow>
            <h2 className="mt-3 text-[32px] font-bold leading-[1.08] tracking-[-0.03em] sm:text-5xl">A conta de luz está subindo mais que a inflação</h2>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">Com a tarifa mais alta, cada erro de leitura, demanda ou tarifa custa mais. Vale conferir.</p>
          </BlurFade>

          <BlurFade delay={0.05}>
            <dl className="mt-10 grid gap-4 sm:grid-cols-2">
              {STATS.map((st) => (
                <div key={st.label} className="rounded-3xl border border-primary/20 bg-ink px-6 py-6 text-white">
                  <dd className="text-5xl font-bold tracking-[-0.03em] text-volt tabular">{st.value}</dd>
                  <dt className="mt-2 text-[15px] leading-snug text-white/80">
                    {st.label}{" "}
                    <a href={st.href} target="_blank" rel="noopener noreferrer" className="text-white/70 underline underline-offset-2 hover:text-white">
                      Fonte: {st.source}
                    </a>
                  </dt>
                </div>
              ))}
            </dl>
          </BlurFade>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {NEWS.map((n, i) => (
              <BlurFade key={n.href} className={i >= 2 ? "hidden md:block" : undefined}>
                <a
                  href={n.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex h-full flex-col rounded-3xl border border-border bg-card p-6 transition-shadow hover:shadow-[0_20px_50px_-30px_rgba(7,11,22,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted">{n.outlet}</p>
                  <p className="mt-2 text-lg font-bold leading-snug tracking-tight">“{n.title}”</p>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{n.fact}</p>
                  <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-[14px] font-semibold text-primary">
                    Ler reportagem <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </span>
                </a>
              </BlurFade>
            ))}
          </div>
          <p className="mt-5 text-xs text-muted">Reportagens de terceiros sobre o setor elétrico. Os veículos citados não têm relação com a {brand.name}.</p>
        </div>
      </section>

      {/* ================= RAIO-X (demonstração animada) ================= */}
      <section id="raio-x" className="relative scroll-mt-16 overflow-hidden border-t border-white/5 bg-ink py-20 text-white sm:py-24">
        <div className="glow absolute inset-0 opacity-80" />
        <DotPattern className="[mask-image:radial-gradient(600px_circle_at_20%_50%,white,transparent)]" />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <BlurFade className="mb-12 max-w-2xl">
            <Eyebrow className="text-cyan">Exemplo de auditoria</Eyebrow>
            <h2 className="mt-3 text-[32px] font-bold leading-[1.08] tracking-[-0.03em] sm:text-5xl">Envie a fatura e veja o resultado em cerca de 1 minuto</h2>
          </BlurFade>
          <ScanDemo />
          <div className="mt-12 flex flex-wrap items-center gap-4">
            <Link href="#analisar" className={ctaLight}>
              Fazer diagnóstico {arrow}
            </Link>
            <span className="text-sm text-white/70">5 perguntas, depois a fatura · sem custo</span>
          </div>
        </div>
      </section>

      {/* ================= COMO FUNCIONA ================= */}
      <section id="como-funciona" className="scroll-mt-16 border-t border-border bg-card py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <BlurFade className="max-w-2xl">
            <Eyebrow>Como funciona</Eyebrow>
            <h2 className="mt-3 text-[32px] font-bold leading-[1.08] tracking-[-0.03em] sm:text-5xl">Como pedimos a devolução à distribuidora</h2>
          </BlurFade>

          <ol className="relative mt-10 grid gap-10 md:grid-cols-3 md:gap-8">
            <span aria-hidden className="absolute left-5 right-5 top-5 hidden h-px bg-border md:block" />
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative">
                <BlurFade delay={0.08 * i}>
                  <span className="relative flex size-10 items-center justify-center rounded-full bg-ink text-sm font-bold text-volt ring-8 ring-card border border-primary/40">{i + 1}</span>
                  <h3 className="mt-5 text-xl font-bold tracking-tight">{s.title}</h3>
                  <p className="mt-1.5 max-w-xs text-[15px] leading-relaxed text-muted">{s.text}</p>
                </BlurFade>
              </li>
            ))}
          </ol>

          <BlurFade>
            <div className="mt-10 flex flex-col gap-5 rounded-3xl border border-primary/25 bg-ink px-6 py-6 text-white sm:flex-row sm:items-center sm:justify-between sm:px-8">
              <p className="text-lg font-semibold tracking-tight sm:text-xl">
                Diagnóstico e auditoria sem custo. <span className="text-white/65">Remuneração só sobre o valor recuperado. Sem mensalidade.</span>
              </p>
              <Link href="#analisar" className={`${cta} shrink-0`}>
                Fazer diagnóstico {arrow}
              </Link>
            </div>
          </BlurFade>
        </div>
      </section>

      {/* ================= PERGUNTAS ================= */}
      <section id="faq" className="scroll-mt-16 border-t border-border bg-background py-20 sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
          <div>
            <Eyebrow>Perguntas frequentes</Eyebrow>
            <h2 className="mt-3 text-[32px] font-bold leading-[1.08] tracking-[-0.03em] sm:text-5xl">Antes de começar</h2>
            <p className="mt-5 text-[15px] text-muted">
              Outra dúvida? <OpenChatButton className="font-semibold text-primary hover:underline" label="Pergunte ao assistente" />
            </p>
          </div>
          <div className="space-y-3">
            {FAQ_HOME.map((f) => (
              <details key={f.q} className="group rounded-2xl border border-border bg-card px-5 py-4 transition-shadow open:shadow-[0_10px_30px_-15px_rgba(7,11,22,0.25)] [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-semibold">
                  {f.q}
                  <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-subtle text-lg leading-none text-foreground transition-transform duration-300 group-open:rotate-45 group-open:bg-primary group-open:text-primary-foreground">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-[15px] leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ================= CTA FINAL ================= */}
      <section className="bg-background pb-20 sm:pb-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="relative overflow-hidden rounded-[28px] border border-primary/30 bg-ink text-white">
            <Image src={HERO_PHOTO} alt="" fill sizes="(min-width: 1152px) 1152px, 100vw" quality={55} className="object-cover object-[75%_center] opacity-70" />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,#030605_0%,rgba(3,6,5,0.93)_45%,rgba(3,6,5,0.45)_100%)]" />
            <BorderBeam size={220} duration={10} colorFrom="#3ee066" colorTo="#9cf5b2" borderWidth={2} />
            <div className="relative grid gap-10 px-6 py-12 sm:px-12 sm:py-16 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-center">
              <div>
                <Eyebrow>Diagnóstico sem custo</Eyebrow>
                <h2 className="mt-4 max-w-2xl text-balance text-[30px] font-bold leading-[1.1] tracking-[-0.03em] sm:text-[44px]">
                  Se estiver tudo certo, você fica sabendo. Se não estiver, <span className="text-primary">pedimos de volta.</span>
                </h2>
                <p className="mt-5 max-w-lg text-lg text-white/80">Cinco perguntas agora. A fatura pode ficar para depois.</p>
                <Link href="#analisar" className={`${pill} mt-8`}>
                  Fazer diagnóstico {arrow}
                </Link>
              </div>
              <ul className="grid gap-3 text-[15px] text-white/90">
                {["Relatório antes de qualquer contrato", "Remuneração só sobre o valor recuperado", "Até 60 faturas revisadas (5 anos)", "Dados tratados conforme a LGPD"].map((t) => (
                  <li key={t} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-[14px] sm:py-3.5 sm:text-[15px]">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-3.5" strokeWidth={3} />
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <StickyCta />
    </>
  );
}
