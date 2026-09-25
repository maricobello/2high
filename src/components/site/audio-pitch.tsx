"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const SRC = "/audio/especialista.mp3";
const FALLBACK_SECONDS = 139;

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/**
 * Balão "Escute nosso especialista" no topo: um play pequeno e chamativo que toca o
 * áudio explicando o serviço. O arquivo só é baixado quando a pessoa aperta o play.
 */
export function AudioPitch({ className }: { className?: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(FALLBACK_SECONDS);

  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const onTime = () => setTime(a.currentTime);
    const onMeta = () => Number.isFinite(a.duration) && setDuration(a.duration);
    const onEnd = () => {
      setPlaying(false);
      setTime(0);
    };
    const onPause = () => setPlaying(false);
    const onPlay = () => setPlaying(true);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnd);
    a.addEventListener("pause", onPause);
    a.addEventListener("play", onPlay);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnd);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("play", onPlay);
    };
  }, []);

  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    setStarted(true);
    if (a.paused) void a.play();
    else a.pause();
  };

  const progress = Math.min(100, (time / duration) * 100);

  return (
    <div className={cn("relative inline-flex max-w-full items-center gap-3 rounded-2xl rounded-bl-md border border-primary/35 bg-card/70 py-2 pl-2 pr-4 backdrop-blur-sm", className)}>
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pausar o áudio do especialista" : `Ouvir o especialista explicar o serviço (${fmt(duration)})`}
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_0_24px_-4px_rgba(62,224,102,0.8)] transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-ink",
          !started && "pulse-ring",
        )}
      >
        {playing ? <Pause className="size-5" fill="currentColor" /> : <Play className="ml-0.5 size-5" fill="currentColor" />}
      </button>
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold leading-tight text-white">Escute nosso especialista</span>
        <span className="mt-1 flex items-center gap-2 text-[12px] leading-none text-white/70">
          {started ? (
            <>
              <span className="relative h-1 w-24 overflow-hidden rounded-full bg-white/15 sm:w-32" aria-hidden>
                <span className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${progress}%` }} />
              </span>
              <span className="tabular" aria-live="off">
                {fmt(time)} / {fmt(duration)}
              </span>
            </>
          ) : (
            <>Entenda o serviço em {Math.round(duration / 60)} min</>
          )}
        </span>
      </span>
      <audio ref={audio} src={SRC} preload="none" />
    </div>
  );
}
