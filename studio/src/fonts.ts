import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

// Mesma fonte do site (Geist Sans). O arquivo é copiado para public/ no npm install.
loadFont({ family: "Geist", url: staticFile("fonts/Geist-Variable.woff2"), weight: "100 900" });
