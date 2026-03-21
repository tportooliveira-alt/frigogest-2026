/**
 * ═══════════════════════════════════════════════════════════════
 * LLM CASCADE — FrigoGest 2026
 * ═══════════════════════════════════════════════════════════════
 * Cascata de provedores: Groq Flash → Gemini Flash → Claude Haiku
 * Custo otimizado: tenta gratuito primeiro, pago só no fallback.
 * Assinatura: (prompt, agentId?) → { text, provider }
 * ═══════════════════════════════════════════════════════════════
 */

export interface CascadeResult {
  text: string;
  provider: string;
}

const getEnv = (key: string): string =>
  (import.meta as any).env?.[key] as string || '';

// ── Timeout helper ──────────────────────────────────────────────
const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout ${ms}ms`)), ms)
    )
  ]);

// ── 1. Groq (Llama 3.1 8B — grátis, ultra rápido) ──────────────
async function tryGroq(prompt: string): Promise<CascadeResult> {
  const key = getEnv('VITE_GROQ_API_KEY');
  if (!key) throw new Error('GROQ key ausente');

  const res = await withTimeout(
    fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 700,
        temperature: 0.3,
        // Fix 4: system separado do user para maior aderência às instruções
        messages: [
          { role: 'system', content: 'Você é um especialista do FrigoGest, frigorífico em Vitória da Conquista, Bahia. Responda sempre em português brasileiro. Seja direto e use dados reais fornecidos.' },
          { role: 'user', content: prompt }
        ]
      })
    }),
    8000
  );

  if (!res.ok) throw new Error(`Groq ${res.status}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Groq resposta vazia');
  return { text, provider: 'groq-llama70b' };
}

// ── 2. Gemini Flash (Google — grátis tier, bom contexto) ────────
async function tryGemini(prompt: string): Promise<CascadeResult> {
  const key = getEnv('VITE_AI_API_KEY');
  if (!key) throw new Error('Gemini key ausente');

  const res = await withTimeout(
    fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Fix 4: systemInstruction separado para maior aderência
          systemInstruction: { parts: [{ text: 'Você é um especialista do FrigoGest, frigorífico em Vitória da Conquista, Bahia. Responda em português brasileiro. Use apenas dados reais fornecidos no contexto.' }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 700, temperature: 0.3 }
        })
      }
    ),
    12000
  );

  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new Error('Gemini resposta vazia');
  return { text, provider: 'gemini-flash' };
}

// ── 3. Claude Haiku (Anthropic — pago, fallback final) ──────────
async function tryHaiku(prompt: string): Promise<CascadeResult> {
  const key = getEnv('VITE_ANTHROPIC_KEY');
  if (!key) throw new Error('Anthropic key ausente');

  const res = await withTimeout(
    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 700,
        system: 'Você é um especialista do FrigoGest, frigorífico em Vitória da Conquista, Bahia. Responda em português brasileiro. Use apenas dados reais fornecidos no contexto.',
        messages: [{ role: 'user', content: prompt }]
      })
    }),
    15000
  );

  if (!res.ok) throw new Error(`Haiku ${res.status}`);
  const data = await res.json();
  const text = data.content?.[0]?.text?.trim();
  if (!text) throw new Error('Haiku resposta vazia');
  return { text, provider: 'claude-haiku' };
}

// ── Cascata principal ────────────────────────────────────────────
export const runCascade = async (
  prompt: string,
  agentId?: string
): Promise<CascadeResult> => {
  const providers = [
    { name: 'Groq',   fn: tryGroq },
    { name: 'Gemini', fn: tryGemini },
    { name: 'Haiku',  fn: tryHaiku },
  ];

  let lastError = '';
  for (const { name, fn } of providers) {
    try {
      const result = await fn(prompt);
      if (agentId) console.log(`[Cascade] ${agentId} → ${name} ✅`);
      return result;
    } catch (err: any) {
      lastError = err.message;
      if (agentId) console.warn(`[Cascade] ${agentId} → ${name} falhou: ${lastError}`);
    }
  }

  // Todos falharam — retorna fallback local
  console.error(`[Cascade] Todos os provedores falharam. Último erro: ${lastError}`);
  return {
    text: '⚠️ Serviço de IA temporariamente indisponível. Tente novamente em alguns segundos.',
    provider: 'fallback-local'
  };
};

// ── Utilitário: extrai texto fora das tags <reasoning> ───────────
export const extractFinalAnswer = (text: string): string => {
  return text.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '').trim();
};
