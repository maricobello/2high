"use client";

import { Bot, Loader2, MessageCircle, Send, UploadCloud, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { openAnalysis } from "@/lib/client/open-analysis";
import { OPEN_CHAT_EVENT } from "./open-chat-button";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const STARTERS = ["É realmente gratuito?", "O que vocês analisam na conta?", "Preciso instalar placas?", "Como funciona o Mercado Livre?"];

/** Atendimento com IA: botão flutuante + painel de conversa. */
export function ChatWidget() {
  const path = usePathname();
  const router = useRouter();
  const token = path.startsWith("/diagnostico/") ? path.split("/")[2] : null;
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>(STARTERS);
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);
  const [handoff, setHandoff] = useState(false);
  const [suggestUpload, setSuggestUpload] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onOpen = (e: Event) => {
      setOpen(true);
      const m = (e as CustomEvent<{ message?: string }>).detail?.message;
      if (m) void send(m);
      setTimeout(() => inputRef.current?.focus(), 50);
    };
    window.addEventListener(OPEN_CHAT_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_CHAT_EVENT, onOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgs, token]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, busy]);

  // No celular, o botão some enquanto o quiz do topo está na tela (não cobre as opções).
  const [heroVisible, setHeroVisible] = useState(false);
  useEffect(() => {
    const hero = document.getElementById("analisar");
    if (!hero) return;
    const io = new IntersectionObserver(([e]) => setHeroVisible(e.isIntersecting), { threshold: 0.15 });
    io.observe(hero);
    return () => io.disconnect();
  }, [path]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsgs([...next, { role: "assistant", content: data.reply }]);
      setSuggestions(data.suggestions?.length ? data.suggestions : []);
      setWhatsappUrl(data.whatsappUrl ?? null);
      setHandoff(Boolean(data.handoff));
      setSuggestUpload(Boolean(data.suggestUpload));
    } catch (err) {
      setMsgs([...next, { role: "assistant", content: err instanceof Error && err.message ? err.message : "Tive um problema para responder agora. Tente novamente em instantes." }]);
    }
    setBusy(false);
  }

  const goUpload = () => {
    setOpen(false);
    if (path === "/") openAnalysis();
    else router.push("/#analisar");
  };

  return (
    <>
      {/* Botão flutuante */}
      <button
        ref={toggleRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Fechar atendimento" : "Abrir atendimento com IA"}
        className={cn(
          "fixed bottom-4 right-4 z-40 flex size-14 items-center justify-center rounded-full bg-ink text-white shadow-2xl shadow-primary/30 ring-1 ring-white/10 transition-transform hover:scale-105 print:hidden",
          !open && "motion-safe:animate-[rise_.4s_ease_both]",
          !open && heroVisible && "max-md:hidden",
        )}
      >
        {open ? <X className="size-6" /> : <Bot className="size-6" />}
        {!open && <span className="absolute right-1 top-1 size-3 rounded-full border-2 border-ink bg-opportunity" />}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Atendimento com IA"
          className="fixed inset-x-2 bottom-20 z-40 flex max-h-[min(640px,calc(100dvh-6rem))] flex-col overflow-hidden rounded-3xl border border-border bg-white shadow-2xl sm:inset-x-auto sm:right-4 sm:w-[390px] print:hidden"
        >
          <div className="flex items-center gap-3 bg-ink px-4 py-3.5 text-white">
            <span className="relative flex size-9 items-center justify-center rounded-full bg-primary">
              <Bot className="size-5" />
              <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-ink bg-opportunity" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Assistente de energia</p>
              <p className="text-[11px] text-white/60">IA · responde na hora · especialista quando precisar</p>
            </div>
            <button onClick={() => { setOpen(false); toggleRef.current?.focus(); }} aria-label="Fechar" className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white">
              <X className="size-4" />
            </button>
          </div>

          <div role="log" aria-live="polite" aria-label="Conversa com o assistente" className="flex-1 space-y-3 overflow-y-auto bg-subtle/40 p-4 text-sm">
            <div className="max-w-[88%] rounded-2xl rounded-tl-md bg-white px-3.5 py-2.5 shadow-sm">
              Olá! Sou a assistente virtual. Posso explicar a análise gratuita da fatura, GD por assinatura, Mercado Livre{token ? " e o seu Raio-X" : ""}. Como posso ajudar?
            </div>
            {msgs.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[88%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 leading-relaxed",
                  m.role === "user" ? "ml-auto rounded-tr-md bg-primary text-white" : "rounded-tl-md bg-white shadow-sm",
                )}
              >
                {m.content}
              </div>
            ))}
            {busy && (
              <div className="flex w-fit items-center gap-2 rounded-2xl bg-white px-3.5 py-2.5 text-muted shadow-sm">
                <Loader2 className="size-3.5 animate-spin" /> digitando…
              </div>
            )}
            {!busy && (handoff || suggestUpload) && (
              <div className="flex flex-wrap gap-2">
                {suggestUpload && (
                  <button onClick={goUpload} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white">
                    <UploadCloud className="size-3.5" /> Fazer diagnóstico
                  </button>
                )}
                {handoff && whatsappUrl && (
                  <a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-[#1fa855] px-3 py-2 text-xs font-semibold text-white">
                    <MessageCircle className="size-3.5" /> Falar com especialista
                  </a>
                )}
              </div>
            )}
            <div ref={endRef} />
          </div>

          {suggestions.length > 0 && !busy && (
            <div className="flex gap-2 overflow-x-auto border-t border-border px-3 py-2">
              {suggestions.map((s) => (
                <button key={s} onClick={() => send(s)} className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:border-primary hover:text-primary">
                  {s}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            className="flex items-center gap-2 border-t border-border p-3"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, 1000))}
              placeholder="Escreva sua dúvida…"
              aria-label="Mensagem"
              className="h-11 flex-1 rounded-xl border border-border px-3.5 text-[15px] focus:border-primary focus:outline-none"
            />
            <button type="submit" disabled={busy || !input.trim()} aria-label="Enviar" className="flex size-11 items-center justify-center rounded-xl bg-primary text-white disabled:opacity-40">
              <Send className="size-4" />
            </button>
          </form>
          <p className="px-4 pb-3 text-[10px] leading-snug text-muted">
            Respostas geradas por IA, com caráter informativo. Não envie dados sensíveis (senhas, documentos pessoais).{" "}
            <a href="/privacidade" className="underline">
              Privacidade
            </a>
          </p>
        </div>
      )}
    </>
  );
}
