import {
  Activity,
  ArrowRight,
  Bot,
  CheckCircle2,
  FileSearch,
  Gauge,
  Lock,
  MessageCircle,
  Receipt,
  ShieldCheck,
  Sun,
  TrendingUp,
  UploadCloud,
  UserCheck,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { OpenChatButton } from "@/components/chat/open-chat-button";
import { LeadMagnetForm } from "@/components/forms/lead-magnet-form";
import { AnimatedShinyText } from "@/components/magicui/animated-shiny-text";
import { BentoCard, BentoGrid } from "@/components/magicui/bento-grid";
import { BlurFade } from "@/components/magicui/blur-fade";
import { DotPattern } from "@/components/magicui/dot-pattern";
import { Marquee } from "@/components/magicui/marquee";
import { NumberTicker } from "@/components/magicui/number-ticker";
import { StickyCta } from "@/components/site/sticky-cta";
import { Badge, Eyebrow } from "@/components/ui/card";
import { FAQ } from "@/content/faq";
import { TESTIMONIALS } from "@/content/social-proof";
import { cn } from "@/lib/utils";
import { DISTRIBUTORS } from "@/modules/invoice/distributors";
import { visibleSolutions } from "@/modules/leads/solutions";

const DISTRIBUTOR_NAMES = [...new Set(DISTRIBUTORS.filter((d) => d.states.length).map((d) => d.name))].slice(0, 24);

const STEPS = [
  { icon: UserCheck, title: "Deixe seu contato", text: "Nome, e-mail e WhatsApp. Leva 15 segundos." },
  { icon: UploadCloud, title: "Envie a fatura", text: "PDF da distribuidora ou foto pelo celular." },
  { icon: FileSearch, title: "Receba o Raio-X", text: "Pontos de atenção, oportunidades e faixa de economia estimada." },
];

export default function HomePage() {
  const solutions = visibleSolutions();
  return (
    <>
      {/* ================= HERO ================= */}
      <section id="analisar" className="relative scroll-mt-16 overflow-hidden bg-ink text-white">
        <div className="glow absolute inset-0" />
        <DotPattern className="[mask-image:radial-gradient(600px_circle_at_30%_30%,white,transparent)]" />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-8 sm:px-6 md:pt-14 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:pb-24">
          <div className="flex flex-col justify-center">
            <BlurFade>
              <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium">
                <span className="size-1.5 rounded-full bg-opportunity" />
                <AnimatedShinyText>Análise gratuita · resultado em cerca de 1 minuto</AnimatedShinyText>
              </div>
            </BlurFade>
            <BlurFade delay={0.05}>
              <h1 className="text-[34px] font-semibold leading-[1.07] tracking-tight sm:text-5xl lg:text-[56px]">
                Sua empresa sabe exatamente quanto <span className="bg-gradient-to-r from-cyan to-[#8ea2ff] bg-clip-text text-transparent">deveria</span> estar pagando pela
                energia?
              </h1>
            </BlurFade>
            <BlurFade delay={0.1}>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg">
                Envie sua fatura e descubra oportunidades de redução de custos, possíveis inconsistências de faturamento e quais soluções de energia podem fazer
                sentido para sua empresa.
              </p>
            </BlurFade>
            <BlurFade delay={0.15}>
              <ul className="mt-7 grid gap-2.5 text-sm text-white/80 sm:grid-cols-2">
                {["100% gratuito, sem compromisso", "Sem trocar de fornecedor", "Sem instalar placas", "Dúvidas? Atendimento com IA 24h"].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-cyan" /> {t}
                  </li>
                ))}
              </ul>
            </BlurFade>
            <BlurFade delay={0.2} className="mt-8 hidden flex-wrap items-center gap-4 lg:flex">
              <Link href="/gd-por-assinatura" className="inline-flex h-12 items-center rounded-xl border border-white/15 bg-white/5 px-5 text-sm font-semibold hover:bg-white/10">
                SIMULAR ECONOMIA
              </Link>
              <OpenChatButton className="text-sm font-medium text-white/70 hover:text-white" />
            </BlurFade>
          </div>
          <BlurFade delay={0.1}>
            <LeadMagnetForm />
            <div className="mt-3 flex items-center justify-between gap-3 lg:hidden">
              <Link href="/gd-por-assinatura" className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-sm font-semibold">
                SIMULAR ECONOMIA
              </Link>
              <OpenChatButton className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-sm font-semibold" label="Falar com a IA" />
            </div>
          </BlurFade>
        </div>

        {/* Distribuidoras */}
        <div className="relative border-t border-white/5 pb-6 pt-5">
          <p className="mb-2 text-center text-[11px] font-medium uppercase tracking-[0.2em] text-white/40">Lemos faturas das principais distribuidoras do país</p>
          <div className="relative">
            <Marquee className="[--duration:55s]">
              {DISTRIBUTOR_NAMES.map((n) => (
                <span key={n} className="whitespace-nowrap text-sm font-semibold text-white/35">
                  {n}
                </span>
              ))}
            </Marquee>
            <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-ink" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-ink" />
          </div>
        </div>
      </section>

      {/* ================= NÚMEROS ================= */}
      <section className="border-b border-border bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 sm:px-6 md:grid-cols-4">
          {[
            { n: 8, s: "", label: "verificações técnicas por fatura" },
            { n: 60, s: "s", label: "para gerar o Raio-X (típico)", prefix: "até " },
            { n: 0, s: "", label: "custo da análise preliminar", prefix: "R$ " },
            { n: 24, s: "h", label: "atendimento com IA" },
          ].map((k) => (
            <div key={k.label} className="text-center md:text-left">
              <p className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                {k.prefix && <span>{k.prefix}</span>}
                <NumberTicker value={k.n} />
                {k.s}
              </p>
              <p className="mt-1 text-sm text-muted">{k.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ================= COMO FUNCIONA ================= */}
      <section id="como-funciona" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-20 sm:px-6">
        <BlurFade className="mx-auto max-w-2xl text-center">
          <Eyebrow>Como funciona</Eyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">3 passos. Nenhuma burocracia.</h2>
        </BlurFade>
        <div className="relative mt-12 grid gap-5 md:grid-cols-3">
          <div className="absolute left-[16%] right-[16%] top-7 hidden h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent md:block" />
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <BlurFade key={title} delay={i * 0.08} className="relative flex flex-col items-center text-center">
              <span className="relative flex size-14 items-center justify-center rounded-2xl bg-ink text-cyan shadow-lg shadow-primary/20">
                <Icon className="size-6" />
                <span className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">{i + 1}</span>
              </span>
              <p className="mt-5 text-lg font-semibold">{title}</p>
              <p className="mt-1.5 max-w-xs text-sm text-muted">{text}</p>
            </BlurFade>
          ))}
        </div>
        <div className="mt-10 flex justify-center">
          <Link href="#analisar" className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-white shadow-lg shadow-primary/30 hover:bg-primary-hover">
            COMEÇAR MINHA ANÁLISE GRÁTIS <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      {/* ================= O QUE ANALISAMOS (BENTO) ================= */}
      <section className="bg-subtle/50 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <BlurFade className="max-w-2xl">
            <Eyebrow>Auditoria de fatura</Eyebrow>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Sua conta de energia pode esconder oportunidades de economia.</h2>
            <p className="mt-4 text-muted">Verificamos os pontos que mais pesam na conta de empresas — com regras técnicas auditáveis, não com “achismo”.</p>
          </BlurFade>
          <BentoGrid className="mt-10 md:auto-rows-[14rem]">
            <BentoCard
              className="md:col-span-2"
              Icon={Gauge}
              name="Demanda contratada e ultrapassagens"
              description="Comparamos demanda contratada, medida e faturada. Ultrapassagem acima da tolerância de 5% é cobrada com tarifa mais cara — e sobra constante também custa."
              background={<DemandViz />}
            />
            <BentoCard Icon={Activity} name="Energia reativa" description="Fator de potência abaixo da referência e cobranças de excedente reativo." />
            <BentoCard Icon={Receipt} name="Estrutura tarifária" description="Modalidade Verde, Azul ou convencional: sinalizamos quando vale comparar." />
            <BentoCard Icon={TrendingUp} name="Variações anormais" description="Consumo fora do padrão histórico que merece confirmação." />
            <BentoCard Icon={Sun} name="Créditos e compensação" description="Leitura dos créditos de geração distribuída e do saldo acumulado." />
            <BentoCard
              className="md:col-span-3"
              Icon={Zap}
              name="GD por assinatura e Mercado Livre"
              description="Além dos pontos de atenção, indicamos se o perfil da sua empresa é compatível com energia por assinatura (sem instalar placas) ou com o Mercado Livre — com faixa de economia estimada, sujeita à validação."
            />
          </BentoGrid>
        </div>
      </section>

      {/* ================= RAIO-X PREVIEW ================= */}
      <section className="relative overflow-hidden bg-ink py-20 text-white">
        <div className="glow absolute inset-0" />
        <DotPattern className="[mask-image:radial-gradient(500px_circle_at_80%_50%,white,transparent)]" />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <BlurFade>
            <Eyebrow className="text-cyan">O que você recebe</Eyebrow>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Um Raio-X claro, com dados e nível de confiança.</h2>
            <p className="mt-4 text-white/65">
              Cada ponto mostra o título, a explicação em linguagem simples, os dados usados da sua fatura e o nível de confiança. Nada de promessas: estimativas em faixa,
              sujeitas à validação técnica.
            </p>
            <div className="mt-8 grid gap-3 text-sm">
              {[
                { c: "bg-attention", t: "Ponto de atenção", d: "algo na cobrança que merece verificação" },
                { c: "bg-analysis", t: "Análise recomendada", d: "vale comparar alternativas com o histórico" },
                { c: "bg-opportunity", t: "Oportunidade", d: "solução com perfil compatível para avaliar" },
              ].map((x) => (
                <div key={x.t} className="flex items-center gap-3">
                  <span className={cn("size-2.5 rounded-full", x.c)} />
                  <span className="font-semibold">{x.t}</span>
                  <span className="text-white/50">— {x.d}</span>
                </div>
              ))}
            </div>
            <Link href="#analisar" className="mt-9 inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold shadow-lg shadow-primary/30 hover:bg-primary-hover">
              QUERO MEU RAIO-X <ArrowRight className="size-4" />
            </Link>
          </BlurFade>
          <BlurFade delay={0.1}>
            <RaioXPreview />
          </BlurFade>
        </div>
      </section>

      {/* ================= ANTES x DEPOIS ================= */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <BlurFade className="mx-auto max-w-2xl text-center">
          <Eyebrow>Por que fazer agora</Eyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Energia é custo fixo. Olhar a fatura não deveria ser.</h2>
        </BlurFade>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <div className="rounded-3xl border border-border bg-white p-7">
            <p className="text-sm font-semibold uppercase tracking-wider text-muted">Sem análise</p>
            <ul className="mt-5 space-y-3 text-sm">
              {["Paga a conta sem saber se o contrato de demanda está adequado", "Cobranças de reativo passam despercebidas mês a mês", "Não sabe se energia por assinatura ou Mercado Livre fazem sentido", "Decisões baseadas em propostas de vendedores"].map((t) => (
                <li key={t} className="flex gap-2.5 text-foreground/75">
                  <X className="mt-0.5 size-4 shrink-0 text-attention" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary-soft to-white p-7">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary">Com o Raio-X</p>
            <ul className="mt-5 space-y-3 text-sm">
              {["Pontos de atenção identificados com dados da própria fatura", "Faixa de economia estimada para cada oportunidade", "Visão independente das soluções que fazem sentido", "Especialista disponível só se você quiser avançar"].map((t) => (
                <li key={t} className="flex gap-2.5">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-opportunity" /> {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ================= SOLUÇÕES ================= */}
      <section className="bg-subtle/50 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <BlurFade className="max-w-2xl">
            <Eyebrow>Soluções</Eyebrow>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Um diagnóstico, as soluções que fazem sentido para o seu perfil.</h2>
          </BlurFade>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {solutions.map((s, i) => (
              <BlurFade key={s.code} delay={i * 0.06}>
                <Link
                  href={s.href}
                  className="group flex h-full flex-col rounded-2xl border border-border bg-white p-6 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5"
                >
                  <p className="text-lg font-semibold">{s.title}</p>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{s.description}</p>
                  <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                    {s.code === "auditoria" ? "Analisar minha fatura" : s.code === "gd_assinatura" ? "Simular economia" : "Analisar perfil"}
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </BlurFade>
            ))}
          </div>
        </div>
      </section>

      {TESTIMONIALS.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="grid gap-5 md:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <figure key={t.author} className="rounded-2xl border border-border bg-white p-6">
                <blockquote className="text-sm leading-relaxed">“{t.quote}”</blockquote>
                <figcaption className="mt-4 text-xs text-muted">
                  <strong className="text-foreground">{t.author}</strong> · {t.role}, {t.company}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* ================= ATENDIMENTO COM IA ================= */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-white p-7 sm:p-10">
          <DotPattern className="fill-primary/10 [mask-image:radial-gradient(400px_circle_at_90%_20%,white,transparent)]" />
          <div className="relative grid gap-8 md:grid-cols-[1.2fr_1fr] md:items-center">
            <div>
              <Badge tone="primary">
                <Bot className="size-3" /> Atendimento com IA
              </Badge>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">Ficou com dúvida? Pergunte agora — a resposta vem na hora.</h2>
              <p className="mt-3 text-muted">
                Nossa assistente explica como funciona a análise, GD por assinatura, Mercado Livre e o seu Raio-X. Quando fizer sentido, ela chama um especialista
                humano pelo WhatsApp.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <OpenChatButton className="inline-flex h-12 items-center gap-2 rounded-xl bg-ink px-5 text-sm font-semibold text-white hover:bg-ink-3" label="Conversar com a IA" />
                <Link href="#analisar" className="inline-flex h-12 items-center rounded-xl border border-border px-5 text-sm font-semibold hover:bg-subtle">
                  Enviar fatura
                </Link>
              </div>
            </div>
            <div className="space-y-2.5 text-sm">
              {["É realmente gratuito?", "Preciso instalar placas?", "Minha empresa pode ir para o Mercado Livre?"].map((q, i) => (
                <div key={q} className={cn("w-fit max-w-[90%] rounded-2xl px-4 py-2.5", i % 2 ? "ml-auto bg-primary text-white" : "bg-subtle")}>
                  {q}
                </div>
              ))}
              <div className="flex w-fit items-center gap-2 rounded-2xl bg-subtle px-4 py-2.5 text-muted">
                <MessageCircle className="size-4" /> respondendo…
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= SEGURANÇA / LGPD ================= */}
      <section className="border-y border-border bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-3">
          <div>
            <Lock className="size-6 text-primary" />
            <p className="mt-4 font-semibold">Segurança do documento</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">Transmissão criptografada, armazenamento privado e acesso restrito à equipe responsável. O arquivo nunca fica público.</p>
          </div>
          <div>
            <ShieldCheck className="size-6 text-primary" />
            <p className="mt-4 font-semibold">LGPD de verdade</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Consentimento registrado, uso restrito à análise e ao contato autorizado, e canal para acessar ou excluir seus dados.{" "}
              <Link href="/privacidade/solicitacao" className="font-medium text-primary hover:underline">
                Exercer meus direitos
              </Link>
              .
            </p>
          </div>
          <div>
            <FileSearch className="size-6 text-primary" />
            <p className="mt-4 font-semibold">Diagnóstico preliminar</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">O resultado indica pontos de atenção e oportunidades com nível de confiança. Nenhuma conclusão é definitiva sem validação técnica.</p>
          </div>
        </div>
      </section>

      {/* ================= FAQ ================= */}
      <section id="faq" className="mx-auto max-w-3xl scroll-mt-16 px-4 py-20 sm:px-6">
        <Eyebrow className="text-center">Perguntas frequentes</Eyebrow>
        <h2 className="mt-3 text-center text-3xl font-semibold tracking-tight">Tudo o que você precisa saber</h2>
        <div className="mt-10 divide-y divide-border rounded-2xl border border-border bg-white">
          {FAQ.map((f) => (
            <details key={f.q} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                {f.q}
                <span className="text-xl leading-none text-muted transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted">{f.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-6 text-center text-sm text-muted">
          Não achou sua dúvida? <OpenChatButton className="font-semibold text-primary hover:underline" label="Pergunte à nossa IA" />
        </p>
      </section>

      {/* ================= CTA FINAL ================= */}
      <section className="px-4 pb-24 sm:px-6">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-ink px-6 py-14 text-center text-white sm:px-12">
          <div className="glow absolute inset-0 opacity-80" />
          <DotPattern className="[mask-image:radial-gradient(500px_circle_at_50%_0%,white,transparent)]" />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">Descubra o que a sua conta de energia está dizendo.</h2>
            <p className="mx-auto mt-4 max-w-xl text-white/65">Deixe seu contato, envie a fatura e receba o Raio-X preliminar em cerca de um minuto. Gratuito e sem compromisso.</p>
            <Link href="#analisar" className="mt-8 inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-7 text-sm font-semibold shadow-lg shadow-primary/40 hover:bg-primary-hover">
              ENVIAR MINHA FATURA <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      <StickyCta />
    </>
  );
}

function DemandViz() {
  const bars = [62, 70, 66, 74, 81, 108, 72, 69, 77, 112, 70, 64];
  return (
    <div className="absolute right-4 top-6 hidden h-24 w-[46%] items-end gap-1.5 opacity-80 transition-opacity group-hover:opacity-100 md:flex">
      <div className="absolute inset-x-0 border-t border-dashed border-attention/60" style={{ bottom: "74%" }} />
      {bars.map((b, i) => (
        <div key={i} className={cn("flex-1 rounded-t", b > 100 ? "bg-attention" : "bg-primary/25")} style={{ height: `${(b / 115) * 100}%` }} />
      ))}
    </div>
  );
}

function RaioXPreview() {
  return (
    <div className="relative">
      <div className="absolute -inset-4 rounded-[28px] bg-primary/20 blur-2xl" />
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-ink-2 p-5 shadow-2xl sm:p-6">
        <div className="flex items-center justify-between">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/50">Raio-X da sua energia</p>
          <Badge tone="dark">Exemplo ilustrativo</Badge>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            ["Valor da fatura", "R$ 48.732"],
            ["Consumo", "57.120 kWh"],
            ["Perfil", "Grupo A"],
            ["Oportunidades", "2"],
            ["Pontos de atenção", "2"],
            ["Soluções", "ML · GD"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
              <p className="text-[11px] text-white/45">{k}</p>
              <p className="mt-1 font-semibold tabular">{v}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-2.5">
          {[
            { tone: "bg-attention", label: "Ponto de atenção", title: "Possível ultrapassagem de demanda" },
            { tone: "bg-analysis", label: "Análise recomendada", title: "Revisão da estrutura tarifária" },
            { tone: "bg-opportunity", label: "Oportunidade", title: "Perfil para avaliação de Mercado Livre" },
          ].map((c) => (
            <div key={c.title} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3.5 py-3">
              <span className={cn("size-2.5 shrink-0 rounded-full", c.tone)} />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{c.label}</p>
                <p className="truncate text-sm font-medium">{c.title}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
