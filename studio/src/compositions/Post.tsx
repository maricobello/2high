import { AbsoluteFill } from "remotion";
import { colors, SITE_URL } from "../brand";
import { Background } from "../elements/Background";
import { BillCard } from "../elements/BillCard";
import { CtaPill } from "../elements/CtaPill";
import { EnergyLine } from "../elements/EnergyLine";
import { Headline } from "../elements/Headline";
import { Logo } from "../elements/Logo";
import type { PromoProps } from "./Promo";

export const POST_FRAMES = 150;

/**
 * Post de feed (4:5) com tudo numa tela. Anima em 5s; a imagem estática
 * é o último quadro (npm run still:post).
 */
export const Post: React.FC<PromoProps> = (p) => (
  <Background>
    <EnergyLine top="30%" height={160} delay={20} />
    <AbsoluteFill style={{ padding: "80px 84px 70px", justifyContent: "space-between" }}>
      <Logo height={52} />
      <Headline title={p.title} highlight={p.highlight} size={84} />
      <BillCard title={p.cardTitle} items={p.items} width={912} scale={1.15} delay={24} step={16} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <CtaPill label={p.cta} size={26} delay={105} />
        <span style={{ fontSize: 28, fontWeight: 600, color: colors.primaryText }}>{SITE_URL}</span>
      </div>
      <p style={{ margin: 0, fontSize: 20, color: colors.muted }}>{p.footnote}</p>
    </AbsoluteFill>
  </Background>
);
