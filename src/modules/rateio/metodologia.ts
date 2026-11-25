/** Texto da metodologia (tela e aba "Metodologia" do Excel). */
export const METODOLOGIA = [
  "Como o rateio proposto é calculado",
  "1. Consumo compensável: média mensal de consumo menos o custo de disponibilidade (30, 50 ou 100 kWh para mono, bi e trifásico). Para UCs já no rateio, usa o 'Consumo Compensável' do Orange.",
  "2. Alvo por UC: cobrir a fração definida (cobertura) do compensável. O restante é margem para queda de consumo.",
  "3. Saldo: a parte do saldo acima da reserva é consumida no horizonte definido. Essa queima mensal é descontada do crédito novo da UC. UC cujo saldo cobre todo o horizonte sai do rateio e volta a ser avaliada no próximo ciclo.",
  "4. Novas UCs: se a necessidade das UCs não absorve a injeção, entram candidatas elegíveis (sem duplicidade, fora de outra usina, compensável mínimo, mesma distribuidora). Primeiro as sem pendência de cadastro, das maiores para as menores; a última é a menor que fecha a conta.",
  "5. Percentual: proporcional à necessidade. Se ainda sobra injeção, ela ocupa primeiro a margem de cada UC (até 100% do compensável). Arredondamento pelo maior resto, com soma exatamente 100% e percentual mínimo por UC.",
  "6. Projeção mês a mês: crédito do mês abate o consumo; o que falta sai do saldo; a sobra vira saldo. Calculada para o rateio atual, o proposto e um cenário de estresse com consumo menor.",
  "7. Regras de referência: créditos valem 60 meses e os mais antigos são usados primeiro (REN ANEEL 1.000, art. 655-L); a alteração de percentuais vale a partir do ciclo de faturamento seguinte ao pedido (art. 655-H). Confirme com a distribuidora o número de casas decimais aceito.",
  "Os resultados são estimativas baseadas nas médias informadas e devem ser validados na fatura.",
];
