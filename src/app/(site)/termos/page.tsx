import { pageMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import { Prose } from "@/components/site/prose";
import { brand } from "@/lib/brand";

export const metadata: Metadata = pageMetadata({ path: "/termos", title: "Termos de uso", description: "Termos de uso do diagnóstico e da auditoria de faturas de energia." });

export default function TermsPage() {
  return (
    <Prose title="Termos de Uso" updated="setembro de 2026">
      <h2>1. O serviço</h2>
      <p>
        {brand.name} oferece análises preliminares de faturas de energia e simulações de soluções (auditoria de fatura, geração distribuída por assinatura e Mercado
        Livre de Energia), com finalidade informativa.
      </p>
      <h2>2. Natureza preliminar</h2>
      <p>
        Os resultados são estimativas baseadas nos dados disponíveis e em premissas técnicas e comerciais. Não constituem laudo, parecer jurídico, garantia de
        economia ou afirmação de erro de faturamento. Toda conclusão depende de validação técnica, regulatória e comercial.
      </p>
      <h2>3. Responsabilidades do usuário</h2>
      <p>O usuário declara ter autorização para compartilhar a fatura e os dados da empresa informados.</p>
      <h2>4. Propostas comerciais</h2>
      <p>
        Eventuais propostas de parceiros são apresentadas separadamente, com condições próprias. A decisão de contratar é sempre do cliente.
      </p>
      <h2>5. Privacidade</h2>
      <p>O tratamento de dados segue a nossa Política de Privacidade.</p>
    </Prose>
  );
}
