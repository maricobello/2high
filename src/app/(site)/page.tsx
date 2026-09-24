import { ArrowRight, BadgeCheck, CheckCircle2, Factory, FileSearch, Handshake, Landmark, Receipt, Scale, Store, TrendingDown, Wallet } from "lucide-react";
import Link from "next/link";
import { OpenChatButton } from "@/components/chat/open-chat-button";
import { QuizFunnel } from "@/components/forms/quiz-funnel";
import { BlurFade } from "@/components/magicui/blur-fade";
import { DotPattern } from "@/components/magicui/dot-pattern";
import { Marquee } from "@/components/magicui/marquee";
import { Meteors } from "@/components/magicui/meteors";
import { NumberTicker } from "@/components/magicui/number-ticker";
import { HeroHeadline } from "@/components/site/hero-headline";
import { StickyCta } from "@/components/site/sticky-cta";
import { Eyebrow } from "@/components/ui/card";
import { FAQ } from "@/content/faq";
import { successFeeText } from "@/lib/brand";
import { DISTRIBUTORS } from "@/modules/invoice/distributors";

const DISTRIBUTOR_NAMES = [...new Set(DISTRIBUTORS.filter((d) => d.states.length).map((d) => d.name))];

/** Casos ILUSTRATIVOS (valores fictícios) — sinalizados como tal na página. */
const CASES = [
  { icon: Store, who: "Padaria · Grupo B · SP", issue: "Leitura estimada por 14 meses seguidos", rows: [["Faturas afetadas", "14"], ["Cobrado a mais", "R$ 6.240"]], label: "Devolução possível (em dobro)", value: 12_480 },
  { icon: Factory, who: "Metalúrgica · Grupo A · MG", issue: "Multa de reativo com fator de potência acima de 0,92", rows: [["Faturas afetadas", "22"], ["Cobrado a mais", "R$ 21.300"]], label: "Devolução possível (em dobro)", value: 42_600 },
  { icon: Factory, who: "Indústria de alimentos · SC", issue: "ICMS da energia da produção nunca aproveitado como crédito", rows: [["Período revisado", "60 meses"], ["Energia na produção (laudo)", "78%"]], label: "Crédito de ICMS possível", value: 186_400 },
] as const;

const FRONTS = [
  {
    icon: Receipt,
    tag: "CDC art. 42 · REN ANEEL 1.000/2021",
    title: "Cobranças indevidas na fatura",
    text: "Leitura estimada, classe ou tarifa errada, multas indevidas. O que foi pago a mais pode voltar em dobro, das últimas 60 faturas.",
  },
  {
    icon: Landmark,
    tag: "LC 87/96 art. 33 · Súmula 391 STJ",
    title: "ICMS pago a mais",
    text: "Indústrias podem transformar em crédito o ICMS da energia usada na produção (com laudo técnico). E no Grupo A, ICMS só incide sobre a demanda realmente usada.",
  },
  {
    icon: TrendingDown,
    tag: "Daqui para frente",
    title: "Conta menor todo mês",
    text: "Demanda contratada certa, sem multa de reativo, energia por assinatura ou Mercado Livre — o que fizer sentido para o seu perfil.",
  },
];

/** Na landing, só as dúvidas que antecedem o diagnóstico (a IA conhece todas). */
const FAQ_HOME = FAQ.filter((f) => !/Mercado Livre|solar por assinatura|instalar placas/i.test(f.q));

