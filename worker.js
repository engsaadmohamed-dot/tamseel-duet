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

    if (request.method === 'OPTIONS')
      return new Response(null, { headers: CORS });

    const url = new URL(request.url);

    // ── GET /health ──────────────────────────────────────
    if (url.pathname === '/health')
      return json({ ok: true, worker: 'jasusiya-ai' });

    // ── POST /pick ───────────────────────────────────────
    if (url.pathname === '/pick' && request.method === 'POST') {

      let body;
      try { body = await request.json(); }
      catch { return json({ error: 'Bad JSON' }, 400); }

      const { cards, clue, num, model } = body;
      if (!Array.isArray(cards) || !cards.length || !clue)
        return json({ error: 'Missing cards or clue' }, 400);

      const count = Math.min(Math.max(parseInt(num) || 1, 1), 4);
      const useModel = model || env.MODEL || 'claude-haiku-4-5-20251001';

      const prompt =
        `أنت تلعب لعبة الجاسوسية (Codenames) بالعربي.\n` +
        `التلميح: "${clue}" (عدد الكروت: ${count})\n` +
        `الكروت المتبقية على اللوحة: ${cards.join('، ')}\n\n` +
        `اختر أفضل ${count} كرت (أو أقل إذا لم تجد ما يكفي) تتناسب مع التلميح.\n` +
        `رتّبهم من الأفضل إلى الأقل.\n` +
        `أجب بالكلمات فقط مفصولة بفاصلة عربية، بدون شرح أو ترقيم.\n` +
        `مثال: كلب، قطة، أسد`;

      const raw = await callClaude(prompt, useModel, env);
      if (!raw) return json({ error: 'Claude failed' }, 502);

      // Parse comma-separated response into array of cleaned words
      const picks = raw
        .split(/[،,\n]/)
        .map(w => w.trim().replace(/["'.]/g, ''))
        .filter(Boolean)
        .slice(0, count);

      return json({ picks, clue, num: count });
    }

    return new Response('Not found', { status: 404 });
  }
};

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
        max_tokens: 60,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await res.json();
    if (data?.error) { console.error('Claude:', data.error); return null; }
    return data?.content?.[0]?.text?.trim() || null;
  } catch (e) {
    console.error('fetch:', e);
    return null;
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
