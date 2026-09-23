/**
 * Normalização e comparação de telefones brasileiros.
 * O WhatsApp pode enviar o número com DDI (55) e, em números antigos, sem o 9º dígito.
 * Dois números só "casam" se o DDD for igual e os 8 últimos dígitos forem iguais.
 */
export function nationalNumber(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
  if (d.length > 11 && d.startsWith("0")) d = d.replace(/^0+/, "");
  return d;
}

export function samePhone(a: string, b: string): boolean {
  const x = nationalNumber(a);
  const y = nationalNumber(b);
  if (x.length < 10 || y.length < 10) return false;
  return x.slice(0, 2) === y.slice(0, 2) && x.slice(-8) === y.slice(-8);
}
