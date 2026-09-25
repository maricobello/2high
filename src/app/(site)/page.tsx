import { ArrowRight, Building2, Factory, Store } from "lucide-react";
import Link from "next/link";
import { OpenChatButton } from "@/components/chat/open-chat-button";
import { QuizFunnel } from "@/components/forms/quiz-funnel";
import { BlurFade } from "@/components/magicui/blur-fade";
import { DotPattern } from "@/components/magicui/dot-pattern";
import { Marquee } from "@/components/magicui/marquee";
import { NumberTicker } from "@/components/magicui/number-ticker";
import { HeroHeadline } from "@/components/site/hero-headline";
import { StickyCta } from "@/components/site/sticky-cta";
import { Eyebrow } from "@/components/ui/card";
import { FAQ } from "@/content/faq";
import { successFeeText } from "@/lib/brand";
import { DISTRIBUTORS } from "@/modules/invoice/distributors";

const DISTRIBUTOR_NAMES = [...new Set(DISTRIBUTORS.filter((d) => d.states.length).map((d) => d.name))];

const STEPS = [
  { title: "Auditoria", text: "Mostramos o que encontramos nas faturas antes de qualquer contrato." },
  { title: "Devolução", text: "Pedimos à distribuidora pela via administrativa: ouvidoria e ANEEL, se preciso." },
  { title: "Gestão", text: "Acompanhamos demanda, tarifa e contratos, todo mês." },
];

/** Exemplos FICTÍCIOS (sinalizados como tal na página), um por perfil de cliente. */
const CASES = [
  { icon: Store, who: "Padaria · SP", issue: "Consumo estimado acima do real, sem acerto, por 14 meses", label: "Devolução possível", value: 12_480, suffix: "" },
  { icon: Building2, who: "Condomínio comercial · MG", issue: "Demanda contratada acima do uso", label: "Economia possível", value: 1_900, suffix: "/mês" },
  { icon: Factory, who: "Indústria de alimentos · SC", issue: "ICMS da energia da produção nunca creditado", label: "Crédito de ICMS possível", value: 186_400, suffix: "" },
];

const FAQ_HOME = FAQ.filter((f) => f.home);

const ctaClass =
  "group inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-6 text-[15px] font-semibold text-white transition-colors hover:bg-primary-hover";

