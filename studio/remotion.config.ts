import { Config } from "@remotion/cli/config";

Config.setEntryPoint("src/index.ts");
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// Sem acesso ao download do Chrome (ex.: ambiente na nuvem), aponte para um Chromium local.
if (process.env.REMOTION_BROWSER) Config.setBrowserExecutable(process.env.REMOTION_BROWSER);