export default function HomePage() {
  return (
    <>
      {/* ================= HERO = QUIZ ================= */}
      <section id="analisar" className="relative scroll-mt-16 overflow-hidden bg-ink text-white">
        <div className="glow absolute inset-0" />
        <DotPattern className="[mask-image:radial-gradient(700px_circle_at_25%_30%,white,transparent)]" />
        <div className="relative mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-7 px-4 pb-14 pt-6 sm:px-6 md:pt-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-12 lg:pb-20">
          <div className="flex min-w-0 flex-col justify-center">
            <HeroHeadline />
            <p className="rise-in mt-5 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg" style={{ animationDelay: "0.5s" }}>
              Auditamos suas últimas 60 faturas, buscamos a devolução do que foi cobrado a mais e fazemos a gestão da sua energia daqui para frente.
            </p>
            <ul className="rise-in mt-6 hidden gap-3 text-[15px] font-medium text-white lg:grid" style={{ animationDelay: "0.65s" }}>
              {["Auditoria gratuita das últimas 60 faturas", "Gestão mensal de demanda, tarifa, contratos e ICMS", "Sem custo inicial e sem ação judicial"].map((t) => (
                <li key={t} className="flex items-center gap-2.5">
                  <CheckCircle2 className="size-5 shrink-0 text-volt" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <BlurFade delay={0.1}>
            <QuizFunnel />
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

      {/* ================= RISCO ZERO (modelo de êxito) ================= */}
      <section id="como-funciona" className="scroll-mt-16 bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <BlurFade className="max-w-3xl">
            <Eyebrow>Risco zero</Eyebrow>
            <h2 className="mt-3 text-[32px] font-bold leading-[1.1] tracking-[-0.03em] sm:text-5xl">Você não paga para descobrir. Só paga se o dinheiro voltar.</h2>
          </BlurFade>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {[
              { icon: FileSearch, n: "1", t: "Auditamos de graça", d: "Revisamos até 60 faturas e mostramos o que encontramos. Sem compromisso." },
              { icon: Handshake, n: "2", t: "Fazemos tudo por você", d: "Pedido na distribuidora, laudos técnicos e acompanhamento. Você não perde tempo." },
              { icon: Wallet, n: "3", t: "O dinheiro volta", d: `Só então ${successFeeText()}. Não recuperou? Não paga nada.` },
            ].map(({ icon: Icon, n, t, d }, i) => (
              <BlurFade key={t} delay={0.06 * i}>
                <div className="relative h-full rounded-3xl border border-border bg-background p-6">
                  <span className="absolute right-5 top-4 text-6xl font-bold tracking-tighter text-border">{n}</span>
                  <span className="flex size-11 items-center justify-center rounded-xl bg-ink text-volt">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-5 text-xl font-bold tracking-tight">{t}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{d}</p>
                </div>
              </BlurFade>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-2">
            {["Sem mensalidade", "Sem custo inicial", "Sem ação judicial", "Sem trocar de fornecedor", "Especialistas do setor elétrico"].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5 rounded-full bg-subtle px-3 py-1.5 text-[13px] font-semibold">
                <BadgeCheck className="size-4 text-primary" /> {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ================= ONDE ESTÁ O DINHEIRO ================= */}
      <section className="relative overflow-hidden bg-ink py-20 text-white sm:py-24">
        <div className="glow absolute inset-0 opacity-70" />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <BlurFade className="max-w-3xl">
            <Eyebrow className="text-volt">Dinheiro na mesa</Eyebrow>
            <h2 className="mt-3 text-[32px] font-bold leading-[1.1] tracking-[-0.03em] sm:text-5xl">
              3 lugares onde sua empresa pode estar <span className="text-volt">perdendo dinheiro</span> agora.
            </h2>
          </BlurFade>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {FRONTS.map(({ icon: Icon, tag, title, text }, i) => (
              <BlurFade key={title} delay={0.06 * i}>
                <div className="h-full rounded-2xl border border-white/10 bg-white/[0.04] p-6 transition-colors hover:border-volt/50">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-volt text-ink">
                    <Icon className="size-5" />
                  </span>
                  <p className="mt-5 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-volt">{tag}</p>
                  <h3 className="mt-1.5 text-xl font-bold tracking-tight">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/75">{text}</p>
                </div>
              </BlurFade>
            ))}
          </div>
          <p className="mt-6 flex items-center gap-2 text-sm text-white/70">
            <Scale className="size-4 shrink-0 text-volt" /> Direto com a distribuidora e o fisco, pelas vias administrativas. Todo mês, uma fatura sai do prazo de 5 anos.
          </p>
        </div>
      </section>

      {/* ================= EXEMPLOS ================= */}
      <section id="exemplos" className="scroll-mt-16 bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <BlurFade className="max-w-3xl">
            <Eyebrow>Exemplos</Eyebrow>
            <h2 className="mt-3 text-[32px] font-bold leading-[1.1] tracking-[-0.03em] sm:text-5xl">Ninguém confere a conta de luz. É aí que o dinheiro some.</h2>
          </BlurFade>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {CASES.map(({ icon: Icon, who, issue, rows, label, value }, i) => (
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
                    {rows.map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-3">
                        <dt className="text-muted">{k}</dt>
                        <dd className="font-semibold tabular">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-auto pt-5">
                    <div className="rounded-2xl bg-ink px-4 py-3.5 text-white">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">{label}</p>
                      <p className="mt-0.5 text-[28px] font-bold tracking-tight text-volt tabular">
                        R$ <NumberTicker value={value} />
                      </p>
                    </div>
                  </div>
                </article>
              </BlurFade>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted">Exemplos ilustrativos com valores fictícios. O resultado real depende da comprovação e da análise de cada caso.</p>
          <div className="mt-10">
            <Link href="#analisar" className="pulse-ring inline-flex h-13 items-center gap-2 rounded-xl bg-primary px-6 text-[15px] font-bold text-white hover:bg-primary-hover">
              FAZER MEU DIAGNÓSTICO GRÁTIS <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ================= FAQ ================= */}
      <section id="faq" className="scroll-mt-16 bg-background py-20 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <Eyebrow className="text-center">Perguntas frequentes</Eyebrow>
          <h2 className="mt-3 text-center text-[32px] font-bold tracking-[-0.03em] sm:text-4xl">Sem letras miúdas</h2>
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
              O pior cenário: você descobre que <span className="text-volt">está tudo certo.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg text-white/75">30 segundos, sem custo e sem compromisso. E, se tiver dinheiro seu na conta, a gente busca.</p>
            <Link href="#analisar" className="mt-9 inline-flex h-14 items-center gap-2 rounded-2xl bg-white px-8 text-base font-bold text-ink shadow-[0_15px_40px_-10px_rgba(255,255,255,0.45)] transition-transform hover:-translate-y-0.5">
              FAZER MEU DIAGNÓSTICO GRÁTIS <ArrowRight className="size-5" />
            </Link>
          </div>
        </div>
      </section>

      <StickyCta />
    </>
  );
}
