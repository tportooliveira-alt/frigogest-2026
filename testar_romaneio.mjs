import { readFileSync, writeFileSync } from 'fs';

const pdf = readFileSync('romaneio_teste.pdf');
const b64 = Buffer.from(pdf).toString('base64');

const prompt = `Você é um leitor especializado de romaneios de frigorífico brasileiro.
Analise este documento PDF e extraia TODOS os itens de pesagem.

Para cada peça identifique:
- seq: número sequencial do animal/carcaça
- tipo: BANDA_A (traseiro esquerdo / Tr.Esq / coluna esquerda), BANDA_B (traseiro direito / Tr.Dir / coluna direita), INTEIRO (carcaça inteira)
- peso: peso em kg com decimais (ex: 125.4)

Retorne APENAS JSON puro sem nenhum markdown ou explicação:
[{"seq":1,"tipo":"BANDA_A","peso":125.4},{"seq":1,"tipo":"BANDA_B","peso":123.8}]`;

console.log('Enviando para Gemini 2.5 Flash...\n');

fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=AIzaSyBDfeHy65U_yP6-l1ZY21Oi4s1NcnTyxIA', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contents: [{
      parts: [
        { text: prompt },
        { inlineData: { mimeType: 'application/pdf', data: b64 } }
      ]
    }]
  })
})
.then(r => r.json())
.then(d => {
  if (d.error) {
    console.error('ERRO DA API:', JSON.stringify(d.error, null, 2));
    return;
  }

  const text = d.candidates?.[0]?.content?.parts?.[0]?.text || '';
  console.log('=== RESPOSTA BRUTA DO GEMINI ===');
  console.log(text);

  const clean = text.replace(/```json|```/g, '').trim();
  try {
    const items = JSON.parse(clean);
    console.log('\n=== ANÁLISE ===');
    console.log('✅ Peças encontradas:', items.length);
    console.log('Primeiras 10 peças:');
    items.slice(0, 10).forEach(i => console.log(`  Seq ${i.seq} | ${i.tipo} | ${i.peso} kg`));
    const total = items.reduce((s, i) => s + (parseFloat(i.peso) || 0), 0);
    console.log('Peso total extraído:', total.toFixed(2) + ' kg');
    const animais = new Set(items.map(i => i.seq)).size;
    console.log('Número de animais:', animais);
    
    // Salvar resultado
    writeFileSync('romaneio_resultado.json', JSON.stringify(items, null, 2));
    console.log('\nResultado salvo em romaneio_resultado.json');
  } catch (e) {
    console.log('\n⚠️ Resposta não é JSON válido. Conteúdo acima.');
  }
})
.catch(e => console.error('ERRO FETCH:', e.message));
