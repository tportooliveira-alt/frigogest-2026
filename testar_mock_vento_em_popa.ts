import { runOrchestration } from './services/orchestratorService';
import { AgentType } from './types';
import dotenv from 'dotenv';
dotenv.config();

const mockRunCascade = async (prompt: string, agentId?: string) => {
    console.log(`\n============== PROMPT ENVIADO PARA ${agentId} ==============`);
    console.log(prompt.substring(0, 500) + '...\n(prompt truncado no log)');
    console.log(`=========================================================\n`);

    // Precisamos de um provider real para ver o retorno, vou usar o fetch do Google API (Gemini) se a chave estiver disponivel, caso contrario retorno MOCK
    const apiKey = process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("API KEY não encontrada!");
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 1000 }
        })
    });

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "Erro na API Gemini";
    return { text, provider: "Gemini Local Test" };
};

async function test() {
    console.log("Iniciando a simulação: FRIGORIFICO VENTO EM POPA...");

    try {
        const result = await runOrchestration(
            "Oi, isso é um TESTE. Mestra Clara e Ana, operação de vento em popa no frigorífico. Considerando nossa nova Conta V7 Global e os números absurdos que estamos batendo hoje em vendas, o que vocês me recomendam para não perder dinheiro e estamos batendo os analistas globais?",
            "SNAPSHOT BASICO", // Vai ser substituído internamente por cauda da palavra TESTE
            mockRunCascade
        );

        console.log("\n🚀 ==================== RESULTADO FINAL ==================== 🚀");
        console.log(`Agentes escolhidos pelo Roteador: ${result.agentesEscolhidos.join(', ')}`);

        result.steps.forEach(step => {
            console.log(`\n🤖 --- AGENTE: ${step.agent} ---`);
            console.log(step.output);
        });

    } catch (e) {
        console.error("Erro no teste:", e);
    }
}

test();
