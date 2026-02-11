// Sistema de Comunicação com Funcionários
// Mensagens de reconhecimento, motivação e engajamento da equipe

import { sendWhatsAppMessage } from './whatsappAPI';

/**
 * 🎂 Aniversário de Funcionário
 */
export async function sendEmployeeBirthday(
    employeeName: string,
    phone: string,
    yearsInCompany?: number
) {
    const message =
        `🎂🎉 *FELIZ ANIVERSÁRIO, ${employeeName}!* 🎉🎂\n\n` +
        `Hoje é um dia muito especial!\n` +
        `🌟 A equipe FrigoGest deseja:\n` +
        `🙏 Muita saúde e felicidade\n` +
        `💙 Paz e prosperidade\n` +
        `✨ Realizações e conquistas\n\n` +
        (yearsInCompany ? `🏆 ${yearsInCompany} anos de dedicação!\n\n` : '') +
        `🎁 Preparamos uma surpresa!\nVenha buscar seu presente! 💝\n\n` +
        `Parabéns, você é ESSENCIAL! 🤝`;

    return await sendWhatsAppMessage(phone, message);
}

/**
 * 🏆 Reconhecimento por Desempenho
 */
export async function sendPerformanceRecognition(
    employeeName: string,
    phone: string,
    achievement: string,
    bonus?: number
) {
    const message =
        `🏆🌟 *PARABÉNS, ${employeeName}!* 🌟🏆\n\n` +
        `Reconhecemos seu trabalho EXCEPCIONAL!\n\n` +
        `✨ ${achievement}\n\n` +
        `💙 Sua dedicação faz a diferença!\n` +
        `🎯 Continue assim, você é DESTAQUE!\n\n` +
        (bonus ? `🎁 Bônus de R$ ${bonus.toFixed(2)}\nna sua próxima folha! 💰\n\n` : '') +
        `Obrigado por fazer parte do time! 🤝`;

    return await sendWhatsAppMessage(phone, message);
}

/**
 * 💰 Notificação de Bônus
 */
export async function sendBonusNotification(
    employeeName: string,
    phone: string,
    bonusAmount: number,
    reason: string
) {
    const message =
        `💰🎉 *BOA NOTÍCIA!* 🎉💰\n\n` +
        `*${employeeName}*, você ganhou um BÔNUS!\n\n` +
        `✅ Valor: R$ ${bonusAmount.toFixed(2)}\n` +
        `📋 Motivo: ${reason}\n\n` +
        `🌟 Seu esforço foi reconhecido!\n` +
        `💙 Continue sendo exemplo!\n\n` +
        `Parabéns! Você merece! 🏆`;

    return await sendWhatsAppMessage(phone, message);
}

/**
 * 👏 Agradecimento por Hora Extra
 */
export async function sendOvertimeThanks(
    employeeName: string,
    phone: string,
    hours: number
) {
    const message =
        `👏💙 *MUITO OBRIGADO!* 💙👏\n\n` +
        `*${employeeName}*, seu esforço extra\nfoi FUNDAMENTAL hoje!\n\n` +
        `⏰ ${hours}h de dedicação\n` +
        `🌟 Comprometimento total\n` +
        `🏆 Atitude de vencedor\n\n` +
        `A empresa reconhece e valoriza!\n` +
        `Você faz a diferença! 🤝\n\n` +
        `Descanse bem, você merece! 😊`;

    return await sendWhatsAppMessage(phone, message);
}

/**
 * 📢 Comunicado Importante
 */
export async function sendTeamAnnouncement(
    employeeName: string,
    phone: string,
    title: string,
    message: string
) {
    const formattedMessage =
        `📢 *COMUNICADO IMPORTANTE*\n\n` +
        `*${title}*\n\n` +
        `${message}\n\n` +
        `Qualquer dúvida, pode perguntar!\n\n` +
        `Equipe FrigoGest 🤝`;

    return await sendWhatsAppMessage(phone, formattedMessage);
}

/**
 * ✅ Feedback Positivo
 */
export async function sendPositiveFeedback(
    employeeName: string,
    phone: string,
    specificAction: string
) {
    const message =
        `✅🌟 *FEEDBACK POSITIVO!* 🌟✅\n\n` +
        `*${employeeName}*, parabéns!\n\n` +
        `Observamos que:\n` +
        `👏 ${specificAction}\n\n` +
        `💙 Esse tipo de atitude\nfaz nosso time mais forte!\n\n` +
        `Continue assim! Você inspira! 🚀`;

    return await sendWhatsAppMessage(phone, message);
}

