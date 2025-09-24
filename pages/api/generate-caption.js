export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { prompt } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'prompt required' });

  const key = process.env.OPENAI_API_KEY;
  if (!key) return res.status(500).json({ error: 'OpenAI API key not configured' });

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: `Buat 1 caption singkat (bahasa Indonesia) dan 6 hashtag relevan untuk: ${prompt}` }],
        max_tokens: 200,
        temperature: 0.8,
      }),
    });

    if (!r.ok) {
      const t = await r.text();
      console.error('OpenAI error', r.status, t);
      return res.status(500).json({ error: 'OpenAI API error' });
    }

    const data = await r.json();
    const txt = data?.choices?.[0]?.message?.content || '';

    const lines = txt.split(/\n+/).map(s=>s.trim()).filter(Boolean);
    let caption = '';
    let hashtags = [];
    for (const line of lines) {
      if (/^caption[:\-]/i.test(line)) {
        caption = line.replace(/^caption[:\-]/i, '').trim();
      } else if (/^hashtags?:/i.test(line)) {
        hashtags = line.replace(/^hashtags?:/i, '').trim().split(/\s+/).filter(Boolean);
      } else {
        if (!caption) caption = line;
        else if (line.includes('#')) hashtags = hashtags.concat(line.split(/\s+/).filter(w=>w.startsWith('#')));
      }
    }

    return res.json({ caption, hashtags });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'error generating caption' });
  }
}
