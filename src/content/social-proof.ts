/**
 * Prova social: adicione SOMENTE depoimentos/casos reais e autorizados.
 * Enquanto a lista estiver vazia, a seção não é exibida.
 */
export interface Testimonial {
  quote: string;
  author: string;
  role: string;
  company: string;
}

export const TESTIMONIALS: Testimonial[] = [];
