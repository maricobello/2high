import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-ink px-4 text-center text-white">
      <p className="font-mono text-xs uppercase tracking-[0.24em] text-cyan">404</p>
      <h1 className="mt-3 text-2xl font-semibold">Página não encontrada</h1>
      <p className="mt-2 text-sm text-white/60">Verifique o link do seu diagnóstico ou envie uma nova fatura.</p>
      <Link href="/" className="mt-6 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold">
        Voltar ao início
      </Link>
    </main>
  );
}
