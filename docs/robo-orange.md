# Robô do Orange (rateio GD)

O objetivo é fazer os rateios de GD da Replace (usinas da TIM e de outros clientes) com dados puxados direto do Orange System, sem exportar planilha à mão.

## Uso no dia a dia (rateio)

1. Abra **Admin › Rateio GD** e clique em **Buscar no Orange**.
2. Informe as usinas (ex.: `Ibititá, Alto do Pajeú I`). Pode escrever sem acento e sem "UFV". O limite é de 30 por vez.
3. Informe a competência (`MM/AAAA`).
4. O robô entra no Orange na hora e traz, por usina:
   - a planilha de **UCs do rateio**, que é a mesma da tela Unidade Rateio GD;
   - a planilha do **Relatório Gerencial**, com o consumo total da competência.

   O rateio importa as duas como se fossem arquivos enviados e calcula na hora.
5. Ajuste o que precisar no rateio e clique em **Baixar planilha** para obter o modelo preenchido.

Essa busca não depende do banco do site.

## Coleta automática e economia

Fica em **Admin › Integrações › Robô do Orange**.

- **Agenda:** roda sozinha do dia 6 ao 12 de cada mês (cron `/api/cron/orange`), sempre na competência fechada anterior.
- **Como trabalha:** cada rodada dura até cerca de 45 s. Ela baixa as UCs em lotes paralelos e lê o Relatório Gerencial em 6 usinas ao mesmo tempo. O que faltar fica para a rodada seguinte; o botão **Continuar** força uma nova rodada.
- **O que guarda:** os resultados vão para o banco, em `orange/coletas/AAAA-MM/` e no índice `orange/coletas/ultimo.json`.
- **Economia:** o quadro de economia soma `NrEconomiaUC`, `NrEnergiaCompensada` e `NrEnergiaTotalConsumida` do Relatório Gerencial. São os valores do próprio Orange.
- **Banco:** o banco é o projeto Supabase **aferi**. No plano gratuito ele pausa por inatividade; para reativar, use **Restore project**.

## Endereços do Orange (somente consulta)

Todos foram tirados do JavaScript público das telas. A sessão é aberta pelo login do formulário.

| Uso | Método e caminho | Parâmetros |
|---|---|---|
| Login | `POST /Login/Login` | `U`, `Tx_Email`, `Tx_Senha` (form). Se der erro, volta 302 para `/Login` com a mensagem em `#msgerro`. |
| Usinas do usuário | `GET /cadastrousinagd/usinausuario` | `data[]`: `Id_Usina`, `Tx_NomeUsina`, `Tx_Apelido`, `DistribuidoraNome` |
| UCs do rateio | `POST /unidaderateiogd/getpercentualrateiobyidsusina` | JSON `{usinaIds:[Id_Usina], competencia:"MM/AAAA"}`. Devolve `data[]` com `Nr_Numero_Instalacao`, `Tx_Apelido`, `Tx_SubGrupo`, `Nr_Percentual`, `Nr_Saldo_Kwh`, `Nr_MediaConsumoCompensavel_Kwh`, `Nr_MediaEnergiaCompensada_Kwh` e `Nr_RsKwh` (cada um também com a versão `_F`, formatada) |
| Status do relatório | `GET /gestaousinagd/resumoprocessamentocompetencia` | `id_usina`, `competencia=MM/AAAA`. `data.Nr_Status == 2` indica relatório processado |
| Clientes da usina | `GET /GestaoUsinaGD/GetClientesUsina/{Id_Usina}` | `data[]`: `Id`, `Titulo` (escolhe o cliente TIM) |
| Relatório Gerencial | `GET /GestaoUsinaGD/List` | `ClienteId`, `UsinaId`, `Competencia=MM/AAAA`. Devolve `data.list[].aaData[]` com `NrEnergiaTotalConsumida`, `NrEnergiaCompensada`, `PercentualRateioCompetencia`, `NrSaldoMensal`, `NrFaturaSimulada`, `NrFaturaRecebida`, `NrEconomiaUC` e `Nr_DespesaTotal_Final` |

**Nunca chamar** (são ações que gravam no Orange): `abrircadeado`, `aprovarversao`, `criarversao`, `RecalcularEnergia`, `ImportarTotalGD`, `SalvarAlteracoesDespesaTotal`, `InsertSchedule*` e `DeleteTotvsCgc_Pedido`.

## Código

- `src/modules/orange/cliente.ts`: sessão e login. Lê os segredos `ORANGE_USUARIO` e `ORANGE_SENHA`, guardados na Vercel como Sensitive.
- `src/modules/orange/gd.ts`: leitura das usinas, das UCs e do Relatório Gerencial, e geração das planilhas.
- `src/modules/orange/coleta.ts`: coleta automática, retomável e em paralelo.
- `src/app/api/admin/orange/buscar`: busca na hora, usada pelo Rateio GD.
- `src/app/api/admin/orange/coleta`: a coleta em si, mais o filtro de usinas.
- `src/app/api/cron/orange`: o cron mensal.

Regras: dados de clientes (UCs, faturas) nunca entram no repositório, e a senha nunca aparece no chat nem nos logs.
