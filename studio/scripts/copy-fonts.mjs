// Copia a fonte do site (Geist, licença OFL) para public/, de onde os vídeos a carregam.
import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("public/fonts", { recursive: true });
copyFileSync("node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2", "public/fonts/Geist-Variable.woff2");
