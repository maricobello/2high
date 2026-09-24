/** `home: true` aparece na landing; as demais servem só de base para o assistente de IA. */
export const FAQ: { q: string; a: string; home?: boolean }[] = [
  {
    q: "Quanto custa?",
    a: "O diagnóstico e a auditoria não têm custo. Se houver valor a recuperar, a remuneração é um percentual do valor efetivamente recuperado, definido em contrato antes de começar. Sem recuperação, não há cobrança.",
    home: true,
  },
  {
    q: "O que a auditoria verifica?",
    a: "Classe e modalidade tarifária, leituras, consumo na ponta e fora ponta, demanda contratada e ultrapassagens, energia reativa, bandeiras, tributos e créditos de energia solar, em cada fatura do período.",
    home: true,
  },
  {
    q: "Como funciona a devolução?",
    a: "Pedimos à distribuidora, pela via administrativa, a devolução do que foi cobrado indevidamente. Quando o erro é da distribuidora, a regra da ANEEL prevê devolução em dobro, com correção (REN 1.000/2021). O resultado depende de comprovação.",
    home: true,
  },
  {
    q: "O que é o laudo de ICMS?",
    a: "Indústrias fora do Simples Nacional podem se creditar do ICMS da energia usada na produção (LC 87/96, art. 33). Um laudo de engenharia mede essa parcela; o crédito pode alcançar 5 anos, conforme as regras de cada estado.",
    home: true,
  },
  {
    q: "Preciso trocar de fornecedor?",
    a: "Não necessariamente. Muitos ajustes estão na própria conta: demanda, reativo e modalidade tarifária. Energia por assinatura ou Mercado Livre só são indicados quando fazem sentido para o seu perfil.",
    home: true,
  },
  {
    q: "Preciso instalar placas?",
    a: "Não. Na geração distribuída por assinatura, a energia é gerada em usinas remotas e os créditos são compensados na sua conta, quando disponível na área da sua distribuidora e aplicável ao seu perfil. Não há obra nem equipamento no seu imóvel.",
  },
  {
    q: "Minha empresa pode usar energia solar por assinatura?",
    a: "Empresas em baixa tensão (Grupo B) costumam ter perfil compatível, e unidades em média tensão também podem avaliar. A disponibilidade depende da distribuidora, da existência de projetos com capacidade e das regras de compensação vigentes. O diagnóstico indica se vale a avaliação.",
  },
  {
    q: "Como funciona o Mercado Livre?",
    a: "No Ambiente de Contratação Livre, a empresa compra energia diretamente de comercializadoras, negociando preço e prazo. Desde 2024, unidades do Grupo A (média/alta tensão) podem migrar — abaixo de 500 kW, por meio de um comercializador varejista. A elegibilidade e a economia dependem de validação técnica e comercial.",
  },
  {
    q: "Meus dados ficam seguros?",
    a: "Sim. A fatura é transmitida com criptografia, armazenada em ambiente privado com acesso restrito e usada apenas para gerar o diagnóstico e o contato comercial que você autorizou, conforme a LGPD. Você pode solicitar a exclusão a qualquer momento.",
  },
];
