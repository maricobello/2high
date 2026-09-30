import { seedReport } from "./support/seed-report";

/** Dados de teste no banco local (relatório pronto + uso da IA) para os testes do relatório e do admin. */
export default function globalSetup() {
  seedReport();
}
