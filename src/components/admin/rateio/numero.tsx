"use client";

import { useState, type InputHTMLAttributes } from "react";
import { toNumber } from "@/modules/rateio/normalize";

/** Número no formato brasileiro: 619.886,12 (ponto = milhar, vírgula = decimal). */
export function formatarBr(v: number | null | undefined, casas = 6): string {
  if (v == null || !Number.isFinite(v)) return "";
  return v.toLocaleString("pt-BR", { maximumFractionDigits: casas });
}

/** Lê o que foi digitado no formato brasileiro ("619.886,12", "619886", "0,85"). Vazio = null. */
export function lerNumeroBr(texto: string): number | null {
  const t = texto.trim();
  if (!t || !/\d/.test(t)) return null;
  return toNumber(t);
}

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: number | null | undefined;
  onValor: (v: number | null) => void;
  casas?: number;
};

/**
 * Campo numérico que entende o formato brasileiro. O campo "number" do navegador lê
 * "619.886" como 619,886; este lê como 619 mil e mostra o número formatado.
 */
export function EntradaNumero({ value, onValor, casas = 6, onFocus, onBlur, ...rest }: Props) {
  const [texto, setTexto] = useState<string | null>(null);
  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={texto ?? formatarBr(value, casas)}
      onFocus={(e) => {
        setTexto(formatarBr(value, casas));
        onFocus?.(e);
      }}
      onChange={(e) => {
        setTexto(e.target.value);
        onValor(lerNumeroBr(e.target.value));
      }}
      onBlur={(e) => {
        setTexto(null);
        onBlur?.(e);
      }}
    />
  );
}
