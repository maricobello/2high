import { AbsoluteFill, interpolate, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { colors, SITE_URL } from "../brand";
import { Background } from "../elements/Background";
import { BillCard, type BillItem } from "../elements/BillCard";
import { CtaPill } from "../elements/CtaPill";
import { EnergyLine } from "../elements/EnergyLine";
import { Headline } from "../elements/Headline";
import { Logo } from "../elements/Logo";

export type PromoProps = {
  title: string;
  highlight: string;
  caption: string;
  cardTitle: string;
  items: BillItem[];
  closing: string;
  cta: string;
  footnote: string;
};

export const promoDefaults: PromoProps = {
  title: "Sua empresa paga energia todo mês.",
  highlight: "Alguém confere?",
  caption: "Conferimos a sua conta item por item.",
  cardTitle: "Conta de energia",
  items: [
    { label: "Demanda contratada", status: "revisar" },
    { label: "Energia reativa", status: "revisar" },
    { label: "Bandeira tarifária", status: "ok" },
    { label: "ICMS na base de cálculo", status: "ok" },
  ],
  closing: "Diagnóstico sem custo em 5 perguntas.",
  cta: "Fazer diagnóstico",
  footnote: "Análise preliminar, sujeita à validação técnica.",
};

/** Entra e sai com fade curto (0,3s), como as animações do site. */
const Fade: React.FC<{ duration: number; children: React.ReactNode }> = ({ duration, children }) => {
  const f = useCurrentFrame();
  const opacity = interpolate(f, [0, 9, duration - 9, duration], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

/**
 * Vídeo curto de divulgação em 3 cenas: pergunta → conta sendo conferida → chamada.
 * Adapta o layout ao formato (vertical, 4:5 ou 16:9).
 */
export const Promo: React.FC<PromoProps> = (p) => {
  const { width, height } = useVideoConfig();
  const portrait = height >= width;
  const u = Math.min(width, height) / 1080;
  const pad = (portrait ? 90 : 120) * u;
  const S1 = { from: 0, dur: 125 };
  const S2 = { from: 115, dur: 220 };
  const S3 = { from: 325, dur: 125 };

  return (
    <Background>
      <div style={{ position: "absolute", top: pad * 0.8, left: pad }}>
        <Logo height={56 * u} />
      </div>

      <Sequence from={S1.from} durationInFrames={S1.dur}>
        <Fade duration={S1.dur}>
          <AbsoluteFill style={{ justifyContent: "center", padding: pad }}>
            <Headline title={p.title} highlight={p.highlight} size={(portrait ? 104 : 112) * u} delay={6} />
          </AbsoluteFill>
          <EnergyLine top={portrait ? "70%" : "74%"} height={180 * u} delay={30} />
        </Fade>
      </Sequence>

      <Sequence from={S2.from} durationInFrames={S2.dur}>
        <Fade duration={S2.dur}>
          <AbsoluteFill style={{ flexDirection: portrait ? "column" : "row", alignItems: "center", justifyContent: "center", gap: (portrait ? 64 : 90) * u, padding: pad }}>
            <p style={{ margin: 0, fontSize: (portrait ? 72 : 76) * u, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.1, maxWidth: portrait ? "100%" : 640 * u, textWrap: "balance" }}>{p.caption}</p>
            <BillCard title={p.cardTitle} items={p.items} width={(portrait ? 900 : 780) * u} delay={10} />
          </AbsoluteFill>
        </Fade>
      </Sequence>

      <Sequence from={S3.from} durationInFrames={S3.dur}>
        <Fade duration={S3.dur + 9}>
          <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center", gap: 56 * u, padding: pad }}>
            <p style={{ margin: 0, fontSize: (portrait ? 84 : 88) * u, fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1.08, maxWidth: 1400 * u, textWrap: "balance" }}>{p.closing}</p>
            <CtaPill label={p.cta} size={32 * u} delay={12} />
            <p style={{ margin: 0, fontSize: 34 * u, color: colors.primaryText, fontWeight: 600 }}>{SITE_URL}</p>
          </AbsoluteFill>
          <p style={{ position: "absolute", bottom: pad * 0.7, left: 0, right: 0, margin: 0, textAlign: "center", fontSize: 22 * u, color: colors.muted }}>{p.footnote}</p>
        </Fade>
      </Sequence>
    </Background>
  );
};
