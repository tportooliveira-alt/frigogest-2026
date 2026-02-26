// ═══ PARSER DE AÇÕES AUTÔNOMAS — FASE 2 ═══
// Detecta ações sugeridas nas respostas da IA e gera botões clicáveis
// Inspirado em: Microsoft Dynamics 365 Autonomous Agents, SAP Joule Actions

export interface DetectedAction {
    id: string;
    type: 'WHATSAPP' | 'COBRAR' | 'PROMO' | 'PEDIDO' | 'COMPRAR' | 'REATIVAR' | 'COPIAR' | 'RELATORIO';
    label: string;
    icon: string;
    description: string;
    clientName?: string;
    clientPhone?: string;
    value?: number;
    message?: string;
    urgency: 'ALTA' | 'MEDIA' | 'BAIXA';
    color: string;
}

// Detecta ações sugeridas no texto da IA
export function parseActionsFromResponse(text: string, clients: { nome_social: string; whatsapp?: string; id_ferro: string }[]): DetectedAction[] {
    const actions: DetectedAction[] = [];
    const lines = text.split('\n');
    const usedIds = new Set<string>();

    const addAction = (action: DetectedAction) => {
        if (!usedIds.has(action.id)) {
            usedIds.add(action.id);
            actions.push(action);
        }
    };

    for (const line of lines) {
        const lower = line.toLowerCase();

        // WHATSAPP: Detecta sugestões de envio de mensagem
        if (/whatsapp|enviar.*mensagem|disparar.*script|mandar.*msg|script.*reativa/i.test(line)) {
            const clientMatch = clients.find(c => line.includes(c.nome_social));
            addAction({
                id: `wa-${clientMatch?.id_ferro || 'geral'}`,
                type: 'WHATSAPP',
                label: clientMatch ? `📱 WhatsApp → ${clientMatch.nome_social}` : '📱 Enviar WhatsApp',
                icon: '📱',
                description: line.replace(/^[\d.)\-→•*\s]+/, '').trim().substring(0, 100),
                clientName: clientMatch?.nome_social,
                clientPhone: clientMatch?.whatsapp,
                urgency: /urgente|agora|hoje|imediato|crítico/i.test(line) ? 'ALTA' : 'MEDIA',
                color: 'from-green-500 to-emerald-500',
            });
        }

        // COBRAR: Detecta sugestões de cobrança
        if (/cobr|inadimpl|devedor|vencid|pendente.*pagamento|receber.*de/i.test(line) && !/não.*cobr/i.test(line)) {
            const clientMatch = clients.find(c => line.includes(c.nome_social));
            const valorMatch = line.match(/R\$\s*([\d.,]+)/);
            if (clientMatch || valorMatch) {
                addAction({
                    id: `cobrar-${clientMatch?.id_ferro || 'geral'}`,
                    type: 'COBRAR',
                    label: clientMatch ? `💰 Cobrar ${clientMatch.nome_social}` : '💰 Iniciar Cobrança',
                    icon: '💰',
                    description: line.replace(/^[\d.)\-→•*\s]+/, '').trim().substring(0, 100),
                    clientName: clientMatch?.nome_social,
                    clientPhone: clientMatch?.whatsapp,
                    value: valorMatch ? parseFloat(valorMatch[1].replace('.', '').replace(',', '.')) : undefined,
                    urgency: 'ALTA',
                    color: 'from-amber-500 to-orange-500',
                });
            }
        }

        // PROMO: Detecta campanhas de promoção/escassez
        if (/promo[çc]|combo|desconto|campanha|oferta|escassez|relâmpago|urgente.*vend/i.test(line)) {
            addAction({
                id: `promo-${actions.length}`,
                type: 'PROMO',
                label: '📢 Criar Campanha',
                icon: '📢',
                description: line.replace(/^[\d.)\-→•*\s]+/, '').trim().substring(0, 100),
                urgency: /urgente|hoje|agora|relâmpago/i.test(line) ? 'ALTA' : 'MEDIA',
                color: 'from-purple-500 to-fuchsia-500',
            });
        }

        // REATIVAR: Detecta reativação de cliente
        if (/reativ|reconquist|voltar.*comprar|recuper.*client|esfriando|perdido/i.test(line)) {
            const clientMatch = clients.find(c => line.includes(c.nome_social));
            if (clientMatch) {
                addAction({
                    id: `reativar-${clientMatch.id_ferro}`,
                    type: 'REATIVAR',
                    label: `🔄 Reativar ${clientMatch.nome_social}`,
                    icon: '🔄',
                    description: `Enviar script de reativação via WhatsApp`,
                    clientName: clientMatch.nome_social,
                    clientPhone: clientMatch.whatsapp,
                    urgency: 'ALTA',
                    color: 'from-blue-500 to-cyan-500',
                });
            }
        }

        // COMPRAR: Detecta sugestões de compra de gado
        if (/comprar.*lote|fechar.*lote|negociar.*fornec|abastecer|novo.*lote/i.test(line)) {
            addAction({
                id: `comprar-${actions.length}`,
                type: 'COMPRAR',
                label: '🚛 Agendar Compra',
                icon: '🚛',
                description: line.replace(/^[\d.)\-→•*\s]+/, '').trim().substring(0, 100),
                urgency: 'MEDIA',
                color: 'from-indigo-500 to-violet-500',
            });
        }

        // RELATÓRIO: Detecta sugestões de relatório
        if (/relat[oó]rio|DRE|balanç|exportar|planilha|CSV|PDF/i.test(line)) {
            addAction({
                id: `relatorio-${actions.length}`,
                type: 'RELATORIO',
                label: '📊 Gerar Relatório',
                icon: '📊',
                description: line.replace(/^[\d.)\-→•*\s]+/, '').trim().substring(0, 100),
                urgency: 'BAIXA',
                color: 'from-slate-500 to-gray-500',
            });
        }
    }

    // Limitar a 5 ações mais relevantes
    return actions
        .sort((a, b) => {
            const urgencyOrder = { ALTA: 0, MEDIA: 1, BAIXA: 2 };
            return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
        })
        .slice(0, 5);
}

// Gerar mensagem WhatsApp para uma ação
export function generateWhatsAppLink(phone: string, message: string): string {
    const cleanPhone = phone.replace(/\D/g, '');
    const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    return `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;
}
