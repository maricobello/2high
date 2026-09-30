/**
 * Tokens da marca para os vídeos e imagens.
 * Espelho de src/app/globals.css (paleta "confiança") e da logo em src/components/site/logo.tsx;
 * o teste tests/studio-brand.test.ts falha se os dois se separarem.
 */
export const colors = {
  ink: "#04060c",
  background: "#060913",
  card: "#0d1424",
  foreground: "#f2f4f8",
  muted: "#a3adc2",
  border: "#1f2940",
  primary: "#3d5afe",
  primaryText: "#8da0ff",
  primaryForeground: "#ffffff",
  volt: "#ffc83d",
  opportunity: "#3ecf8e",
  attention: "#ff7a7a",
} as const;

/** Geometria da logo (mesma do site e do favicon). */
export const BOLT_POINTS = "57,32 79,37 62,49 71,51 27,93 45,60 36,58";
export const A_POINTS = "0,68 37,0 63,0 100,68 77,68 50,19 23,68";

export const SITE_URL = "aferi-energia.vercel.app";
export const FONT = "Geist, system-ui, sans-serif";
