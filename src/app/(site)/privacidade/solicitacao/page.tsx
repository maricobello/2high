import { pageMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import { PrivacyRequestForm } from "@/components/forms/privacy-request-form";
import { brand } from "@/lib/brand";

export const metadata: Metadata = pageMetadata({ path: "/privacidade/solicitacao", title: "Seus direitos (LGPD)", description: "Solicite acesso, correção ou exclusão dos seus dados." });

export default function PrivacyRequestPage() {
  return (
    <section className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Seus direitos sobre seus dados</h1>
      <p className="mt-3 text-muted">
        Pela LGPD (art. 18), você pode pedir acesso, correção, exclusão, portabilidade e revogar o consentimento a qualquer momento. Também pode escrever para{" "}
        <a className="text-primary underline underline-offset-2" href={`mailto:${brand.dpoEmail}`}>
          {brand.dpoEmail}
        </a>
        .
      </p>
      <div className="mt-8">
        <PrivacyRequestForm />
      </div>
    </section>
  );
}
