import { runOrchestration } from './services/orchestratorService.js';
import * as fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const mockRunCascade = async (prompt, agentId) => {
    const apiKey = process.env.VITE_OPENROUTER_API_KEY;

    // Fallback log
    console.log(`[MOCK] Chamando API OPENROUTER para: ${agentId}`);

    try {
        const response = await fetch(`https://openrouter.ai/api/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'google/gemini-2.5-flash',
                messages: [{ role: 'user', content: prompt }]
            })
        });

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || `[ERRO NA RESPOSTA DA API: ${JSON.stringify(data)}]`;
        return { text, provider: "OpenRouter" };
    } catch (e) {
        return { text: `[ERRO FETCH: ${e.message}]`, provider: "Groq" };
    }
};

async function test() {
    try {
        console.log("Iniciando orquestracao de teste...");
        const result = await runOrchestration(
            "TESTE: Chame a Mestra Clara e a Inteligencia Ana. Operação de vento em popa no frigorífico. Considerando nossa nova Conta V7 Global e os números absurdos que estamos batendo hoje em vendas, o que me dizem? E estamos batendo os analistas de mercado da Faria Lima?",
            "SIMULACAO TESTE",
            mockRunCascade
        );

        let output = "🚀 RESULTADO DA SIMULACAO VENTO EM POPA:\n";
        output += `Agentes roteados: ${result.agentesEscolhidos.join(', ')}\n\n`;

        result.steps.forEach(step => {
            output += `\n🤖 --- AGENTE: ${step.agent} ---\n`;
            output += `${step.output}\n`;
        });

        output += `\n🔥 --- DECISAO FINAL --- \n`;
        output += result.finalDecision;

        fs.writeFileSync('laudo_vento_em_popa_v7.txt', output, 'utf-8');
        console.log("SUCESSO: Escrito no arquivo laudo_vento_em_popa_v7.txt");

    } catch (e) {
        console.error("Erro fatal:", e);
    }
}
test();
