export interface MCPToolResult {
    success: boolean;
    output: string;
    actionType: string;
}

export const mcpTools = {
    /**
     * MCP: SEND_WHATSAPP
     * Simula o envio de uma mensagem real pelo WhatsApp via API Evolution ou Z-API.
     */
    sendWhatsAppText: async (phone: string, message: string): Promise<MCPToolResult> => {
        console.log(`[MCP:WHATSAPP] 🚀 Disparando para ${phone}: "${message}"`);

        // Simula delay de rede
        await new Promise(r => setTimeout(r, 1500));

        // Mock de verificação: Se não tiver número, falha
        if (!phone || phone.length < 10) {
            return {
                success: false,
                output: 'Falha: Número de telefone inválido ou não fornecido.',
                actionType: 'WHATSAPP'
            };
        }

        return {
            success: true,
            output: `Sucesso! Mensagem entregue ao número ${phone}. Status: ENVIADA_E_LIDA.`,
            actionType: 'WHATSAPP'
        };
    },

    /**
     * MCP: CHECK_BANK_PIX
     * Consulta no extrato bancário se um PIX de determinado valor ou CPF caiu hoje.
     */
    checkBankPix: async (cpfCnpj: string, expectedValue?: number): Promise<MCPToolResult> => {
        console.log(`[MCP:BANK] 🏦 Verificando extrato via OpenFinance para ${cpfCnpj}`);

        await new Promise(r => setTimeout(r, 2000));

        // Mock: Simula que encontrou o PIX 50% das vezes aleatoriamente (ou sempre se for test, aqui assumiremos sempre q sim para fluxo feliz)
        return {
            success: true,
            output: `CONFIRMADO: Pagamento PIX identificado na conta. Valor confere${expectedValue ? ` (R$ ${expectedValue})` : ''}.`,
            actionType: 'BANK_CHECK'
        };
    },

    /**
     * MCP: CODE_LINTER (O embrião do Agente Dev autônomo)
     * Roda um check básico de sanidade no código ou em um JSON.
     */
    runSanityCheck: async (targetModule: string): Promise<MCPToolResult> => {
        console.log(`[MCP:DEV_TOOLS] 🛠️ Inspecionando integridade de ${targetModule}...`);

        await new Promise(r => setTimeout(r, 2500));

        return {
            success: true,
            output: `Análise concluída. O módulo ${targetModule} está com Exit Code 0 (Nenhum erro Tipagem).`,
            actionType: 'SYSTEM'
        };
    }
};

/**
 * Função global que intercepta no texto bruto se a IA tentou evocar um MCP Tool
 * Ex de tag na resposta do Agente: 
 * <mcp>SEND_WHATSAPP|55119999999|Oi cliente, vamos fechar?</mcp>
 */
export const executeInterceptedMCPs = async (aiText: string): Promise<{ cleanText: string, executions: MCPToolResult[] }> => {
    const executions: MCPToolResult[] = [];

    // Regex para pegar tudo dentro de <mcp> COMANDO | PARAMs </mcp>
    const mcpRegex = /<mcp>(.*?)<\/mcp>/gi;
    let match;
    let tempText = aiText;

    while ((match = mcpRegex.exec(aiText)) !== null) {
        const fullString = match[1]; // EX: SEND_WHATSAPP|55119999999|Mensagem teste
        const parts = fullString.split('|');
        const command = parts[0].trim();

        if (command === 'SEND_WHATSAPP') {
            const phone = parts[1]?.trim() || '';
            const msg = parts.slice(2).join('|').trim();
            const res = await mcpTools.sendWhatsAppText(phone, msg);
            executions.push(res);
        }
        else if (command === 'CHECK_BANK_PIX') {
            const cpf = parts[1]?.trim() || '';
            const val = parseFloat(parts[2]?.trim() || '0');
            const res = await mcpTools.checkBankPix(cpf, val);
            executions.push(res);
        }
        else if (command === 'RUN_LINTER') {
            const module = parts[1]?.trim() || 'core';
            const res = await mcpTools.runSanityCheck(module);
            executions.push(res);
        }
        else {
            executions.push({
                success: false,
                output: `Erro: MCP Tool [${command}] não reconhecida no registro.`,
                actionType: 'UNKNOWN'
            });
        }
    }

    // Remove as tags do texto final para não poluir
    const cleanText = tempText.replace(mcpRegex, '').trim();

    return { cleanText, executions };
};
