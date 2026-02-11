// Gerador de Mensagens de Carnaval Personalizadas - THIAGO 704
// Foco: RELACIONAMENTO B2B (Açougues/Parceiros) - SEM VAREJO

/**
 * 🎭 CARNAVAL PARCEIRO - Versão Padrão
 */
export function gerarCarnavalPersonalizado(nomeCliente: string, usarPrimeiroNome: boolean = true): string {
    const getPrimeiroNome = (nome: string) => nome.trim().split(' ')[0];
    const nome = usarPrimeiroNome ? getPrimeiroNome(nomeCliente).toUpperCase() : nomeCliente.toUpperCase();

    return `
╔══════════════════════════╗
║   🎭 CARNAVAL 2026 🎭   ║
╚══════════════════════════╝

FALA, *${nome}*! 🎉

A equipe *THIAGO 704* deseja a você
e sua família um EXCELENTE FERIADO! 🎊

Que seja um período de muita:
✨ ALEGRIA
🔋 DESCANSO
🙌 E BOAS FESTAS!

Aproveite bastante! Tamo junto! 👊

Estamos prontos para abastecer seu
açougue com o melhor gado da região!

🎪 BOM CARNAVAL!

╔══════════════════════════╗
║      THIAGO 704          ║
╚══════════════════════════╝
`;
}

/**
 * 🎭 CARNAVAL VIP - Versão Luxo/Formal
 */
export function gerarCarnavalLuxo(nomeCliente: string, usarPrimeiroNome: boolean = true): string {
    const getPrimeiroNome = (nome: string) => nome.trim().split(' ')[0];
    const nome = usarPrimeiroNome ? getPrimeiroNome(nomeCliente).toUpperCase() : nomeCliente.toUpperCase();

    return `
🎭═══════════════════════🎭
    *BOAS FESTAS - CARNAVAL*
🎭═══════════════════════🎭

Prezado parceiro *${nome}*,

Passando para desejar um ótimo
Carnaval para você e sua equipe! 🎊

Agradecemos a confiança e parceria.
Que seja um feriado abençoado! 🙏

Conte sempre com a qualidade
THIAGO 704 para o seu negócio.

🎪 FELIZ CARNAVAL! 🎭

━━━━━━━━━━━━━━━━━━━━━
    *THIAGO 704*
  🏆 Qualidade Garantida
━━━━━━━━━━━━━━━━━━━━━
`;
}

/**
 * 🎭 CARNAVAL RÁPIDO - Versão Simples
 */
export function gerarCarnavalSimples(nomeCliente: string, usarPrimeiroNome: boolean = true): string {
    const getPrimeiroNome = (nome: string) => nome.trim().split(' ')[0];
    const nome = usarPrimeiroNome ? getPrimeiroNome(nomeCliente).toUpperCase() : nomeCliente.toUpperCase();

    return `
🎭 *FALA ${nome}!* 🎭

Passando pra desejar um
FELIZ CARNAVAL pra você! 🎉

Aproveita o feriado! Tamo junto! 👊

Qualquer coisa estamos por aqui.

Abraço! 🎊

━━━━━━━━━━━━━━
  THIAGO 704
━━━━━━━━━━━━━━
`;
}

/**
 * 🎭 CARNAVAL VISUAL - Versão ASCII
 */
export function gerarCarnavalAsciiArt(nomeCliente: string, usarPrimeiroNome: boolean = true): string {
    const getPrimeiroNome = (nome: string) => nome.trim().split(' ')[0];
    const nome = usarPrimeiroNome ? getPrimeiroNome(nomeCliente).toUpperCase() : nomeCliente.toUpperCase();

    return `
    🎭🎉🎊🎭🎉🎊🎭
   
   ╔═══════════════╗
   ║  BOAS FESTAS! ║
   ╚═══════════════╝
   
Olá, *${nome}*!

   🥩═══════════🥩
   
Desejamos um Carnaval
TOP demais pra você! 🔥

▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
▓  MUITA ALEGRIA!  ▓
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓

🔋 Recarregue as energias!
🙌 Curta com a família!
👊 Conte com a gente!

   ★★★★★★★★★★★
   
PARCERIA FORTE SEMPRE!
   
   ★★★★★★★★★★★

🎪 BOM CARNAVAL! 🎭

   ┌──────────────────┐
   │   THIAGO 704     │
   └──────────────────┘
`;
}

/**
 * 🎭 GERADOR AUTOMÁTICO DE MENSAGENS EM LOTE
 */
export function gerarMensagensCarnavalLote(
    clientes: Array<{ nome: string; phone: string; isVIP?: boolean }>,
    tipoMensagem: 'luxo' | 'padrao' | 'simples' | 'ascii' = 'padrao'
) {
    return clientes.map(cliente => {
        let mensagem = '';

        switch (tipoMensagem) {
            case 'luxo':
                mensagem = gerarCarnavalLuxo(cliente.nome);
                break;
            case 'simples':
                mensagem = gerarCarnavalSimples(cliente.nome);
                break;
            case 'ascii':
                mensagem = gerarCarnavalAsciiArt(cliente.nome);
                break;
            default:
                mensagem = gerarCarnavalPersonalizado(cliente.nome);
        }

        return {
            nome: cliente.nome,
            phone: cliente.phone,
            mensagem: mensagem
        };
    });
}
