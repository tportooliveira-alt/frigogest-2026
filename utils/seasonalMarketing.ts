// Templates de Marketing Sazonal - THIAGO 704
// Mensagens prontas para envio em datas comemorativas

import { sendWhatsAppMessage, sendWhatsAppMedia } from './whatsappAPI';

/**
 * 🎭 CARNAVAL 2026 - MENSAGEM PRONTA
 */
export const CARNAVAL_2026 = {
    message: `
🎭🎉 *FELIZ CARNAVAL!* 🎉🎭

*THIAGO 704* deseja a você e sua família
um CARNAVAL repleto de alegria! 🎊

🥩 *PROMOÇÃO DE CARNAVAL:*
━━━━━━━━━━━━━━━━━━━
🔥 Picanha Premium: R$ 45,90/kg
🔥 Alcatra Especial: R$ 38,90/kg  
🔥 Costela Bovina: R$ 32,90/kg
━━━━━━━━━━━━━━━━━━━

💰 *CONDIÇÕES ESPECIAIS:*
✅ Desconto à vista
✅ Entrega prioritária
✅ Qualidade garantida

📞 *Peça já:* (11) 99999-9999
📍 Aberto até 13h na Terça de Carnaval

🎪 Aproveite e tenha um ÓTIMO CARNAVAL!

*THIAGO 704*
_A melhor carne da região_ 🥩
`,

    messageSimple: `
🎭 *FELIZ CARNAVAL!* 🎭

A família *THIAGO 704* deseja
um feriado INCRÍVEL para você! 🎊

🥩 Estamos abertos!
📞 (11) 99999-9999

_A melhor carne da região_
`,
};

/**
 * 🐰 PÁSCOA
 */
export const PASCOA = {
    message: `
🐰🥚 *FELIZ PÁSCOA!* 🥚🐰

*THIAGO 704* deseja uma Páscoa
repleta de PAZ e RENOVAÇÃO! 🙏

🍖 *OFERTAS DE PÁSCOA:*
━━━━━━━━━━━━━━━━━━━
✨ Pernil Suíno: R$ 28,90/kg
✨ Cordeiro Premium: R$ 65,90/kg
✨ Chester Especial: R$ 42,90/kg
━━━━━━━━━━━━━━━━━━━

🎁 *BRINDE:* 
Compras acima de R$ 200
ganham 1kg de linguiça! 🎉

📞 *Reserve:* (11) 99999-9999

*THIAGO 704*
_Tradição e qualidade_ 🥩
`,
};

/**
 * 🎄 NATAL
 */
export const NATAL = {
    message: `
🎄🎅 *FELIZ NATAL!* 🎅🎄

*THIAGO 704* deseja um Natal
repleto de AMOR e UNIÃO! 💙

🍖 *ESPECIAL DE NATAL:*
━━━━━━━━━━━━━━━━━━━
⭐ Peru Nobre: R$ 48,90/kg
⭐ Tender Premium: R$ 52,90/kg
⭐ Lombo Suíno: R$ 38,90/kg
━━━━━━━━━━━━━━━━━━━

🎁 *CESTÃO DE NATAL:*
Kits completos a partir de R$ 350

📞 *Encomende:* (11) 99999-9999

Que 2026 seja PRÓSPERO! 🙏

*THIAGO 704*
_Sua ceia merece o melhor_ 🥩
`,
};

/**
 * 🎊 ANO NOVO
 */
export const ANO_NOVO = {
    message: `
🎊🥂 *FELIZ 2026!* 🥂🎊

*THIAGO 704* deseja um ano de:
✨ MUITO SUCESSO
💰 PROSPERIDADE
❤️ SAÚDE e PAZ

🍖 *PROMOÇÃO ANO NOVO:*
━━━━━━━━━━━━━━━━━━━
🎯 20% OFF na primeira compra!
🎯 Frete GRÁTIS acima de R$ 200
🎯 Brindes exclusivos
━━━━━━━━━━━━━━━━━━━

📞 *Aproveite:* (11) 99999-9999

Obrigado pela confiança em 2025!
Vamos juntos em 2026! 🚀

*THIAGO 704*
_Começando o ano com qualidade_ 🥩
`,
};

