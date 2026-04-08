// ═══════════════════════════════════════════════════════
// الجاسوسية — Cloudflare Worker
// Deploy: wrangler deploy worker.js --name jasusiya-ai
// Secret: wrangler secret put ANTHROPIC_API_KEY
// ═══════════════════════════════════════════════════════

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {

    // CORS preflight
    if (request.method === 'OPTIONS')
      return new Response(null, { headers: CORS });

    const url = new URL(request.url);

    // ── /pick  — bot card selection ──────────────────────
    if (url.pathname === '/pick' && request.method === 'POST') {
      let body;
      try { body = await request.json(); }
      catch { return json({ error: 'Bad JSON' }, 400); }

      const { cards, clue, num, model } = body;
      if (!cards?.length || !clue)
        return json({ error: 'Missing cards or clue' }, 400);

      const prompt =
        `أنت تلعب لعبة الجاسوسية (Codenames) بالعربي.\n` +
        `التلميح: "${clue}" (عدد الكروت: ${num || 1})\n` +
        `الكروت المتبقية على اللوحة: ${cards.join('، ')}\n\n` +
        `اختر الكرت الواحد الأنسب الآن.\n` +
        `أجب بالكلمة فقط، بدون أي شرح أو علامات ترقيم.`;

      const pick = await callClaude(prompt, model || env.MODEL || 'claude-haiku-4-5-20251001', env);
      if (!pick) return json({ error: 'Claude failed' }, 502);

      return json({ pick });
    }

    // ── /health — quick test ─────────────────────────────
    if (url.pathname === '/health')
      return json({ ok: true, worker: 'jasusiya-ai' });

    return new Response('Not found', { status: 404 });
  }
};

// ── Shared Claude caller ──────────────────────────────
async function callClaude(prompt, model, env) {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 20,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await res.json();
    if (data?.error) { console.error('Claude error:', data.error); return null; }
    return data?.content?.[0]?.text?.trim().replace(/["'.،,\n\r]/g, '') || null;
  } catch (e) {
    console.error('fetch error:', e);
    return null;
  }
}

// ── JSON response helper ──────────────────────────────
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
