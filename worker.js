// worker.js — deploy to Cloudflare Workers
export default {
  async fetch(request, env) {
    // CORS for your game
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

    const { cards, clue, num } = await request.json();

    const prompt = `أنت تلعب لعبة الجاسوسية.\nالتلميح: "${clue}" (عدد الكروت: ${num})\nالكروت المتبقية: ${cards.join('، ')}\n\nاختر الكرت الواحد الأنسب الآن. أجب بالكلمة فقط.`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,   // ← key lives here, never in APK
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: env.MODEL || 'claude-haiku-4-5-20251001',
        max_tokens: 20,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await res.json();
    const pick = data?.content?.[0]?.text?.trim().replace(/["'.،,]/g, '') || null;
    return new Response(JSON.stringify({ pick }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  },
};