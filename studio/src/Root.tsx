import { Composition } from "remotion";
import "./fonts";
import { Post, POST_FRAMES } from "./compositions/Post";
import { Promo, promoDefaults } from "./compositions/Promo";

const FPS = 30;
const DURATION = 15 * FPS;

/** Formatos disponíveis no estúdio (textos editáveis no painel à direita). */
export const Root: React.FC = () => (
  <>
    <Composition id="Reels" component={Promo} width={1080} height={1920} fps={FPS} durationInFrames={DURATION} defaultProps={promoDefaults} />
    <Composition id="Feed" component={Promo} width={1080} height={1350} fps={FPS} durationInFrames={DURATION} defaultProps={promoDefaults} />
    <Composition id="Wide" component={Promo} width={1920} height={1080} fps={FPS} durationInFrames={DURATION} defaultProps={promoDefaults} />
    <Composition id="Post" component={Post} width={1080} height={1350} fps={FPS} durationInFrames={POST_FRAMES} defaultProps={promoDefaults} />
  </>
);
