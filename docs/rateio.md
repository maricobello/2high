# Rateio GD

Ferramenta do admin (`/admin/rateio`) para revisar o rateio de créditos de usinas de
geração distribuída e entregar o estudo em Excel.

## Como usar

1. **Importar planilhas** (ou arrastar para a página). Pode mandar tudo de uma vez:
   - **Calendário de rateio** (aba "Acompanhamento"): vira a aba *Calendário*, com etapa,
     prazo e atraso de cada usina. "Analisar" abre a usina no estudo.
   - **UCs da usina**: export da *Unidade Rateio GD* do Orange ou a planilha modelo
     ("Análise do Rateio"). Colunas usadas: N° de Instalação, % do Rateio, Saldo kWh,
     Consumo Compensável kWh (e, se houver, Nome da Usina, ID, Apelido, Subgrupo,
     Consumo Compensado). Um export com várias usinas é separado pela coluna Nome da Usina.
     A planilha modelo também traz período, energia contratada, gerada, injetada e o
     "Máximo Compensável" (vira a cobertura).
   - **Novas UCs**: UC, Endereço ID, Tipo Tensão, Média kWh (Cons. Min opcional).
2. **Colar tabela**: copie do Orange ou do Excel, com o cabeçalho.
3. **Fatura e tela do Orange** (na aba da usina, ou arrastando o arquivo com a usina aberta):
   - **Fatura da usina (PDF)**: lida no navegador. Traz, mês a mês, energia injetada,
     excedente distribuído (o que de fato vai para o rateio), consumo da usina e saldo da
     geradora. Calibrada na fatura CELESC Grupo A de GD; meses zerados e o mês de entrada em
     operação ficam fora da média. "Usar no estudo" define a injeção mensal (e a sazonalidade,
     quando há 12 meses de operação).
   - **Recorte da tela de usinas do Orange** (bloco "Energia"): imagem (lida pelo modelo de
     visão da Groq; dá para colar com Ctrl+V) ou texto copiado da tela. Confere se o saldo
     fecha, se o saldo acumulado bate com a soma das UCs, se a injetada bate com a fatura e a
     divergência de faturamento. "Usar no estudo" preenche meses, energia contratada
     (Estimada), gerada e injetada do período.
   - **Automático**: cada leitura recebe uma nota de confiança (0 a 100) com os critérios à
     vista (o que foi encontrado e se os números fecham entre si e com a outra fonte). Com nota
     70 ou mais, entra no estudo sozinha; os meses do período da tela são descobertos cruzando
     com a fatura. Saldo que não fecha ou injetada que não bate com a fatura travam a nota abaixo
     de 70 (sinal de dígito lido errado). Edição manual nunca é sobrescrita.
   - **Para qual usina vão as UCs**: ao importar uma lista de UCs, a ferramenta pergunta o
     destino (sugere a usina aberta ou a do nome do arquivo) e avisa se o nome dentro da
     planilha for de outra usina.
   - **Ganho em R$**: informe a tarifa média das UCs e o estudo mostra quanto o rateio proposto
     compensa a mais que o atual, em kWh e em reais (estimativa).
4. Confira **Dados da usina** (a injeção é obrigatória) e os **Parâmetros**.
5. Revise os **pontos de atenção** e a tabela por UC (toque numa linha para ver o motivo).
6. **Gerar parecer** (texto padrão ou redigido pela IA, com os números conferidos).
7. **Exportar estudo** (todas as usinas, ou "Exportar esta usina"): Excel no formato
   "prontuário", pronto para envio e impressão em A4:
   - *Estudo* (por usina): página 1 com identificação, resultado em 4 números, conduta (o que
     muda), validação ✓/✗ e pontos de atenção; página 2 com parecer e assinaturas;
   - *Envio* (por usina): só instalação e percentual, soma 100%;
   - *Detalhe por UC*, *Novas UCs* e *Memória de cálculo* (parâmetros, fontes, projeção e
     metodologia).
   A identidade (empresa, cor, logo, responsável técnico) é definida em Parâmetros →
   Identidade do estudo; "Usar cores da Replace" aplica o laranja do logo.
