"use client";

import { Bot } from "lucide-react";

export const OPEN_CHAT_EVENT = "open-ai-chat";

export function openChat(message?: string) {
  window.dispatchEvent(new CustomEvent(OPEN_CHAT_EVENT, { detail: { message } }));
}

export function OpenChatButton({ className, label = "Tirar dúvidas com a IA", message }: { className?: string; label?: string; message?: string }) {
  return (
    <button type="button" onClick={() => openChat(message)} className={className ?? "inline-flex items-center gap-1.5"}>
      <Bot className="mr-1.5 inline size-4 align-[-3px]" />
      {label}
    </button>
  );
}
