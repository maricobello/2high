import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { OpenChatButton } from "@/components/chat/open-chat-button";
import { QuizFunnel } from "@/components/forms/quiz-funnel";
import { BlurFade } from "@/components/magicui/blur-fade";
import { DotPattern } from "@/components/magicui/dot-pattern";
import { Marquee } from "@/components/magicui/marquee";
import { HeroHeadline } from "@/components/site/hero-headline";
import { ReportPreview } from "@/components/site/report-preview";
import { StickyCta } from "@/components/site/sticky-cta";
import { Eyebrow } from "@/components/ui/card";
import { FAQ } from "@/content/faq";
import { DISTRIBUTORS } from "@/modules/invoice/distributors";

const DISTRIBUTOR_NAMES = [...new Set(DISTRIBUTORS.filter((d) => d.states.length).map((d) => d.name))];

const STEPS = [
  { title: "Auditoria", text: "Lemos as faturas e mostramos o relatório antes do contrato." },
  { title: "Devolução", text: "Pedimos à distribuidora, em dobro quando o erro é dela." },
  { title: "Gestão", text: "Demanda, tarifa e contratos, acompanhados todo mês." },
];

const FAQ_HOME = FAQ.filter((f) => f.home);

/** CTA padrão (fundo claro): h-12, cantos 12px, 15px, peso 600. */
const cta =
  "group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-[15px] font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30";
/** CTA sobre fundo escuro. */
const ctaLight =
  "group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 text-[15px] font-semibold text-ink transition-colors hover:bg-volt focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40";
const arrow = <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />;

export default function HomePage() {
  return (
    <>
      {/* ================= HERO + QUIZ ================= */}
      <section id="analisar" className="relative scroll-mt-16 overflow-hidden bg-ink text-white">
        <div className="glow absolute inset-0" />
        <DotPattern className="[mask-image:radial-gradient(700px_circle_at_25%_30%,white,transparent)]" />
        <div className="relative mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-7 px-4 pb-14 pt-6 sm:px-6 md:pt-12 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)] lg:gap-12 lg:pb-20">
          <div className="flex min-w-0 flex-col justify-center">
            <HeroHeadline />
            <p className="rise-in mt-6 max-w-lg text-base leading-relaxed text-white/80 sm:text-xl sm:leading-relaxed" style={{ animationDelay: "0.5s" }}>
              Auditamos até 60 faturas, pedimos a devolução de cobranças indevidas e gerimos sua energia todo mês.
            </p>
            <ul className="rise-in mt-8 hidden gap-3.5 text-[15px] font-medium text-white/90 lg:grid" style={{ animationDelay: "0.65s" }}>
              {["Auditoria sem custo", "Remuneração só sobre o valor recuperado", "Relatório antes de qualquer contrato"].map((t) => (
                <li key={t} className="flex items-center gap-3">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-volt text-ink">
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <BlurFade delay={0.1}>
            <QuizFunnel />
          </BlurFade>
        </div>

        <div className="relative border-t border-white/10 bg-white/[0.02] py-5">
          <p className="mb-3 text-center text-[12px] font-medium text-white/60">Lemos faturas de</p>
          <div className="relative">
            <Marquee className="[--duration:70s] [--gap:3rem]">
              {DISTRIBUTOR_NAMES.map((n) => (
                <span key={n} className="whitespace-nowrap text-[15px] font-semibold tracking-tight text-white/65">
                  {n}
                </span>
              ))}
            </Marquee>
            <div className="pointer-events-none absolute inset-y-0 left-0 w-28 bg-gradient-to-r from-ink" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-28 bg-gradient-to-l from-ink" />
          </div>
        </div>
      </section>

      {/* ================= O QUE VERIFICAMOS (prévia do relatório) ================= */}
      <section id="verificacao" className="scroll-mt-16 bg-background py-20 sm:py-28">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-center lg:gap-16">
          <BlurFade>
            <Eyebrow>O que verificamos</Eyebrow>
            <h2 className="mt-3 text-[32px] font-bold leading-[1.08] tracking-[-0.03em] sm:text-5xl">Cada fatura, conferida item por item</h2>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-muted">Este é o relatório que você recebe antes de qualquer contrato.</p>
            <Link href="#analisar" className={`${cta} mt-8`}>
              Fazer diagnóstico {arrow}
            </Link>
          </BlurFade>
          <BlurFade delay={0.1}>
            <ReportPreview />
          </BlurFade>
        </div>
      </section>

      {/* ================= COMO FUNCIONA ================= */}
      <section id="como-funciona" className="scroll-mt-16 border-t border-border bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <BlurFade className="max-w-2xl">
            <Eyebrow>Como funciona</Eyebrow>
            <h2 className="mt-3 text-[32px] font-bold leading-[1.08] tracking-[-0.03em] sm:text-5xl">Três etapas, pela via administrativa</h2>
          </BlurFade>

          <ol className="relative mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
            <span aria-hidden className="absolute left-5 right-5 top-5 hidden h-px bg-border md:block" />
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative">
                <BlurFade delay={0.08 * i}>
                  <span className="relative flex size-10 items-center justify-center rounded-full bg-ink text-sm font-bold text-volt ring-8 ring-white">{i + 1}</span>
                  <h3 className="mt-5 text-xl font-bold tracking-tight">{s.title}</h3>
                  <p className="mt-1.5 max-w-xs text-[15px] leading-relaxed text-muted">{s.text}</p>
                </BlurFade>
              </li>
            ))}
          </ol>

          <BlurFade>
            <div className="mt-14 flex flex-col gap-5 rounded-3xl bg-ink px-6 py-6 text-white sm:flex-row sm:items-center sm:justify-between sm:px-8">
              <p className="text-lg font-semibold tracking-tight sm:text-xl">
                Diagnóstico e auditoria sem custo. <span className="text-white/65">Remuneração só sobre o valor recuperado. Sem mensalidade.</span>
              </p>
              <Link href="#analisar" className={`${ctaLight} shrink-0`}>
                Fazer diagnóstico {arrow}
              </Link>
            </div>
          </BlurFade>
        </div>
      </section>

      {/* ================= PERGUNTAS ================= */}
      <section id="faq" className="scroll-mt-16 border-t border-border bg-background py-20 sm:py-28">
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
              <details key={f.q} className="group rounded-2xl border border-border bg-white px-5 py-4 transition-shadow open:shadow-[0_10px_30px_-15px_rgba(7,11,22,0.25)] [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-semibold">
                  {f.q}
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-subtle text-lg leading-none text-foreground transition-transform duration-300 group-open:rotate-45 group-open:bg-primary group-open:text-white">
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
      <section className="bg-background px-4 pb-24 sm:px-6">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[28px] bg-ink px-6 py-16 text-center text-white sm:px-12 sm:py-20">
          <div className="glow absolute inset-0" />
          <DotPattern className="[mask-image:radial-gradient(500px_circle_at_50%_0%,white,transparent)]" />
          <div className="relative">
            <h2 className="mx-auto max-w-3xl text-balance text-[34px] font-bold leading-[1.08] tracking-[-0.035em] sm:text-6xl">
              Pior cenário: você confirma que <span className="text-volt">está tudo certo.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg text-white/75">Cinco perguntas. A fatura pode ficar para depois.</p>
            <Link href="#analisar" className={`${ctaLight} mt-9`}>
              Fazer diagnóstico {arrow}
            </Link>
            <p className="mt-6 text-[13px] text-white/60">Sem custo · Relatório antes de qualquer contrato · Dados tratados conforme a LGPD</p>
          </div>
        </div>
      </section>

      <StickyCta />
    </>
  );
}
