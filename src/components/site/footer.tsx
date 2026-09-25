import Link from "next/link";
import { brand } from "@/lib/brand";
import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/5 bg-ink text-white/75">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-4">
          <Logo />
          <p className="max-w-sm text-sm leading-relaxed">
            Auditoria e gestão de energia para empresas e condomínios. Diagnósticos preliminares, sujeitos à validação técnica.
          </p>
          {brand.legalName && (
            <p className="text-xs text-white/60">
              {brand.legalName}
              {brand.legalCnpj ? ` · CNPJ ${brand.legalCnpj}` : ""}
            </p>
          )}
        </div>
        <div className="space-y-3 text-sm">
          <p className="font-semibold text-white">Soluções</p>
          <Link className="block hover:text-white" href="/#analisar">Auditoria de fatura</Link>
          <Link className="block hover:text-white" href="/gd-por-assinatura">GD por assinatura</Link>
          <Link className="block hover:text-white" href="/mercado-livre">Mercado Livre de Energia</Link>
        </div>
        <div className="space-y-3 text-sm">
          <p className="font-semibold text-white">Transparência</p>
          <Link className="block hover:text-white" href="/privacidade">Política de privacidade (LGPD)</Link>
          <Link className="block hover:text-white" href="/termos">Termos de uso</Link>
          <Link className="block hover:text-white" href="/privacidade/solicitacao">Seus direitos (LGPD)</Link>
          <Link className="block hover:text-white" href="/guia-conta-de-energia">Guia: 7 pontos da conta de energia</Link>
          <a className="block hover:text-white" href={`mailto:${brand.dpoEmail}`}>Encarregado de dados: {brand.dpoEmail}</a>
        </div>
      </div>
      <div className="border-t border-white/5">
        <p className="mx-auto max-w-6xl px-4 py-6 text-xs leading-relaxed text-white/60 sm:px-6">
          As análises apresentadas são preliminares e têm caráter informativo. Estimativas de economia dependem de validação técnica, regulatória e comercial e não
          constituem promessa de resultado. © {new Date().getFullYear()} {brand.name}.
        </p>
      </div>
    </footer>
  );
}
