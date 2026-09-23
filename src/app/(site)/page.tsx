import {
  Activity,
  ArrowRight,
  Bot,
  Building2,
  Check,
  CheckCircle2,
  Factory,
  FileSearch,
  Gauge,
  HeartPulse,
  Lock,
  Minus,
  Receipt,
  ShieldCheck,
  ShoppingBag,
  Store,
  Sun,
  Tractor,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { OpenChatButton } from "@/components/chat/open-chat-button";
import { LeadMagnetForm } from "@/components/forms/lead-magnet-form";
import { AnimatedShinyText } from "@/components/magicui/animated-shiny-text";
import { BlurFade } from "@/components/magicui/blur-fade";
import { DotPattern } from "@/components/magicui/dot-pattern";
import { Marquee } from "@/components/magicui/marquee";
import { Meteors } from "@/components/magicui/meteors";
import { NumberTicker } from "@/components/magicui/number-ticker";
import { SpotlightCard } from "@/components/magicui/spotlight-card";
import { ChatDemo } from "@/components/site/chat-demo";
import { DemandBars } from "@/components/site/demand-bars";
import { HeroHeadline } from "@/components/site/hero-headline";
import { PipelineBeam } from "@/components/site/pipeline-beam";
import { ScanDemo } from "@/components/site/scan-demo";
import { ScrollTimeline } from "@/components/site/scroll-timeline";
import { StickyCta } from "@/components/site/sticky-cta";
import { Eyebrow } from "@/components/ui/card";
import { FAQ } from "@/content/faq";
import { TESTIMONIALS } from "@/content/social-proof";
import { cn } from "@/lib/utils";
import { DISTRIBUTORS } from "@/modules/invoice/distributors";
import { visibleSolutions } from "@/modules/leads/solutions";

const DISTRIBUTOR_NAMES = [...new Set(DISTRIBUTORS.filter((d) => d.states.length).map((d) => d.name))];

const STEPS = [
  { time: "15 segundos", title: "Simule e deixe seu contato", text: "Arraste o valor da conta, veja a faixa estimada e informe nome, e-mail e WhatsApp." },
  { time: "30 segundos", title: "Envie a fatura", text: "PDF baixado da distribuidora ou foto pelo celular. O arquivo fica em ambiente privado." },
  { time: "até 1 minuto", title: "Receba o Raio-X", text: "Pontos de atenção, oportunidades com faixa de economia e as soluções que fazem sentido — com os dados usados e o nível de confiança." },
];

const SEGMENTS = [
  { icon: Factory, title: "Indústria", text: "Demanda contratada, ultrapassagens, reativos e modalidade horária pesam mais." },
  { icon: Store, title: "Comércio e varejo", text: "Contas em baixa tensão com bom perfil para energia por assinatura." },
  { icon: Tractor, title: "Agronegócio", text: "Irrigação, armazenagem e sazonalidade exigem olhar para o histórico." },
  { icon: HeartPulse, title: "Saúde e educação", text: "Operação contínua e climatização: consumo alto e previsível." },
  { icon: Building2, title: "Escritórios e serviços", text: "Várias unidades consumidoras e contratos que ninguém revisa há anos." },
  { icon: ShoppingBag, title: "Shoppings e condomínios", text: "Média tensão, áreas comuns e perfil para avaliar o Mercado Livre." },
];

const COMPARE: { item: string; us: boolean | string; self: boolean | string; seller: boolean | string }[] = [
  { item: "Custo para o cliente", us: "Gratuito", self: "Horas do seu time", seller: "Gratuito" },
  { item: "Tempo até o resultado", us: "Até 1 minuto", self: "Dias", seller: "Dias a semanas" },
  { item: "Lê a fatura inteira (demanda, reativos, tarifas)", us: true, self: "Parcial", seller: "Parcial" },
  { item: "Compara GD por assinatura e Mercado Livre", us: true, self: false, seller: "Só o que vende" },
  { item: "Mostra os dados usados e o nível de confiança", us: true, self: false, seller: false },
  { item: "Sem obrigação de trocar de fornecedor", us: true, self: true, seller: false },
];

export default function HomePage() {
  const solutions = visibleSolutions();
  return (
    <>
      {/* ================= HERO (above the fold) ================= */}
      <section id="analisar" className="relative scroll-mt-16 overflow-hidden bg-ink text-white">
        <div className="glow absolute inset-0" />
        <DotPattern className="[mask-image:radial-gradient(700px_circle_at_25%_30%,white,transparent)]" />
        <div className="relative mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-10 px-4 pb-14 pt-8 sm:px-6 md:pt-14 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)] lg:gap-12 lg:pb-20">
          <div className="flex min-w-0 flex-col justify-center">
            <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-xs font-semibold">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-opportunity opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-opportunity" />
              </span>
              <AnimatedShinyText className="text-white/85">Para empresas · Grupo A e Grupo B</AnimatedShinyText>
            </div>
            <HeroHeadline />
            <p className="rise-in mt-6 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg" style={{ animationDelay: "0.55s" }}>
              Envie sua fatura e descubra oportunidades de redução de custos, possíveis inconsistências de faturamento e quais soluções de energia podem fazer sentido
              para sua empresa.
            </p>
            <ul className="rise-in mt-7 grid grid-cols-2 gap-x-3 gap-y-3 text-[13.5px] sm:text-[15px] font-medium text-white sm:grid-cols-2" style={{ animationDelay: "0.7s" }}>
              {["100% gratuito, sem compromisso", "Sem trocar de fornecedor", "Sem instalar placas", "Atendimento com IA 24h"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-volt text-ink">
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
            <div className="rise-in mt-8 hidden flex-wrap items-center gap-2 sm:flex" style={{ animationDelay: "0.85s" }}>
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">Metodologia baseada em</span>
              {["REN ANEEL 1.000/2021", "Lei 14.300/2022", "LGPD"].map((b) => (
                <span key={b} className="rounded-md border border-white/15 bg-white/[0.04] px-2 py-1 font-mono text-[11px] text-white/85">
                  {b}
                </span>
              ))}
            </div>
            <div className="rise-in mt-8 hidden items-center gap-5 lg:flex" style={{ animationDelay: "1s" }}>
              <Link href="/gd-por-assinatura" className="inline-flex items-center gap-1.5 text-sm font-semibold text-white underline decoration-white/30 underline-offset-4 hover:decoration-white">
                Simular energia por assinatura <ArrowRight className="size-4" />
              </Link>
              <OpenChatButton className="text-sm font-semibold text-white/80 hover:text-white" />
            </div>
          </div>
          <BlurFade delay={0.15}>
            <LeadMagnetForm />
          </BlurFade>
        </div>

        {/* Faixa de distribuidoras (marquee) */}
        <div className="relative border-t border-white/10 bg-white/[0.02] py-5">
          <p className="mb-3 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-white/60">Lemos faturas das principais distribuidoras do país</p>
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

      {/* ================= NÚMEROS ================= */}
      <section className="border-b border-border bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-2 divide-border px-4 py-10 sm:px-6 md:grid-cols-4 md:divide-x">
          {[
            { n: 8, s: "", label: "verificações técnicas em cada fatura" },
            { n: 60, s: "s", label: "para gerar o Raio-X (típico)", prefix: "até " },
            { n: 0, s: "", label: "custo da análise preliminar", prefix: "R$ " },
            { n: 24, s: "h", label: "de atendimento com IA" },
          ].map((k) => (
            <div key={k.label} className="px-2 py-3 text-center md:px-6 md:text-left">
              <p className="text-4xl font-bold tracking-[-0.03em] text-foreground sm:text-5xl">
                {k.prefix && <span className="text-2xl sm:text-3xl">{k.prefix}</span>}
                <NumberTicker value={k.n} />
                {k.s}
              </p>
              <p className="mt-1.5 text-sm font-medium text-muted">{k.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ================= ONDE A CONTA PESA (bento + spotlight) ================= */}
      <section className="bg-background py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <BlurFade className="max-w-2xl">
            <Eyebrow>Auditoria de fatura</Eyebrow>
            <h2 className="mt-3 text-[32px] font-bold leading-[1.1] tracking-[-0.03em] sm:text-5xl">Sua conta de energia pode esconder oportunidades de economia.</h2>
            <p className="mt-4 text-lg text-muted">Verificamos os pontos que mais pesam na conta de empresas — com regras técnicas auditáveis, não com achismo.</p>
          </BlurFade>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            <BlurFade className="md:col-span-2 md:row-span-2">
              <SpotlightCard className="h-full p-7">
                <span className="flex size-11 items-center justify-center rounded-xl bg-attention-soft text-attention">
                  <Gauge className="size-5" />
                </span>
                <h3 className="mt-5 text-2xl font-bold tracking-tight">Demanda contratada e ultrapassagens</h3>
                <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-muted">
                  Picos acima da demanda contratada (além da tolerância de 5%) são cobrados com tarifa de ultrapassagem. E contratar demais também custa todo mês.
                </p>
                <div className="mt-8">
                  <DemandBars />
                </div>
              </SpotlightCard>
            </BlurFade>
            {[
              { icon: Activity, t: "Energia reativa", d: "Fator de potência abaixo de 0,92 gera cobrança de excedente reativo." },
              { icon: Receipt, t: "Estrutura tarifária", d: "Verde, Azul ou convencional: sinalizamos quando vale comparar." },
              { icon: TrendingUp, t: "Variações anormais", d: "Consumo fora do padrão histórico que merece confirmação." },
              { icon: Sun, t: "Créditos e compensação", d: "Leitura dos créditos de geração distribuída e do saldo acumulado." },
            ].map(({ icon: Icon, t, d }, i) => (
              <BlurFade key={t} delay={0.05 * i} className={i >= 2 ? "" : ""}>
                <SpotlightCard className="h-full p-6">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-4 text-lg font-bold tracking-tight">{t}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{d}</p>
                </SpotlightCard>
              </BlurFade>
            ))}
            <BlurFade className="md:col-span-1">
              <SpotlightCard className="h-full bg-ink p-6 text-white" dark>
                <span className="flex size-10 items-center justify-center rounded-xl bg-volt text-ink">
                  <Zap className="size-5" />
                </span>
                <h3 className="mt-4 text-lg font-bold tracking-tight">GD por assinatura e Mercado Livre</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-white/75">Indicamos se o perfil é compatível, com faixa de economia estimada.</p>
              </SpotlightCard>
            </BlurFade>
          </div>
        </div>
      </section>

      {/* ================= DEMO DA ANÁLISE ================= */}
      <section className="relative overflow-hidden bg-ink py-20 text-white sm:py-24">
        <div className="glow absolute inset-0 opacity-80" />
        <DotPattern className="[mask-image:radial-gradient(600px_circle_at_20%_50%,white,transparent)]" />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <BlurFade className="mb-12 max-w-2xl">
            <Eyebrow className="text-cyan">Veja acontecendo</Eyebrow>
            <h2 className="mt-3 text-[32px] font-bold leading-[1.1] tracking-[-0.03em] sm:text-5xl">A fatura entra. O Raio-X sai. Em até 1 minuto.</h2>
            <p className="mt-4 text-lg text-white/75">Cada campo é lido, conferido e passa por um motor de regras técnico. Você vê o que encontramos — e por quê.</p>
          </BlurFade>
          <ScanDemo />
          <div className="mt-12 flex flex-wrap items-center gap-4">
            <Link href="#analisar" className="inline-flex h-13 items-center gap-2 rounded-xl bg-white px-6 text-[15px] font-bold text-ink shadow-[0_10px_30px_-10px_rgba(255,255,255,0.5)] transition-transform hover:-translate-y-0.5">
              QUERO O RAIO-X DA MINHA FATURA <ArrowRight className="size-4" />
            </Link>
            <span className="text-sm text-white/70">Gratuito · sem compromisso</span>
          </div>
        </div>
      </section>

      {/* ================= COMO FUNCIONA (scroll-linked) ================= */}
      <section id="como-funciona" className="scroll-mt-16 bg-white py-20 sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr]">
          <BlurFade className="lg:sticky lg:top-28 lg:self-start">
            <Eyebrow>Como funciona</Eyebrow>
            <h2 className="mt-3 text-[32px] font-bold leading-[1.1] tracking-[-0.03em] sm:text-5xl">3 passos. Menos de 2 minutos.</h2>
            <p className="mt-4 text-lg text-muted">Sem reunião, sem planilha, sem visita técnica para começar. Um especialista entra só se você quiser avançar.</p>
            <Link href="#analisar" className="pulse-ring mt-8 inline-flex h-13 items-center gap-2 rounded-xl bg-primary px-6 text-[15px] font-bold text-white hover:bg-primary-hover">
              COMEÇAR MINHA ANÁLISE GRÁTIS <ArrowRight className="size-4" />
            </Link>
          </BlurFade>
          <ScrollTimeline steps={STEPS} />
        </div>
      </section>

      {/* ================= TECNOLOGIA (animated beam) ================= */}
      <section className="relative overflow-hidden bg-ink py-20 text-white sm:py-24">
        <DotPattern className="[mask-image:radial-gradient(500px_circle_at_50%_40%,white,transparent)]" />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <BlurFade className="mx-auto mb-12 max-w-2xl text-center">
            <Eyebrow className="text-cyan">Tecnologia com responsabilidade</Eyebrow>
            <h2 className="mt-3 text-[32px] font-bold leading-[1.1] tracking-[-0.03em] sm:text-5xl">A IA lê. As regras calculam. Você decide.</h2>
            <p className="mt-4 text-lg text-white/75">A inteligência artificial interpreta o documento e explica o resultado. Todo valor é calculado por um motor de regras técnico, auditável e versionado.</p>
          </BlurFade>
          <BlurFade delay={0.1}>
            <PipelineBeam />
          </BlurFade>
        </div>
      </section>

      {/* ================= PARA QUEM ================= */}
      <section className="bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <BlurFade className="max-w-2xl">
            <Eyebrow>Para quem é</Eyebrow>
            <h2 className="mt-3 text-[32px] font-bold leading-[1.1] tracking-[-0.03em] sm:text-5xl">Feito para empresas que sentem a conta no caixa.</h2>
          </BlurFade>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SEGMENTS.map(({ icon: Icon, title, text }, i) => (
              <BlurFade key={title} delay={0.04 * i}>
                <SpotlightCard className="h-full p-6">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-ink text-volt">
                      <Icon className="size-5" />
                    </span>
                    <h3 className="text-lg font-bold tracking-tight">{title}</h3>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-muted">{text}</p>
                </SpotlightCard>
              </BlurFade>
            ))}
          </div>
        </div>
      </section>

      {/* ================= COMPARAÇÃO ================= */}
      <section className="bg-background py-20 sm:py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <BlurFade className="mx-auto max-w-2xl text-center">
            <Eyebrow>Por que o Raio-X</Eyebrow>
            <h2 className="mt-3 text-[32px] font-bold leading-[1.1] tracking-[-0.03em] sm:text-5xl">Uma visão independente antes de qualquer proposta.</h2>
          </BlurFade>
          <BlurFade delay={0.1} className="mt-12 overflow-x-auto rounded-3xl border border-border bg-white shadow-[0_20px_60px_-30px_rgba(7,11,22,0.25)]">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="p-5 font-semibold text-muted" />
                  <th className="bg-ink p-5 text-center font-bold text-white">
                    <span className="text-volt">●</span> Raio-X
                  </th>
                  <th className="p-5 text-center font-semibold text-muted">Analisar sozinho</th>
                  <th className="p-5 text-center font-semibold text-muted">Proposta de vendedor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {COMPARE.map((r) => (
                  <tr key={r.item}>
                    <td className="p-5 font-medium">{r.item}</td>
                    <Cell v={r.us} highlight />
                    <Cell v={r.self} />
                    <Cell v={r.seller} />
                  </tr>
                ))}
              </tbody>
            </table>
          </BlurFade>
        </div>
      </section>

      {/* ================= SOLUÇÕES ================= */}
      <section className="bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <BlurFade className="max-w-2xl">
            <Eyebrow>Soluções</Eyebrow>
            <h2 className="mt-3 text-[32px] font-bold leading-[1.1] tracking-[-0.03em] sm:text-5xl">Um diagnóstico. As soluções que fazem sentido para o seu perfil.</h2>
          </BlurFade>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {solutions.map((s, i) => (
              <BlurFade key={s.code} delay={i * 0.06}>
                <Link href={s.href} className="block h-full">
                  <SpotlightCard className="flex h-full flex-col p-7">
                    <span className="font-mono text-xs font-bold text-primary">0{i + 1}</span>
                    <p className="mt-3 text-xl font-bold tracking-tight">{s.title}</p>
                    <p className="mt-2 flex-1 text-[15px] leading-relaxed text-muted">{s.description}</p>
                    <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-primary">
                      {s.code === "auditoria" ? "Analisar minha fatura" : s.code === "gd_assinatura" ? "Simular economia" : "Analisar perfil"}
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                    </span>
                  </SpotlightCard>
                </Link>
              </BlurFade>
            ))}
          </div>
        </div>
      </section>

      {TESTIMONIALS.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
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
      <section className="relative overflow-hidden bg-ink py-20 text-white sm:py-24">
        <div className="glow absolute inset-0 opacity-70" />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <BlurFade>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-xs font-semibold">
              <Bot className="size-3.5 text-cyan" /> Atendimento com IA
            </span>
            <h2 className="mt-4 text-[32px] font-bold leading-[1.1] tracking-[-0.03em] sm:text-5xl">Dúvida às 23h? A resposta vem na hora.</h2>
            <p className="mt-4 text-lg text-white/75">
              A assistente explica a análise, GD por assinatura, Mercado Livre e o seu Raio-X. Quando fizer sentido, chama um especialista humano no WhatsApp.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <OpenChatButton className="inline-flex h-13 items-center gap-2 rounded-xl bg-white px-6 text-[15px] font-bold text-ink hover:-translate-y-0.5" label="Conversar com a IA" />
              <Link href="#analisar" className="inline-flex h-13 items-center rounded-xl border border-white/20 px-6 text-[15px] font-semibold hover:bg-white/10">
                Enviar fatura
              </Link>
            </div>
          </BlurFade>
          <BlurFade delay={0.1}>
            <ChatDemo />
          </BlurFade>
        </div>
      </section>

      {/* ================= SEGURANÇA / LGPD ================= */}
      <section className="border-b border-border bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-3">
          {[
            { icon: Lock, t: "Segurança do documento", d: "Transmissão criptografada, armazenamento privado e acesso restrito à equipe responsável. O arquivo nunca fica público." },
            { icon: ShieldCheck, t: "LGPD de verdade", d: "Consentimento registrado, uso restrito à análise e ao contato autorizado, e canal para acessar ou excluir seus dados." },
            { icon: FileSearch, t: "Diagnóstico preliminar", d: "Cada resultado traz nível de confiança. Nenhuma conclusão é definitiva sem validação técnica." },
          ].map(({ icon: Icon, t, d }) => (
            <div key={t}>
              <Icon className="size-7 text-primary" />
              <p className="mt-4 text-lg font-bold">{t}</p>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">{d}</p>
            </div>
          ))}
          <p className="text-sm md:col-span-3">
            <Link href="/privacidade/solicitacao" className="font-semibold text-primary hover:underline">
              Exercer meus direitos (LGPD) →
            </Link>
          </p>
        </div>
      </section>

      {/* ================= FAQ ================= */}
      <section id="faq" className="scroll-mt-16 bg-background py-20 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <Eyebrow className="text-center">Perguntas frequentes</Eyebrow>
          <h2 className="mt-3 text-center text-[32px] font-bold tracking-[-0.03em] sm:text-4xl">Tudo o que você precisa saber</h2>
          <div className="mt-10 space-y-3">
            {FAQ.map((f) => (
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
            Não achou sua dúvida? <OpenChatButton className="font-bold text-primary hover:underline" label="Pergunte à nossa IA" />
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
              Descubra o que a sua conta de energia <span className="text-volt">está dizendo.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg text-white/80">Simule, envie a fatura e receba o Raio-X preliminar em até 1 minuto.</p>
            <Link href="#analisar" className="mt-9 inline-flex h-14 items-center gap-2 rounded-2xl bg-white px-8 text-base font-bold text-ink shadow-[0_15px_40px_-10px_rgba(255,255,255,0.45)] transition-transform hover:-translate-y-0.5">
              ANALISAR MINHA FATURA GRÁTIS <ArrowRight className="size-5" />
            </Link>
            <div className="mt-7 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-medium text-white/80">
              {["Gratuito", "Sem compromisso", "Sem trocar de fornecedor", "Dados protegidos"].map((t) => (
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

function Cell({ v, highlight }: { v: boolean | string; highlight?: boolean }) {
  return (
    <td className={cn("p-5 text-center", highlight && "bg-primary-soft/60 font-semibold")}>
      {v === true ? (
        <span className={cn("inline-flex size-7 items-center justify-center rounded-full", highlight ? "bg-primary text-white" : "bg-subtle text-foreground")}>
          <Check className="size-4" strokeWidth={3} />
        </span>
      ) : v === false ? (
        <span className="inline-flex size-7 items-center justify-center rounded-full bg-attention-soft text-attention">
          <X className="size-4" strokeWidth={3} />
        </span>
      ) : v === "Parcial" ? (
        <span className="inline-flex items-center gap-1 text-muted">
          <Minus className="size-4" /> Parcial
        </span>
      ) : (
        <span className={highlight ? "text-foreground" : "text-muted"}>{v}</span>
      )}
    </td>
  );
}
