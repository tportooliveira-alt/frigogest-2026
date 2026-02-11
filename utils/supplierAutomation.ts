// Automação de WhatsApp para Fornecedores
// Envia pedidos automáticos, consultas de preço, alertas de estoque baixo

import { sendWhatsAppMessage, sendWhatsAppMedia } from './whatsappAPI';

export interface SupplierMessage {
    supplierName: string;
    phone: string;
    messageType: 'pedido' | 'consulta_preco' | 'alerta_estoque' | 'pagamento';
    data?: any;
}

/**
 * Envia pedido automático para fornecedor
 */
export async function sendSupplierOrder(
    supplierName: string,
    phone: string,
    products: Array<{ name: string; quantity: number; unit: string }>
) {
    const productList = products
        .map((p, i) => `${i + 1}. *${p.name}*: ${p.quantity}${p.unit}`)
        .join('\n');

    const message =
        `Olá! 👋\n\n` +
        `📋 *PEDIDO FRIGOGEST*\n\n` +
        `Fornecedor: *${supplierName}*\n\n` +
        `*Itens Solicitados:*\n${productList}\n\n` +
        `🚚 Quando pode entregar?\n` +
        `💰 Qual o valor total?\n\n` +
        `Aguardo retorno! 🤝`;

    return await sendWhatsAppMessage(phone, message);
}

/**
 * Consulta preços com fornecedor
 */
export async function requestSupplierPricing(
    supplierName: string,
    phone: string,
    products: string[]
) {
    const productList = products.map((p, i) => `${i + 1}. ${p}`).join('\n');

    const message =
        `Bom dia! 👋\n\n` +
        `💵 *CONSULTA DE PREÇOS*\n\n` +
        `Poderia passar os preços atualizados de:\n\n` +
        `${productList}\n\n` +
        `Preciso fechar compra hoje!\n\n` +
        `Obrigado! 🙏`;

    return await sendWhatsAppMessage(phone, message);
}

/**
 * Alerta de estoque baixo (envia para fornecedor)
 */
export async function sendLowStockAlert(
    supplierName: string,
    phone: string,
    product: string,
    currentStock: number,
    minStock: number
) {
    const message =
        `🚨 *ALERTA DE ESTOQUE*\n\n` +
        `Produto: *${product}*\n` +
        `Estoque atual: ${currentStock}kg\n` +
        `Estoque mínimo: ${minStock}kg\n\n` +
        `⚠️ Preciso repor urgente!\n\n` +
        `Você tem disponível?\n` +
        `Qual prazo de entrega?\n\n` +
        `Aguardo! 📞`;

    return await sendWhatsAppMessage(phone, message);
}

/**
 * Confirma pagamento para fornecedor
 */
export async function sendPaymentConfirmation(
    supplierName: string,
    phone: string,
    amount: number,
    paymentMethod: string,
    reference?: string
) {
    const message =
        `✅ *PAGAMENTO REALIZADO*\n\n` +
        `Fornecedor: *${supplierName}*\n` +
        `Valor: R$ ${amount.toFixed(2)}\n` +
        `Forma: ${paymentMethod}\n` +
        (reference ? `Referência: ${reference}\n` : '') +
        `\n` +
        `Confirma o recebimento? 🤝\n\n` +
        `Obrigado pela parceria!`;

    return await sendWhatsAppMessage(phone, message);
}

/**
 * Envia cotação para múltiplos fornecedores
 */
export async function sendBulkQuoteRequest(
    suppliers: Array<{ name: string; phone: string }>,
    products: string[],
    deadline: string
) {
    const results = [];
    const productList = products.map((p, i) => `${i + 1}. ${p}`).join('\n');

    for (const supplier of suppliers) {
        const message =
            `Bom dia, *${supplier.name}*! 👋\n\n` +
            `📊 *PEDIDO DE COTAÇÃO*\n\n` +
            `Produtos:\n${productList}\n\n` +
            `⏰ Prazo: ${deadline}\n` +
            `💰 Preciso de preço e condições\n\n` +
            `Pode me passar? Obrigado! 🙏`;

        const result = await sendWhatsAppMessage(supplier.phone, message);
        results.push({ supplier: supplier.name, ...result });

        // Delay de 3 segundos entre cada mensagem
        await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    return results;
}

/**
 * Templates prontos para fornecedores (com coisas que agradam!)
 */
export const SUPPLIER_TEMPLATES = {
    bom_dia: (name: string) =>
        `Bom dia, *${name}*! 👋\n\nTudo bem com você e a família? 😊\nComo estão os preços hoje? 📊`,

    urgente: (name: string, product: string) =>
        `🚨 *URGENTE* 🚨\n\nPreciso de ${product} HOJE!\n\nConsigo contar com você? É pra cliente especial! 💨`,

    negociacao: (name: string, price: number) =>
        `Olá *${name}*! 👋\n\nRecebi proposta de R$ ${price.toFixed(2)}.\n\nMas prefiro fechar com você que é parceiro de confiança! 🤝\nConsegue igualar? Posso fechar grande volume! 💰`,

    agradecimento: (name: string) =>
        `Obrigado pela entrega, *${name}*! ✅\n\n🌟 Qualidade IMPECÁVEL como sempre!\n🏆 Você é nosso fornecedor TOP!\n\nContinuamos fazendo negócio! 🙌`,

    bonus: (name: string, bonus: number) =>
        `🎁 *SURPRESA PARA VOCÊ!* 🎁\n\n*${name}*, pela parceria incrível,\nvamos dar um BÔNUS de R$ ${bonus.toFixed(2)}\nno próximo pedido!\n\n💙 Obrigado por ser nosso fornecedor estrela! ⭐`,

    aniversario: (name: string) =>
        `🎂🎉 *PARABÉNS, ${name}!* 🎉🎂\n\nMuita saúde, paz e prosperidade!\n🙏 Que Deus abençoe você e sua família!\n\n🎁 Preparamos um desconto especial\npara comemorar com você! 💝`,

    fidelidade: (name: string, months: number) =>
        `🏆 *PARCEIRO FIEL!* 🏆\n\n*${name}*, já são *${months} meses*\nde parceria de sucesso! 🎯\n\n✨ Você faz parte da nossa história!\n💙 Conte sempre conosco!\n\n🎁 Desconto VIP ativado! ⭐`,
};