/**
 * 🎯 Metas e Objetivos
 */
export async function sendGoalUpdate(
    employeeName: string,
    phone: string,
    goalProgress: number,
    goalTarget: number,
    reward: string
) {
    const percentComplete = ((goalProgress / goalTarget) * 100).toFixed(0);

    const message =
        `🎯 *ACOMPANHAMENTO DE META* 🎯\n\n` +
        `*${employeeName}*, você está:\n\n` +
        `📊 ${goalProgress} / ${goalTarget}\n` +
        `📈 ${percentComplete}% concluído!\n\n` +
        `🏆 Ao atingir 100%:\n` +
        `🎁 ${reward}\n\n` +
        (Number(percentComplete) > 70
            ? `🔥 Está QUASE! Continue firme! 💪`
            : `💙 Você consegue! Força! 💪`);

    return await sendWhatsAppMessage(phone, message);
}

/**
 * 🎊 Celebração de Equipe
 */
export async function sendTeamCelebration(
    employeeName: string,
    phone: string,
    achievement: string,
    celebration: string
) {
    const message =
        `🎊🎉 *CONQUISTA DO TIME!* 🎉🎊\n\n` +
        `*${employeeName}*, conseguimos!\n\n` +
        `✅ ${achievement}\n\n` +
        `🎂 Comemoração:\n` +
        `📍 ${celebration}\n\n` +
        `💙 Juntos somos MAIS FORTES!\n` +
        `🏆 Parabéns a TODA equipe! 🙌`;

    return await sendWhatsAppMessage(phone, message);
}

/**
 * ⚠️ Lembrete Profissional (Não Punitivo)
 */
export async function sendFriendlyReminder(
    employeeName: string,
    phone: string,
    reminderType: 'horario' | 'uniforme' | 'documento' | 'procedimento',
    details: string
) {
    const icons = {
        horario: '⏰',
        uniforme: '👔',
        documento: '📄',
        procedimento: '📋'
    };

    const message =
        `${icons[reminderType]} *LEMBRETE AMIGÁVEL*\n\n` +
        `Oi *${employeeName}*! 😊\n\n` +
        `${details}\n\n` +
        `💙 Contamos com você!\n\n` +
        `Qualquer dúvida, estamos aqui! 🤝`;

    return await sendWhatsAppMessage(phone, message);
}

/**
 * 🌟 Funcionário do Mês
 */
export async function sendEmployeeOfTheMonth(
    employeeName: string,
    phone: string,
    achievements: string[],
    prize: string
) {
    const achievementsList = achievements.map((a, i) => `${i + 1}. ${a}`).join('\n');

    const message =
        `🏆👑 *FUNCIONÁRIO DO MÊS!* 👑🏆\n\n` +
        `*PARABÉNS, ${employeeName}!*\n\n` +
        `Você foi escolhido por:\n\n` +
        `${achievementsList}\n\n` +
        `🎁 Prêmio: ${prize}\n\n` +
        `💙 Você é INSPIRAÇÃO para todos!\n` +
        `🌟 Continue brilhando! ✨`;

    return await sendWhatsAppMessage(phone, message);
}

/**
 * 📚 Templates Prontos
 */
export const EMPLOYEE_TEMPLATES = {
    bom_dia: (name: string) =>
        `☀️ Bom dia, *${name}*! 😊\n\nTenha um ótimo dia de trabalho!\nVocê é importante para o time! 💙`,

    motivacao: (name: string) =>
        `💪 *${name}*, lembre-se:\n\n"O sucesso é a soma de pequenos\nesforços repetidos dia após dia."\n\nVocê está no caminho certo! 🌟`,

    fim_de_semana: (name: string) =>
        `🎉 Boa sexta, *${name}*!\n\nAproveite o fim de semana!\nDescanse e recarregue as energias! 😊\n\nNos vemos segunda! 🤝`,

    bem_vindo: (name: string) =>
        `👋 Bem-vindo ao time, *${name}*!\n\n💙 Estamos felizes em ter você!\n🤝 Conte conosco para qualquer coisa!\n\nVamos fazer história juntos! 🚀`,
};