export default function HomePage() {
  return (
    <>
      {/* ================= HERO + QUIZ ================= */}
      <section id="analisar" className="relative scroll-mt-16 overflow-hidden bg-ink text-white">
        <div className="glow absolute inset-0" />
        <DotPattern className="[mask-image:radial-gradient(700px_circle_at_25%_30%,white,transparent)]" />
        <div className="relative mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-7 px-4 pb-14 pt-6 sm:px-6 md:pt-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-12 lg:pb-20">
          <div className="flex min-w-0 flex-col justify-center">
            <HeroHeadline />
            <p className="rise-in mt-6 max-w-lg text-base leading-relaxed text-white/80 sm:text-xl sm:leading-relaxed" style={{ animationDelay: "0.5s" }}>
              Auditamos suas últimas 60 faturas, pedimos a devolução de cobranças indevidas e fazemos a gestão mensal da energia.
            </p>
          </div>
          <BlurFade delay={0.1}>
            <QuizFunnel />
          </BlurFade>
        </div>

        <div className="relative border-t border-white/10 bg-white/[0.02] py-5">
          <p className="mb-3 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-white/60">Auditamos faturas de</p>
          <div className="relative">
            <Marquee className="[--duration:70s] [--gap:3rem]">
              {DISTRIBUTOR_NAMES.map((n) => (
                <span key={n} className="whitespace-nowrap text-[15px] font-bold tracking-tight text-white/50">
                  {n}
                </span>
              ))}
            </Marquee>
            <div className="pointer-events-none absolute inset-y-0 left-0 w-28 bg-gradient-to-r from-ink" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-28 bg-gradient-to-l from-ink" />
          </div>
        </div>
      </section>

      {/* ================= COMO FUNCIONA ================= */}
      <section id="como-funciona" className="scroll-mt-16 bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <BlurFade className="max-w-2xl">
            <Eyebrow>Como funciona</Eyebrow>
            <h2 className="mt-3 text-[32px] font-bold leading-[1.1] tracking-[-0.03em] sm:text-5xl">Você envia a fatura. Nós cuidamos do resto.</h2>
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
            <div className="mt-14 flex flex-col gap-5 rounded-2xl bg-ink px-6 py-6 text-white sm:flex-row sm:items-center sm:justify-between sm:px-8">
              <p className="text-lg font-semibold tracking-tight sm:text-xl">
                {successFeeText()}. <span className="text-white/60">Sem mensalidade.</span>
              </p>
              <Link href="#analisar" className="group inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-6 text-[15px] font-semibold text-ink transition-colors hover:bg-volt">
                Fazer diagnóstico <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </BlurFade>
        </div>
      </section>

      {/* ================= EXEMPLOS ================= */}
      <section id="exemplos" className="scroll-mt-16 border-t border-border bg-background py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <BlurFade className="max-w-2xl">
            <Eyebrow>Exemplos fictícios</Eyebrow>
            <h2 className="mt-3 text-[32px] font-bold leading-[1.1] tracking-[-0.03em] sm:text-5xl">O que uma auditoria pode encontrar</h2>
          </BlurFade>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {CASES.map(({ icon: Icon, who, issue, label, value, suffix }, i) => (
              <BlurFade key={who} delay={0.06 * i}>
                <article className="flex h-full flex-col rounded-3xl border border-border bg-white p-6 shadow-[0_20px_50px_-30px_rgba(7,11,22,0.3)]">
                  <p className="flex items-center gap-2 text-sm font-semibold text-muted">
                    <Icon className="size-4" /> {who}
                  </p>
                  <p className="mt-3 text-lg font-bold leading-snug tracking-tight">{issue}</p>
                  <div className="mt-auto pt-6">
                    <div className="rounded-2xl bg-ink px-4 py-3.5 text-white">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">{label}</p>
                      <p className="mt-0.5 text-[28px] font-bold tracking-tight text-volt tabular">
                        <NumberTicker value={value} prefix="R$ " suffix={suffix} />
                      </p>
                    </div>
                  </div>
                </article>
              </BlurFade>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs text-muted">Valores fictícios. O resultado depende de cada caso.</p>
            <Link href="#analisar" className={ctaClass}>
              Fazer diagnóstico <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ================= PERGUNTAS ================= */}
      <section id="faq" className="scroll-mt-16 border-t border-border bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <Eyebrow className="text-center">Perguntas frequentes</Eyebrow>
          <h2 className="mt-3 text-center text-[32px] font-bold tracking-[-0.03em] sm:text-4xl">Sem letras miúdas</h2>
          <div className="mt-10 space-y-3">
            {FAQ_HOME.map((f) => (
              <details key={f.q} className="group rounded-2xl border border-border bg-background px-5 py-4 transition-shadow open:bg-white open:shadow-[0_10px_30px_-15px_rgba(7,11,22,0.25)] [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-semibold">
                  {f.q}
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-subtle text-lg leading-none text-foreground transition-transform duration-300 group-open:rotate-45 group-open:bg-primary group-open:text-white">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-[15px] leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
          <p className="mt-8 text-center text-[15px] text-muted">
            Outra dúvida? <OpenChatButton className="font-bold text-primary hover:underline" label="Pergunte à nossa IA" />
          </p>
        </div>
      </section>

      {/* ================= CTA FINAL ================= */}
      <section className="bg-white px-4 pb-24 sm:px-6">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[32px] bg-ink px-6 py-16 text-center text-white sm:px-12 sm:py-20">
          <div className="glow absolute inset-0" />
          <DotPattern className="[mask-image:radial-gradient(500px_circle_at_50%_0%,white,transparent)]" />
          <div className="relative">
            <h2 className="mx-auto max-w-3xl text-[34px] font-bold leading-[1.08] tracking-[-0.035em] sm:text-6xl">
              Pior cenário: você confirma que <span className="text-volt">está tudo certo.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg text-white/75">Cinco perguntas. A fatura pode ficar para depois.</p>
            <Link
              href="#analisar"
              className="group mt-9 inline-flex h-14 items-center gap-2 rounded-2xl bg-white px-8 text-base font-semibold text-ink transition-colors hover:bg-volt"
            >
              Fazer diagnóstico <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </section>

      <StickyCta />
    </>
  );
}