8. **Planilha modelo**: a planilha do dia a dia ("Análise do Rateio" + "Novas UCs") preenchida
   pelo sistema, com as fórmulas originais (estendidas para quantas UCs houver) e duas colunas a
   mais: rateio proposto pelo sistema e ação. O modelo em branco pode ser baixado na tela
   inicial; importado vazio, não cria usina.

Os arquivos são lidos no navegador e ficam salvos só nele (botão de lixeira apaga).
Para o parecer, só sai um resumo com totais e apelidos, sem número de instalação.

## Metodologia

O texto completo fica em `src/modules/rateio/metodologia.ts` (aba Metodologia da tela e
do Excel).

### Otimizado (padrão)

Programação linear inteira mista resolvida com HiGHS (WebAssembly, num Web Worker do
navegador; nenhum dado sai do computador). Como todas as UCs são do mesmo cliente,
compensar mais energia é o que vale (cada kWh compensado é um kWh a menos comprado da
distribuidora), e isso equivale a deixar menos saldo parado. Como o saldo é de cada UC, o
modelo acompanha UC por UC, mês a mês:

- variáveis: percentual de cada UC, crédito usado por UC e mês, inclusão de candidata
  (binária), permanência de UC atual (binária);
- restrições: soma 100%, saldo de cada UC nunca negativo mês a mês, mínimo por UC,
  cada candidata em no máximo uma usina;
- objetivo: maximizar a energia compensada em dois cenários (consumo médio 60%,
  consumo menor 40%), com custo por UC incluída e desempates (mudar pouco o rateio
  atual, manter a reserva de saldo).

A tela mostra a comparação com o rateio atual e com a regra proporcional, a validação
antes do envio e a ficha de cada UC (diagnóstico, números e saldo mês a mês).

Com cerca de 160 UCs e 80 candidatas, a solução ótima sai em poucos segundos.

### Regra proporcional (comparação)

- **Necessidade de cada UC** = compensável × cobertura, reduzida quando a UC tem saldo
  acima da reserva: o excesso é gasto no horizonte definido. A margem (1 − cobertura)
  também sai do saldo enquanto ele existir.
- **Novas UCs** entram quando a necessidade não absorve a injeção: sem duplicidade, fora
  de outra usina, mesma distribuidora, acima do compensável mínimo. Primeiro as sem
  pendência de cadastro, das maiores para as menores; a última é a menor que fecha a conta.
  "Gastar o saldo no horizonte" agrega mais consumo; "Só equilibrar a usina" agrega só o
  que falta sem contar a queima.
- **Percentual** proporcional à necessidade, arredondado pelo maior resto (soma 100%,
  mínimo por UC). Sobra de injeção ocupa primeiro a margem de cada UC.
- **Projeção** mês a mês para o rateio atual, o proposto e um cenário de consumo menor,
  com sazonalidade opcional.

Regras de referência: créditos valem 60 meses e os mais antigos são usados primeiro
(REN ANEEL 1.000, art. 655-L); a alteração vale no ciclo seguinte ao pedido (art. 655-H).
Casas decimais aceitas variam por distribuidora (CPFL: até 2); confirme com a CELESC.

## Código

| Parte | Arquivo |
|---|---|
| Motor (necessidade, candidatas, arredondamento, projeção, alertas, diagnóstico, validação) | `src/modules/rateio/engine.ts` |
| Modelo de otimização (MILP) e worker do HiGHS | `src/modules/rateio/otimizador.ts`, `src/modules/rateio/otimizador.worker.ts` |
| Leitura de tabelas (cabeçalhos, calendário, planilha modelo) | `src/modules/rateio/grid.ts` |
| Fatura da usina (PDF) e tela do Orange | `src/modules/rateio/pdf.ts`, `fatura.ts`, `painel.ts`, `src/components/admin/rateio/fontes.tsx` |
| Excel (leitura e exportação, no navegador) | `src/modules/rateio/xlsx.ts` |
| Parecer (resumo agregado e texto padrão) | `src/modules/rateio/parecer.ts`, `src/modules/llm/tasks/rateio.ts` |
| Tela | `src/components/admin/rateio/` |
| Testes | `tests/rateio.test.ts`, `tests/rateio-otimizador.test.ts`, `tests/rateio-fontes.test.ts`, `e2e/rateio.spec.ts` |
