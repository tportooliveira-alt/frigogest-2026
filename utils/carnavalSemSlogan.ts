// Versões SEM SLOGAN (só nome) - THIAGO 704

/**
 * 🎭 CARNAVAL PADRÃO - SEM SLOGAN
 */
export function gerarCarnavalSemSlogan(nomeCliente: string, usarPrimeiroNome: boolean = true): string {
    const getPrimeiroNome = (nome: string) => nome.trim().split(' ')[0];
    const nome = usarPrimeiroNome ? getPrimeiroNome(nomeCliente).toUpperCase() : nomeCliente.toUpperCase();

    return `
╔══════════════════════════╗
║   🎭 CARNAVAL 2026 🎭   ║
╚══════════════════════════╝

OLÁ, *${nome}*! 🎉

A família *THIAGO 704* deseja
um CARNAVAL INESQUECÍVEL! 🎊

▂▃▄▅▆▇█ OFERTA ESPECIAL █▇▆▅▄▃▂

🥩 *PICANHA PREMIUM*
   R$ 45,90/kg
   
🥩 *ALCATRA NOBRE*
   R$ 38,90/kg
   
🥩 *COSTELA BOVINA*
   R$ 32,90/kg

━━━━━━━━━━━━━━━━━━━━━━

💰 *SÓ PARA VOCÊ, ${nome}:*
   ✅ 5% EXTRA à vista
   ✅ Entrega GRÁTIS
   ✅ Qualidade garantida

━━━━━━━━━━━━━━━━━━━━━━

📞 *Reserve já:* (74) 99999-9999
⏰ *Até:* Terça de Carnaval, 13h

🎪 Tenha um ÓTIMO CARNAVAL!

━━━━━━━━━━━━━━
  THIAGO 704
━━━━━━━━━━━━━━
`;
}

/**
 * 🎭 CARNAVAL LUXO - SEM SLOGAN  
 */
export function gerarCarnavalLuxoSemSlogan(nomeCliente: string, usarPrimeiroNome: boolean = true): string {
    const getPrimeiroNome = (nome: string) => nome.trim().split(' ')[0];
    const nome = usarPrimeiroNome ? getPrimeiroNome(nomeCliente).toUpperCase() : nomeCliente.toUpperCase();

    return `
🎭═══════════════════════🎭
    *CARNAVAL VIP 2026*
🎭═══════════════════════🎭

Exclusivo para: *${nome}*

⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐

🎉 A *THIAGO 704* preparou
   uma OFERTA ESPECIAL
   só para VOCÊ! 🎊

┏━━━━━━━━━━━━━━━━━━━━┓
┃  🥩 SUPER PROMOÇÃO  ┃
┗━━━━━━━━━━━━━━━━━━━━┛

🔥 KIT CHURRASCO PREMIUM
   • Picanha 2kg
   • Fraldinha 2kg
   • Linguiça 1kg
   
   De R$ 450 por:
   💰 *R$ 380,00 CLIENTE VIP*

┏━━━━━━━━━━━━━━━━━━━━┓
┃    💝 BÔNUS VIP     ┃
┗━━━━━━━━━━━━━━━━━━━━┛

*${nome}*, você ganha:
✨ Tempero especial GRÁTIS
✨ Entrega prioritária
✨ Garantia de qualidade

⏰ *Válido até:* 
   Terça-feira, 13h

📞 *WhatsApp:* 
   (74) 99999-9999

🎪 FELIZ CARNAVAL! 🎭

━━━━━━━━━━━━━━━━━━━━━
    *THIAGO 704*
━━━━━━━━━━━━━━━━━━━━━
`;
}

/**
 * 🎭 CARNAVAL SIMPLES - SEM SLOGAN
 */
export function gerarCarnavalSimplesSemSlogan(nomeCliente: string, usarPrimeiroNome: boolean = true): string {
    const getPrimeiroNome = (nome: string) => nome.trim().split(' ')[0];
    const nome = usarPrimeiroNome ? getPrimeiroNome(nomeCliente).toUpperCase() : nomeCliente.toUpperCase();

    return `
🎭 *${nome}* 🎭

FELIZ CARNAVAL! 🎉

*THIAGO 704* tem OFERTA ESPECIAL:
🥩 Picanha - R$ 45,90/kg
🥩 Alcatra - R$ 38,90/kg

📞 (74) 99999-9999
⏰ Até terça, 13h

Aproveite! 🎊

THIAGO 704
`;
}

/**
 * 🎭 CARNAVAL ASCII - SEM SLOGAN
 */
export function gerarCarnavalAsciiSemSlogan(nomeCliente: string, usarPrimeiroNome: boolean = true): string {
    const getPrimeiroNome = (nome: string) => nome.trim().split(' ')[0];
    const nome = usarPrimeiroNome ? getPrimeiroNome(nomeCliente).toUpperCase() : nomeCliente.toUpperCase();

    return `
    🎭🎉🎊🎭🎉🎊🎭
   
   ╔═══════════════╗
   ║  CARNAVAL!    ║
   ╚═══════════════╝
   
Olá, *${nome}*!

   🥩═══════════🥩
   
*THIAGO 704* te convida
para a MAIOR PROMOÇÃO
do ano! 🔥

▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
▓  OFERTA RELÂMPAGO  ▓
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓

🎯 PICANHA: R$ 45,90
🎯 ALCATRA: R$ 38,90
🎯 COSTELA: R$ 32,90

   ★★★★★★★★★★★
   
💎 *EXCLUSIVO PARA VOCÊ:*
   5% extra à vista!
   
   ★★★★★★★★★★★

📱 *Reserve:*
   (74) 99999-9999

🎪 BOM CARNAVAL! 🎭

   ┌──────────────┐
   │  THIAGO 704  │
   └──────────────┘
`;
}
