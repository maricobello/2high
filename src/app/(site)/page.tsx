import { ArrowRight, CalendarClock, Check, CheckCircle2, Factory, Landmark, Pill, Scale, Store } from "lucide-react";
import Link from "next/link";
import { OpenChatButton } from "@/components/chat/open-chat-button";
import { LeadMagnetForm } from "@/components/forms/lead-magnet-form";
import { AnimatedShinyText } from "@/components/magicui/animated-shiny-text";
import { BlurFade } from "@/components/magicui/blur-fade";
import { DotPattern } from "@/components/magicui/dot-pattern";
import { Marquee } from "@/components/magicui/marquee";
import { Meteors } from "@/components/magicui/meteors";
import { NumberTicker } from "@/components/magicui/number-ticker";
import { HeroHeadline } from "@/components/site/hero-headline";
import { ScrollTimeline } from "@/components/site/scroll-timeline";
import { StickyCta } from "@/components/site/sticky-cta";
import { Eyebrow } from "@/components/ui/card";
import { FAQ } from "@/content/faq";
import { DISTRIBUTORS } from "@/modules/invoice/distributors";

const DISTRIBUTOR_NAMES = [...new Set(DISTRIBUTORS.filter((d) => d.states.length).map((d) => d.name))];

/** Casos ILUSTRATIVOS (valores fictícios) — sinalizados como tal na página. */
const CASES = [
  {
    icon: Store,
    who: "Padaria · Grupo B · SP",
    issue: "Leitura estimada por 14 meses seguidos",
    months: 14,
    paid: 6_240,
  },
  {
    icon: Factory,
    who: "Metalúrgica · Grupo A · MG",
    issue: "Multa de energia reativa com fator de potência acima de 0,92",
    months: 22,
    paid: 21_300,
  },
  {
    icon: Pill,
    who: "Rede de farmácias · 4 unidades · PR",
    issue: "Classe tarifária errada em 2 unidades",
    months: 37,
    paid: 17_900,
  },
];

const CHECKS = ["Leitura e consumo fora do padrão", "Classe e modalidade tarifária", "Energia reativa", "Demanda contratada e ultrapassagem", "Créditos de energia solar"];

const STEPS = [
  { time: "15 segundos", title: "Deixe seu contato", text: "Nome, e-mail e WhatsApp." },
  { time: "30 segundos", title: "Envie a fatura", text: "PDF ou foto pelo celular." },
  { time: "até 1 minuto", title: "Receba a auditoria", text: "Se houver cobrança indevida, cuidamos do pedido de devolução." },
];

/** Na landing, só as dúvidas que antecedem o envio da fatura (a IA conhece todas). */
const FAQ_HOME = FAQ.filter((f) => !/Mercado Livre|solar por assinatura/i.test(f.q));

const brl = (n: number) => n.toLocaleString("pt-BR");

