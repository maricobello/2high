"use client";

import dynamic from "next/dynamic";

/** O chat é carregado depois da página (não pesa no primeiro carregamento). */
export const ChatWidgetLazy = dynamic(() => import("./chat-widget").then((m) => m.ChatWidget), { ssr: false });
