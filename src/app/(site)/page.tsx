import {
  Activity,
  ArrowRight,
  BarChart3,
  Brain,
  CheckCircle2,
  FileSearch,
  Gauge,
  Layers,
  Lock,
  Receipt,
  ScanLine,
  ShieldCheck,
  Sun,
  TrendingUp,
  UserCheck,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { HeroLeadForm } from "@/components/forms/hero-lead-form";
import { buttonVariants } from "@/components/ui/button";
import { Badge, Eyebrow } from "@/components/ui/card";
import { FAQ } from "@/content/faq";
import { TESTIMONIALS } from "@/content/social-proof";
import { cn } from "@/lib/utils";
import { visibleSolutions } from "@/modules/leads/solutions";

const CHECKS = [
  { icon: Gauge, title: "Ultrapassagem de demanda", text: "Demanda medida acima da contratada pode gerar cobrança com tarifa mais cara." },
  { icon: Layers, title: "Demanda contratada", text: "Possível descompasso entre o contrato e o perfil real de uso." },
  { icon: Activity, title: "Energia reativa", text: "Fator de potência abaixo da referência e cobranças de excedente reativo." },
  { icon: Receipt, title: "Estrutura tarifária", text: "Modalidade e enquadramento que merecem comparação detalhada." },
  { icon: TrendingUp, title: "Variações anormais", text: "Consumo fora do padrão histórico que vale confirmar." },
  { icon: Sun, title: "Créditos e compensação", text: "Leitura dos créditos de geração distribuída já existentes." },
  { icon: Zap, title: "GD por assinatura", text: "Perfil compatível com energia compartilhada, sem instalar painéis." },
  { icon: BarChart3, title: "Mercado Livre", text: "Análise preliminar de perfil para contratação no ambiente livre." },
];

const STEPS = [
  { icon: ScanLine, title: "Leitura da fatura", text: "Extraímos distribuidora, tarifas, consumo, demanda, impostos e histórico." },
  { icon: CheckCircle2, title: "Validação dos dados", text: "Conferimos consistência e plausibilidade de cada campo lido." },
  { icon: FileSearch, title: "Motor de regras técnico", text: "Cálculos e verificações determinísticas — sem “achismo” de IA." },
  { icon: Brain, title: "Explicação clara", text: "Resultados traduzidos em linguagem simples, com nível de confiança." },
  { icon: UserCheck, title: "Especialista", text: "Se fizer sentido, um especialista valida e apresenta as opções." },
];

export default function HomePage() {
  const solutions = visibleSolutions();
  return (
    <>
      {/* HERO */}
      <section id="analisar" className="relative overflow-hidden bg-ink text-white scroll-mt-16">
        <div className="glow absolute inset-0" />
        <div className="grid-bg absolute inset-0" />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-10 sm:px-6 md:pt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:pb-24">
          <div className="animate-rise flex flex-col justify-center">
            <Badge tone="dark" className="mb-5 w-fit border border-white/10">
              <span className="size-1.5 rounded-full bg-cyan" /> Diagnóstico de energia para empresas
            </Badge>
            <h1 className="text-[34px] font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-[56px]">
              Sua empresa sabe exatamente quanto <span className="text-cyan">deveria</span> estar pagando pela energia?
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg">
              Envie sua fatura e descubra oportunidades de redução de custos, possíveis inconsistências de faturamento e quais soluções de energia podem fazer
              sentido para sua empresa.
            </p>
            <ul className="mt-7 grid gap-2.5 text-sm text-white/80 sm:grid-cols-2">
              {["Análise preliminar gratuita", "Resultado em minutos", "Sem trocar de fornecedor", "Sem instalar placas"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-cyan" /> {t}
                </li>
              ))}
            </ul>
            <div className="mt-8 hidden gap-3 lg:flex">
              <Link href="/gd-por-assinatura" className={buttonVariants({ variant: "dark", size: "lg" })}>
                SIMULAR ECONOMIA
              </Link>
            </div>
          </div>
          <div className="animate-rise [animation-delay:120ms]">
            <HeroLeadForm />
            <Link href="/gd-por-assinatura" className={cn(buttonVariants({ variant: "dark", size: "lg" }), "mt-3 w-full lg:hidden")}>
              SIMULAR ECONOMIA
            </Link>
          </div>
        </div>
      </section>

      {/* TRUST STRIP */}
      <section className="border-b border-border bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-6 text-sm text-muted sm:px-6 md:grid-cols-4">
          {[
            { icon: FileSearch, t: "Regras técnicas auditáveis" },
            { icon: Brain, t: "IA só para leitura e explicação" },
            { icon: ShieldCheck, t: "Dados protegidos pela LGPD" },
            { icon: UserCheck, t: "Validação por especialista" },
          ].map(({ icon: Icon, t }) => (
            <div key={t} className="flex items-center gap-2.5">
              <Icon className="size-4 text-primary" />
              <span className="font-medium text-foreground/80">{t}</span>
            </div>
          ))}
        </div>
      </section>

      {/* O QUE ANALISAMOS */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="max-w-2xl">
          <Eyebrow>Auditoria de fatura</Eyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Sua conta de energia pode esconder oportunidades de economia.</h2>
          <p className="mt-4 text-muted">Faça uma análise preliminar gratuita. Verificamos os pontos que mais pesam na conta de empresas:</p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CHECKS.map(({ icon: Icon, title, text }) => (
            <div key={title} className="group rounded-2xl border border-border bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                <Icon className="size-5" />
              </span>
              <p className="mt-4 font-semibold">{title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section id="como-funciona" className="scroll-mt-16 bg-ink py-20 text-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div>
              <Eyebrow className="text-cyan">Como funciona</Eyebrow>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Tecnologia para ler. Regras técnicas para calcular.</h2>
              <p className="mt-4 text-white/65">
                A inteligência artificial interpreta o documento e explica o resultado. Todo cálculo financeiro e toda verificação regulatória são feitos por um motor
                de regras determinístico, auditável e versionado.
              </p>
              <ol className="mt-8 space-y-5">
                {STEPS.map(({ icon: Icon, title, text }, i) => (
                  <li key={title} className="flex gap-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-cyan">
                      <Icon className="size-5" />
                    </span>
                    <div>
                      <p className="font-semibold">
                        <span className="mr-2 font-mono text-xs text-white/40">0{i + 1}</span>
                        {title}
                      </p>
                      <p className="mt-0.5 text-sm text-white/60">{text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <RaioXPreview />
          </div>
        </div>
      </section>

      {/* SOLUÇÕES */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="max-w-2xl">
          <Eyebrow>Soluções</Eyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Um diagnóstico, as soluções que fazem sentido para o seu perfil.</h2>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {solutions.map((s) => (
            <Link
              key={s.code}
              href={s.href}
              className="group flex flex-col rounded-2xl border border-border bg-white p-6 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5"
            >
              <p className="text-lg font-semibold">{s.title}</p>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{s.description}</p>
              <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                {s.code === "auditoria" ? "Analisar minha fatura" : s.code === "gd_assinatura" ? "Simular economia" : "Analisar perfil"}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
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

      {/* SEGURANÇA */}
      <section className="border-y border-border bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-3">
          <div>
            <Lock className="size-6 text-primary" />
            <p className="mt-4 font-semibold">Segurança do documento</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Transmissão criptografada, armazenamento privado e acesso restrito à equipe responsável. O arquivo nunca fica público.
            </p>
          </div>
          <div>
            <ShieldCheck className="size-6 text-primary" />
            <p className="mt-4 font-semibold">LGPD</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Usamos seus dados apenas para gerar o diagnóstico e o contato que você autorizou. Solicite acesso ou exclusão quando quiser.{" "}
              <Link href="/privacidade" className="font-medium text-primary hover:underline">
                Política de privacidade
              </Link>
              .
            </p>
          </div>
          <div>
            <FileSearch className="size-6 text-primary" />
            <p className="mt-4 font-semibold">Diagnóstico preliminar</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              O resultado indica pontos de atenção e oportunidades com nível de confiança. Nenhuma conclusão é definitiva sem validação técnica.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
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
      </section>

      {/* CTA FINAL */}
      <section className="px-4 pb-20 sm:px-6">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-ink px-6 py-14 text-center text-white sm:px-12">
          <div className="glow absolute inset-0 opacity-80" />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">Descubra o que a sua conta de energia está dizendo.</h2>
            <p className="mx-auto mt-4 max-w-xl text-white/65">Envie a fatura e receba um Raio-X preliminar em minutos. Gratuito e sem compromisso.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/#analisar" className={buttonVariants({ size: "lg" })}>
                ENVIAR FATURA <ArrowRight className="size-4" />
              </Link>
              <Link href="/gd-por-assinatura" className={buttonVariants({ variant: "dark", size: "lg" })}>
                SIMULAR ECONOMIA
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
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
            ["Soluções", "ML · Revisão"],
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
