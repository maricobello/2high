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
     A planilha modelo também traz período, energia contratada, gerada, injetada, consumo
     mensal e o "Máximo Compensável" (fica só como referência: o sistema calcula o ótimo).
   - **Novas UCs**: UC, Endereço ID, Tipo Tensão, Média kWh (Cons. Min opcional).
   - **Relatório Gerencial GD** (Orange, uma competência): cria a usina com o nome do relatório
     (ou completa a existente com as mesmas UCs), lê o consumo mínimo de cada UC (R$ ÷ tarifa) e
     leva o total da competência para "Energia consumida". Não traz saldo: a lista Unidade
     Rateio GD continua sendo a base das UCs quando existe.
2. **Colar tabela**: copie do Orange ou do Excel, com o cabeçalho.
3. **Fatura e tela do Orange** (na aba da usina, ou arrastando o arquivo com a usina aberta):
   - **Fatura da usina (PDF)**: lida no navegador. Traz, mês a mês, energia injetada,
     excedente distribuído (o que de fato vai para o rateio), consumo da usina e saldo da
     geradora. Lê qualquer layout em camadas: tabelas mês a mês (CELESC), histórico em gráfico de
     barras (RGE/CPFL), valores soltos do mês ("kWh Injetado", saldo por posto, leitura do
     medidor) e itens em kW. **IA com aprendizado**: quando as regras e o layout aprendido não
     chegam à nota 70 (ou em "Reler com IA"), a Groq lê o texto da fatura anonimizado (sem CNPJ,
     CPF, instalação, chaves, endereço e contatos). Só vale número que aparece na fatura; quando
     regras e IA leem a mesma injetada, conta como conferência. Em cada leitura com IA o sistema
     guarda, por distribuidora, o rótulo que vem antes de cada valor (ex.: "kwh injetado fponta")
     em `rateio/layouts-fatura.json` no armazenamento privado (só rótulos, nenhum dado de cliente).
     Na próxima fatura da mesma distribuidora, o layout aprendido lê sem IA; a tela mostra "IA em
     X de Y leituras". Fatura com só o mês de referência é conferida com a leitura do
     medidor e não substitui a média de um período maior da tela do Orange. Meses zerados e o
     mês de entrada em operação ficam fora da média. "Usar no estudo" define a injeção mensal (e a sazonalidade,
     quando há 12 meses de operação). Também lê a **demanda** (contratada, registrada, ultrapassagem
     e a despesa com ultrapassagem), que vai para "Dados da usina", para a planilha modelo (N4:N6) e
     vira ponto de atenção quando há ultrapassagem (não muda o rateio; é custo da usina).
   - **Recorte da tela de usinas do Orange** (bloco "Energia"): imagem (lida pelo modelo de
     visão da Groq; dá para colar com Ctrl+V) ou texto copiado da tela. Confere se o saldo
     fecha, se o saldo acumulado bate com a soma das UCs, se a injetada bate com a fatura e a
     divergência de faturamento. "Usar no estudo" preenche meses, energia contratada
     (Estimada), gerada (Geração Realizada) e injetada (Injetada) do período. Os valores entram
     mesmo sem saber os meses (vêm da fatura, da planilha ou digitados); com fatura de 1 mês só
     (RGE/CPFL), a conferência do período fica neutra e, quando os meses são conhecidos, a
     injeção do estudo usa a média do período do Orange.
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
4. Confira **Dados da usina** (a injeção é obrigatória) e os **Parâmetros**. No topo:
   - **Status** (verde "Tudo ok", amarelo com avisos, vermelho com pendências, azul calculando):
     abre o resumo por usina (energia, otimização, % do limite físico, validação) e o
     **registro do cálculo** (importações, otimização, máximo compensável escolhido, resultado).
   - **Recalcular**: refaz otimização, refino, máximo compensável e validação.
   - **Energia consumida no período**: com o início e o fim do período preenchidos, abre um campo
     por competência. Para cada uma: Orange → Relatório Gerencial GD → competência → última aba →
     total. Dá para colar a coluna do Excel no primeiro mês. Total e média aparecem na hora; a
     média entra no balanço (consumida ÷ contratada) e na planilha modelo (S4:T12). É a soma do
     consumo de todas as UCs; sem valores digitados, o sistema usa sozinho uma estimativa (soma do
     consumo compensável das UCs, um pouco abaixo do real), marcada como "estimada".
   - **Máximo compensável** (card na usina, **automático**): quanto do consumo de cada UC o
     crédito novo cobre (o resto sai do saldo da UC). No otimizado é livre por UC; para a regra
     proporcional e para a planilha modelo (M8), o sistema faz uma busca livre (1% a 200% e 0% a
     200%, do grosso para o fino até 0,1 ponto) e usa o melhor valor sozinho, sem "aplicar"; a
     planilha exportada já sai com o M8 ótimo. Para fixar um valor, desmarque "Automático" em
     Parâmetros. A comparação de métodos ganha "Do limite físico possível" e
     "Máximo compensável efetivo".
   - **Valor do kWh por subgrupo** (Parâmetros, opcional): com R$/kWh por subgrupo (ex.: A4 e
     B3), o otimizado maximiza reais e o ganho em R$ é calculado UC a UC.
