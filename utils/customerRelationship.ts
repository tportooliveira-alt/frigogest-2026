// Sistema de Relacionamento com Clientes
// Mensagens que AGRADAM e FIDELIZAM clientes

import { sendWhatsAppMessage, sendWhatsAppMedia } from './whatsappAPI';

/**
 * 🎂 Mensagem de Aniversário (COM DESCONTO!)
 */
export async function sendBirthdayMessage(
    clientName: string,
    phone: string,
    discountPercent: number = 10
) {
    const message =
        `🎂🎉 *FELIZ ANIVERSÁRIO, ${clientName}!* 🎉🎂\n\n` +
        `Que este dia seja repleto de alegrias! 🎈\n` +
        `Muita saúde, paz e prosperidades! 🙏\n\n` +
        `🎁 *PRESENTE ESPECIAL:*\n` +
        `${discountPercent}% de desconto em qualquer compra\n` +
        `válido até o fim do mês! 💝\n\n` +
        `Aproveite! Você merece! ⭐`;

    return await sendWhatsAppMessage(phone, message);
}

/**
 * 🏆 Mensagem de Cliente VIP
 */
export async function sendVIPUpgrade(clientName: string, phone: string) {
    const message =
        `👑 *PARABÉNS, ${clientName}!* 👑\n\n` +
        `Você agora é *CLIENTE VIP*! 🌟\n\n` +
        `*Benefícios exclusivos:*\n` +
        `✅ Prioridade nas entregas\n` +
        `✅ Descontos progressivos\n` +
        `✅ Produtos reservados\n` +
        `✅ Atendimento preferencial\n\n` +
        `💙 Obrigado pela confiança! 🤝`;

    return await sendWhatsAppMessage(phone, message);
}

/**
 * 🎁 Programa de Pontos/Cashback
 */
export async function sendPointsBalance(
    clientName: string,
    phone: string,
    points: number,
    cashValue: number
) {
    const message =
        `⭐ *SALDO DE PONTOS* ⭐\n\n` +
        `*${clientName}*, você tem:\n\n` +
        `🎯 ${points} pontos acumulados\n` +
        `💰 Equivale a R$ ${cashValue.toFixed(2)}\n\n` +
        `*Resgatar em:*\n` +
        `• Desconto na próxima compra\n` +
        `• Produtos exclusivos\n` +
        `• Brindes especiais\n\n` +
        `Quer usar agora? 🎁`;

    return await sendWhatsAppMessage(phone, message);
}

/**
 * 💝 Brinde/Presente Surpresa
 */
export async function sendGiftNotification(
    clientName: string,
    phone: string,
    gift: string
) {
    const message =
        `🎁 *PRESENTE PARA VOCÊ!* 🎁\n\n` +
        `*${clientName}*, preparamos\numa surpresa especial! 💝\n\n` +
        `Na sua próxima compra,\nvocê ganha de BRINDE:\n` +
        `🎉 *${gift}* 🎉\n\n` +
        `Não precisa fazer nada,\né só retirar! 😊\n\n` +
        `Obrigado pela preferência! 💙`;

    return await sendWhatsAppMessage(phone, message);
}

/**
 * 🔥 Promoção Relâmpago
 */
export async function sendFlashPromo(
    clientName: string,
    phone: string,
    product: string,
    oldPrice: number,
    newPrice: number,
    validUntil: string
) {
    const discount = ((1 - newPrice / oldPrice) * 100).toFixed(0);

    const message =
        `⚡ *PROMOÇÃO RELÂMPAGO!* ⚡\n\n` +
        `*${clientName}*, CORRE! 🏃‍♂️\n\n` +
        `🥩 *${product}*\n` +
        `~~R$ ${oldPrice.toFixed(2)}~~ ❌\n` +
        `💥 R$ ${newPrice.toFixed(2)} 💥\n` +
        `📉 *${discount}% OFF!*\n\n` +
        `⏰ Válido ATÉ: ${validUntil}\n\n` +
        `Aproveite AGORA! Estoque LIMITADO! 🔥`;

    return await sendWhatsAppMessage(phone, message);
}

/**
 * 🌟 Agradecimento Pós-Compra
 */
