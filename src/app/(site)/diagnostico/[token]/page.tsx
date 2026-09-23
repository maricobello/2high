import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DiagnosticView } from "@/components/diagnostic/diagnostic-view";
import { brand } from "@/lib/brand";
import { getPublicDiagnostic } from "@/modules/pipeline/public-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Raio-X da sua energia",
  robots: { index: false, follow: false },
};

export default async function DiagnosticPage(props: PageProps<"/diagnostico/[token]">) {
  const { token } = await props.params;
  const view = await getPublicDiagnostic(token);
  if (!view) notFound();
  return <DiagnosticView token={token} initial={view} whatsappEnabled={Boolean(brand.whatsapp)} />;
}
