import { runOrchestration } from './services/orchestratorService.js';
import * as fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const mockRunCascade = async (prompt, agentId) => {
    const apiKey = process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) throw new Error("API KEY não encontrada!");

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 1000 }
        })
    });

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "Erro";
    return { text, provider: "Gemini Local" };
};

async function test() {
    try {
        const result = await runOrchestration(
            "Isso é um TESTE. Mestra Clara e Ana, operação de vento em popa no frigorífico. Considerando nossa nova Conta V7 Global e os números absurdos que estamos batendo hoje em vendas, como estamos em relaçao aos analistas de mercado da Faria Lima?",
            "SIMULACAO TESTE",
            mockRunCascade
        );

        let output = "🚀 RESULTADO DA SIMULACAO VENTO EM POPA:\n";
        output += `Agentes: ${result.agentesEscolhidos.join(', ')}\n\n`;

        result.steps.forEach(step => {
            output += `\n🤖 --- AGENTE: ${step.agent} ---\n`;
            output += `${step.output}\n`;
        });

        fs.writeFileSync('laudo_ia_v7.txt', output, 'utf-8');
        console.log("SUCESSO: Escrito no arquivo laudo_ia_v7.txt");

    } catch (e) {
        console.error("Erro", e);
    }
}
test();