export async function sendThankYouMessage(
    clientName: string,
    phone: string,
    orderValue: number
) {
    const message =
        `💙 *MUITO OBRIGADO!* 💙\n\n` +
        `*${clientName}*, sua compra de\nR$ ${orderValue.toFixed(2)} foi confirmada! ✅\n\n` +
        `🌟 Você é ESPECIAL para nós!\n` +
        `🙏 Valorizamos muito sua confiança!\n\n` +
        `Qualquer dúvida, estamos aqui! 📞\n\n` +
        `Até a próxima! 🤝`;

    return await sendWhatsAppMessage(phone, message);
}

/**
 * 📊 Satisfação do Cliente
 */
export async function sendSatisfactionSurvey(clientName: string, phone: string) {
    const message =
        `⭐ *SUA OPINIÃO IMPORTA!* ⭐\n\n` +
        `*${clientName}*, como foi\nsua experiência conosco? 😊\n\n` +
        `De 0 a 10, que nota você dá?\n\n` +
        `Sua avaliação nos ajuda\na melhorar sempre! 💙\n\n` +
        `🎁 E você ainda ganha\n5% de desconto na próxima! 🎉`;

    return await sendWhatsAppMessage(phone, message);
}

/**
 * 🎯 Oferta Personalizada
 */
export async function sendPersonalizedOffer(
    clientName: string,
    phone: string,
    favoriteProduct: string,
    specialPrice: number
) {
    const message =
        `🎯 *OFERTA SÓ PARA VOCÊ!* 🎯\n\n` +
        `*${clientName}*, sabemos que\nvocê AMA *${favoriteProduct}*! 😍\n\n` +
        `Então fizemos um preço\n*EXCLUSIVO*:\n` +
        `💰 R$ ${specialPrice.toFixed(2)}\n\n` +
        `☑️ Só válido para VOCÊ!\n` +
        `☑️ Quantidade ilimitada!\n` +
        `☑️ Entrega prioritária!\n\n` +
        `Aproveita? 🤝`;

    return await sendWhatsAppMessage(phone, message);
}

/**
 * 🔔 Lembrete Amigável (Sem Cobrança Agressiva)
 */
export async function sendFriendlyReminder(
    clientName: string,
    phone: string,
    daysOverdue: number,
    amount: number
) {
    const message =
        `👋 Oi *${clientName}*!\n\n` +
        `Tudo bem com você? 😊\n\n` +
        `Passando aqui para lembrar\nque tem um boleto em aberto:\n` +
        `💰 R$ ${amount.toFixed(2)}\n` +
        `📅 Venceu há ${daysOverdue} dias\n\n` +
        `🤝 Se já pagou, ignore!\n` +
        `💳 Se precisar renegociar, chama!\n\n` +
        `Estamos aqui para ajudar! 💙`;

    return await sendWhatsAppMessage(phone, message);
}

/**
 * 🎪 Templates Sazonais
 */
export const SEASONAL_TEMPLATES = {
    natal: (name: string) =>
        `🎄🎅 *FELIZ NATAL, ${name}!* 🎅🎄\n\n` +
        `Que esta data seja repleta de\npaz, amor e união! 🙏\n\n` +
        `🎁 PRESENTE DE NATAL:\n15% OFF em todo nosso estoque!\n\n` +
        `Aproveite! 💝`,

    ano_novo: (name: string) =>
        `🎊🥂 *FELIZ ANO NOVO, ${name}!* 🥂🎊\n\n` +
        `✨ Que 2026 seja incrível!\n💰 Muito sucesso e prosperidade!\n\n` +
        `🎉 Começando o ano com DESCONTO:\n20% OFF na primeira compra! 🚀`,

    pascoa: (name: string) =>
        `🐰🥚 *FELIZ PÁSCOA, ${name}!* 🥚🐰\n\n` +
        `Muita paz e renovação! 🙏\n\n` +
        `🎁 Presente de Páscoa:\n10% OFF + BRINDE surpresa! 💝`,

    dia_do_cliente: (name: string) =>
        `🏆 *DIA DO CLIENTE!* 🏆\n\n` +
        `*${name}*, VOCÊ é o motivo\ndo nosso sucesso! 💙\n\n` +
        `🎉 Hoje é SEU dia!\n25% OFF em tudo! 🎁\n\n` +
        `OBRIGADO por confiar em nós! 🙏`,
};