export default function HomePage() {
  return (
    <>
      {/* ================= HERO ================= */}
      <section id="analisar" className="relative scroll-mt-16 overflow-hidden bg-ink text-white">
        <div className="glow absolute inset-0" />
        <DotPattern className="[mask-image:radial-gradient(700px_circle_at_25%_30%,white,transparent)]" />
        <div className="relative mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-10 px-4 pb-14 pt-8 sm:px-6 md:pt-14 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)] lg:gap-12 lg:pb-20">
          <div className="flex min-w-0 flex-col justify-center">
            <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-volt/30 bg-volt/10 px-3.5 py-1.5 text-xs font-semibold">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-volt opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-volt" />
              </span>
              <AnimatedShinyText className="text-white/90">Auditoria gratuita · resultado em 1 minuto</AnimatedShinyText>
            </div>
            <HeroHeadline />
            <p className="rise-in mt-6 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg" style={{ animationDelay: "0.55s" }}>
              Erro de leitura, tarifa errada, multa indevida. A auditoria gratuita encontra — e buscamos a devolução de{" "}
              <strong className="font-semibold text-white">até 60 faturas</strong>.
            </p>
            <ul className="rise-in mt-7 grid grid-cols-2 gap-x-3 gap-y-3 text-[13.5px] font-medium text-white sm:text-[15px]" style={{ animationDelay: "0.7s" }}>
              {["100% gratuita", "Sem ação judicial", "Sem trocar de fornecedor", "Especialistas do setor elétrico"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-volt text-ink">
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <BlurFade delay={0.15}>
            <LeadMagnetForm />
          </BlurFade>
        </div>

        <div className="relative border-t border-white/10 bg-white/[0.02] py-5">
          <p className="mb-3 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-white/60">Auditamos faturas das principais distribuidoras do país</p>
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

      {/* ================= EXEMPLOS DE RESSARCIMENTO ================= */}
      <section id="exemplos" className="scroll-mt-16 bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <BlurFade className="max-w-3xl">
            <Eyebrow>O que uma auditoria encontra</Eyebrow>
            <h2 className="mt-3 text-[32px] font-bold leading-[1.1] tracking-[-0.03em] sm:text-5xl">Ninguém confere a conta de luz. É aí que o dinheiro some.</h2>
          </BlurFade>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {CASES.map(({ icon: Icon, who, issue, months, paid }, i) => (
              <BlurFade key={who} delay={0.06 * i}>
                <article className="flex h-full flex-col rounded-3xl border border-border bg-background p-6 shadow-[0_20px_50px_-30px_rgba(7,11,22,0.35)]">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-ink text-volt">
                      <Icon className="size-5" />
                    </span>
                    <p className="text-sm font-semibold text-muted">{who}</p>
                  </div>
                  <p className="mt-5 text-lg font-bold leading-snug tracking-tight">{issue}</p>
                  <dl className="mt-6 space-y-2 border-t border-border pt-5 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">Faturas afetadas</dt>
                      <dd className="font-semibold tabular">{months}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">Cobrado a mais</dt>
                      <dd className="font-semibold tabular">R$ {brl(paid)}</dd>
                    </div>
                  </dl>
                  <div className="mt-auto pt-5">
                    <div className="rounded-2xl bg-ink px-4 py-3.5 text-white">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">Devolução possível (em dobro)</p>
                      <p className="mt-0.5 text-[28px] font-bold tracking-tight text-volt tabular">
                        R$ <NumberTicker value={paid * 2} />
                      </p>
                    </div>
                  </div>
                </article>
              </BlurFade>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted">Exemplos ilustrativos com valores fictícios. O resultado real depende da comprovação de cada caso.</p>

          <BlurFade>
            <div className="mt-10 flex flex-wrap items-center gap-2">
              <span className="mr-1 text-sm font-semibold">A auditoria verifica:</span>
              {CHECKS.map((c) => (
                <span key={c} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 text-[13px] font-medium">
                  <CheckCircle2 className="size-3.5 text-primary" /> {c}
                </span>
              ))}
            </div>
          </BlurFade>
        </div>
      </section>

      {/* ================= BASE LEGAL ================= */}
      <section id="recuperacao" className="relative scroll-mt-16 overflow-hidden bg-ink py-20 text-white sm:py-24">
        <div className="glow absolute inset-0 opacity-70" />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <BlurFade className="max-w-3xl">
            <Eyebrow className="text-volt">A lei está do seu lado</Eyebrow>
            <h2 className="mt-3 text-[32px] font-bold leading-[1.1] tracking-[-0.03em] sm:text-5xl">
              Pagou a mais? Você tem direito de receber <span className="text-volt">em dobro</span>.
            </h2>
            <p className="mt-4 max-w-2xl text-base text-white/80 sm:text-lg">Direto com a distribuidora, sem ação judicial. Nós cuidamos de tudo.</p>
          </BlurFade>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              { icon: Scale, tag: "CDC · art. 42, parágrafo único", t: "Devolução em dobro", d: "Com correção e juros, salvo engano justificável." },
              { icon: Landmark, tag: "REN ANEEL 1.000/2021", t: "Regra da distribuidora", d: "Regula o faturamento e a devolução de valores cobrados a maior." },
              { icon: CalendarClock, tag: "Até 5 anos", t: "60 faturas para trás", d: "Prazo usado como referência pela Justiça." },
            ].map(({ icon: Icon, tag, t, d }, i) => (
              <BlurFade key={t} delay={0.06 * i}>
                <div className="h-full rounded-2xl border border-white/10 bg-white/[0.04] p-6 transition-colors hover:border-volt/50">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-volt text-ink">
                    <Icon className="size-5" />
                  </span>
                  <p className="mt-5 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-volt">{tag}</p>
                  <h3 className="mt-1.5 text-xl font-bold tracking-tight">{t}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/75">{d}</p>
                </div>
              </BlurFade>
            ))}
          </div>

          <BlurFade>
            <div className="mt-10 flex flex-col gap-6 rounded-3xl bg-white p-6 text-ink sm:p-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-xl">
                <h3 className="text-2xl font-bold tracking-tight sm:text-3xl">Começa com uma auditoria grátis. Continua com gestão completa.</h3>
                <p className="mt-2 text-[15px] text-muted">Profissionais do setor elétrico cuidando da sua energia, de forma simples e digital.</p>
              </div>
              <Link href="#analisar" className="inline-flex h-13 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-[15px] font-bold text-white hover:bg-primary-hover">
                AUDITAR MINHA FATURA <ArrowRight className="size-4" />
              </Link>
            </div>
          </BlurFade>
        </div>
      </section>

      {/* ================= COMO FUNCIONA ================= */}
      <section id="como-funciona" className="scroll-mt-16 bg-white py-20 sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr]">
          <BlurFade className="lg:sticky lg:top-28 lg:self-start">
            <Eyebrow>Como funciona</Eyebrow>
            <h2 className="mt-3 text-[32px] font-bold leading-[1.1] tracking-[-0.03em] sm:text-5xl">3 passos. Menos de 2 minutos.</h2>
            <Link href="#analisar" className="pulse-ring mt-8 inline-flex h-13 items-center gap-2 rounded-xl bg-primary px-6 text-[15px] font-bold text-white hover:bg-primary-hover">
              QUERO MINHA AUDITORIA GRÁTIS <ArrowRight className="size-4" />
            </Link>
          </BlurFade>
          <ScrollTimeline steps={STEPS} />
        </div>
      </section>

      {/* ================= FAQ ================= */}
      <section id="faq" className="scroll-mt-16 bg-background py-20 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <Eyebrow className="text-center">Perguntas frequentes</Eyebrow>
          <h2 className="mt-3 text-center text-[32px] font-bold tracking-[-0.03em] sm:text-4xl">Antes de enviar sua fatura</h2>
          <div className="mt-10 space-y-3">
            {FAQ_HOME.map((f) => (
              <details key={f.q} className="group rounded-2xl border border-border bg-white px-5 py-4 transition-shadow open:shadow-[0_10px_30px_-15px_rgba(7,11,22,0.25)] [&_summary::-webkit-details-marker]:hidden">
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
      <section className="bg-background px-4 pb-24 sm:px-6">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[32px] bg-ink px-6 py-16 text-center text-white sm:px-12 sm:py-20">
          <div className="glow absolute inset-0" />
          <DotPattern className="[mask-image:radial-gradient(500px_circle_at_50%_0%,white,transparent)]" />
          <Meteors number={16} />
          <div className="relative">
            <h2 className="mx-auto max-w-3xl text-[34px] font-bold leading-[1.08] tracking-[-0.035em] sm:text-6xl">
              Todo mês, uma fatura <span className="text-volt">sai do prazo</span> de devolução.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg text-white/75">Audite agora, enquanto os 5 anos ainda contam a seu favor.</p>
            <Link href="#analisar" className="mt-9 inline-flex h-14 items-center gap-2 rounded-2xl bg-white px-8 text-base font-bold text-ink shadow-[0_15px_40px_-10px_rgba(255,255,255,0.45)] transition-transform hover:-translate-y-0.5">
              AUDITAR MINHA FATURA GRÁTIS <ArrowRight className="size-5" />
            </Link>
            <div className="mt-7 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-medium text-white/80">
              {["Gratuito", "Sem compromisso", "Sem ação judicial", "Dados protegidos (LGPD)"].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-volt" /> {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <StickyCta />
    </>
  );
}