5. Revise os **pontos de atenção** e a tabela por UC (toque numa linha para ver o motivo).
6. **Gerar parecer** (texto padrão ou redigido pela IA, com os números conferidos).
7. **Exportar** (botão "Exportar estudo", ou "Exportar" na usina) abre o popup: marque as usinas
   (em andamento ou concluídas) e escolha o formato. Planilha modelo com mais de uma usina sai
   num .zip (uma planilha por usina).
   - **PDF executivo** (para enviar): por usina, página 1 com o resumo, página 2 com parecer e
     assinaturas, e o Anexo I com as UCs (maior consumo primeiro, barra no consumo). Gerado no
     navegador, texto selecionável, fonte Geist embutida. Sem parecer gerado, entra o padrão.
   - **Excel completo** (para trabalhar), no formato "prontuário", pronto para impressão em A4:
   - *Estudo* (por usina): página 1 com identificação, resultado em 4 números, conduta (o que
     muda), validação ✓/✗ e pontos de atenção; página 2 com parecer e assinaturas;
   - *Anexo I* (por usina): tabela de todas as UCs, como estão hoje e como ficam (situação,
     % atual, % proposto, variação, ação, consumo e saldo), com totais e cabeçalho repetido
     em cada página;
   - *Envio* (por usina): só instalação e percentual, soma 100%;
   - *Detalhe por UC*, *Novas UCs* e *Memória de cálculo* (parâmetros, fontes, projeção e
     metodologia).
   A identidade (empresa, cor, logo, responsável técnico) é definida em Parâmetros →
   Identidade do estudo; "Usar cores da Replace" aplica o laranja do logo.
8. **Planilha modelo** (no mesmo popup, quando é uma usina): a planilha do dia a dia ("Análise do Rateio" + "Novas UCs") preenchida
   pelo sistema, com as fórmulas originais (estendidas para quantas UCs houver) e duas colunas a
   mais: rateio proposto pelo sistema e ação. O modelo em branco pode ser baixado na tela
   inicial; importado vazio, não cria usina.

9. **Concluir**: na usina, "Concluir" guarda o resultado do dia e tira a usina das abas (e do
   cálculo). Ela fica em **Concluídos**, de onde dá para exportar de novo ou reabrir. Reimportar UCs
   numa usina concluída reabre o rateio.

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
- objetivo: maximizar a energia compensada (ou os reais, com valor por subgrupo) em dois
  cenários (consumo médio 60%, consumo menor 40%), com custo por UC incluída e desempates
  (mudar pouco o rateio atual, manter a reserva de saldo).

**Refino exato** (`refinar.ts`): o objetivo se separa por UC e o ganho de cada UC é côncavo no
percentual. Partindo do ótimo contínuo arredondado, o refino troca 1%, 0,1% … até a última
casa decimal entre pares de UCs enquanto houver ganho; sem troca que melhore, é o ótimo global
na grade da distribuidora (teste confere com força bruta). Na Safira: +1.428 kWh em 12 meses
sobre o simples arredondamento.

**Limite físico**: nenhum rateio compensa mais que Σ min(consumo, saldo) + min(injeção, consumo
que o saldo não cobre). A comparação mostra quanto de cada rateio chega a esse teto.

A tela mostra a comparação com o rateio atual e com a regra proporcional, a validação
antes do envio e a ficha de cada UC (diagnóstico, números e saldo mês a mês).

Com cerca de 160 UCs e 80 candidatas, a solução ótima sai em poucos segundos.

### Máximo compensável

- **Otimizado**: livre. O modelo decide quanto do compensável de cada UC o crédito novo cobre;
  o efetivo (crédito ÷ compensável) aparece no card e na comparação.
- **Regra proporcional**: parâmetro, sem valor padrão. O ótimo é uma busca livre de 1% a 200%
  (grade de 5 pontos, depois 1 ponto em volta dos 3 melhores e 0,1 ponto em volta do melhor; a
  curva tem vales) com a projeção completa em cada ponto e o critério do otimizador. Roda num
  Web Worker e entra sozinho.
- **Planilha modelo (M8)**: a regra dela é L = saldo × 30% (se compensável + agregado > injeção),
  M = L > compensável ? compensável × M8 : compensável − L, N = M ÷ ΣM. O M8 só muda o
  percentual das UCs que gastariam mais saldo que o compensável. **Não há valor padrão**: o
  sistema faz a busca livre (0% a 200%) com o mesmo critério do otimizador (compensação das UCs
  nos dois cenários, valor do kWh por subgrupo, saldo encalhado no fim, reserva e estabilidade);
  empate fica com o valor cuja fórmula mais se aproxima do rateio do sistema. Sem UC afetada, a
  fórmula dá o mesmo rateio para qualquer M8 e vai o máximo compensável efetivo do rateio do
  sistema. O valor que a planilha usava só serve para mostrar o ganho.

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
| Fatura da usina (PDF), demanda e tela do Orange | `src/modules/rateio/pdf.ts`, `fatura.ts`, `demanda.ts`, `painel.ts`, `src/components/admin/rateio/fontes.tsx` |
| Fatura com IA e layouts aprendidos | `src/modules/rateio/fatura-ia.ts`, `layout.ts`, `src/app/api/admin/rateio/fatura`, `.../layouts` |
| Excel (leitura e exportação, no navegador) | `src/modules/rateio/xlsx.ts` |
| Parecer (resumo agregado e texto padrão) | `src/modules/rateio/parecer.ts`, `src/modules/llm/tasks/rateio.ts` |
| Tela | `src/components/admin/rateio/` |
| Máximo compensável ótimo, limite físico e energia consumida | `src/modules/rateio/otimo-cobertura.ts`, `cobertura.worker.ts`, `consumo.ts` |
| Refino exato e valor por subgrupo | `src/modules/rateio/refinar.ts`, `src/modules/rateio/valor.ts` |
| Testes | `tests/rateio.test.ts`, `tests/rateio-otimizador.test.ts`, `tests/rateio-fontes.test.ts`, `tests/rateio-maximo.test.ts`, `e2e/rateio.spec.ts` |
