import Link from "next/link";
import { brand } from "@/lib/brand";

export default function ContactUnavailable() {
  return (
    <section className="mx-auto max-w-lg px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">Recebemos seu interesse</h1>
      <p className="mt-3 text-muted">
        Nosso time comercial vai entrar em contato pelo WhatsApp ou e-mail informado. Se preferir, escreva para{" "}
        <a className="text-primary" href={`mailto:${brand.contactEmail}`}>
          {brand.contactEmail}
        </a>
        .
      </p>
      <Link href="/" className="mt-6 inline-block text-sm font-semibold text-primary">
        Voltar ao início
      </Link>
    </section>
  );
}