/**
 * 🎉 FIM DE SEMANA
 */
export const FIM_DE_SEMANA = {
    message: `
🎉 *ÓTIMO FIM DE SEMANA!* 🎉

A equipe *THIAGO 704* deseja
um final de semana INCRÍVEL! 😊

🥩 *OFERTAS DE SEXTA:*
━━━━━━━━━━━━━━━━━━━
🔥 Churrasco Completo p/ 10 pessoas
🔥 Apenas R$ 280,00
🔥 Inclui: Picanha, Linguiça, Fraldinha
━━━━━━━━━━━━━━━━━━━

📞 *Reserve:* (11) 99999-9999
📍 Entrega em até 2h

Bom churrasco! 🍖

*THIAGO 704*
_Fim de semana com sabor_ 🥩
`,
};

/**
 * 👨‍👩‍👧‍👦 DIA DAS MÃES
 */
export const DIA_DAS_MAES = {
    message: `
💐👩 *FELIZ DIA DAS MÃES!* 👩💐

*THIAGO 704* homenageia todas as
MÃES INCRÍVEIS! 🙏💙

🍖 *PRESENTE PARA SUA MÃE:*
━━━━━━━━━━━━━━━━━━━
🎁 Cesta Premium: R$ 250
🎁 Inclui cortes nobres + temperos
🎁 Cartão personalizado GRÁTIS
━━━━━━━━━━━━━━━━━━━

📞 *Surpreenda:* (11) 99999-9999

Que Deus abençoe todas as mães! 🙏

*THIAGO 704*
_Celebrando quem amamos_ 🥩
`,
};

/**
 * 👨 DIA DOS PAIS
 */
export const DIA_DOS_PAIS = {
    message: `
👨🏆 *FELIZ DIA DOS PAIS!* 🏆👨

*THIAGO 704* celebra todos os
PAIS GUERREIROS! 💪

🥩 *KIT CHURRAS DO PAIZÃO:*
━━━━━━━━━━━━━━━━━━━
🔥 15kg de carnes premium
🔥 Cerveja especial GRÁTIS
🔥 Apenas R$ 450
━━━━━━━━━━━━━━━━━━━

📞 *Garanta:* (11) 99999-9999

Seu pai merece o MELHOR! 🏆

*THIAGO 704*
_Tradição de pai para filho_ 🥩
`,
};

/**
 * Enviar mensagem sazonal para lista de clientes
 */
export async function sendSeasonalMessage(
    template: typeof CARNAVAL_2026,
    clients: Array<{ name: string; phone: string }>,
    useSimple: boolean = false
) {
    const message = useSimple && 'messageSimple' in template
        ? template.messageSimple
        : template.message;

    const results = [];

    for (const client of clients) {
        const personalizedMessage = message.replace(/cliente/gi, client.name);
        const result = await sendWhatsAppMessage(client.phone, personalizedMessage);
        results.push({ client: client.name, ...result });

        // Delay de 5 segundos entre mensagens
        await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    return results;
}

/**
 * LOGOMARCA TEXTUAL ASCII ART
 */
export const LOGO_THIAGO_704 = `
╔════════════════════════════╗
║                            ║
║   ████████╗██╗  ██╗██╗     ║
║   ╚══██╔══╝██║  ██║██║     ║
║      ██║   ███████║██║     ║
║      ██║   ██╔══██║██║     ║
║      ██║   ██║  ██║██║     ║
║                            ║
║    ███╗   ███╗ ██████╗     ║
║    ████╗ ████║██╔═══██╗    ║
║    ██╔████╔██║██║   ██║    ║
║    ██║╚██╔╝██║██║   ██║    ║
║    ██║ ╚═╝ ██║╚██████╔╝    ║
║                            ║
║         704                ║
║    ▂ ▃ ▄ ▅ ▆ ▇ █          ║
║  A MELHOR CARNE DA REGIÃO  ║
║                            ║
╚════════════════════════════╝
`;
