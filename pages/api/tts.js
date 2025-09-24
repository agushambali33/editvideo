export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { text } = req.body || {};
  if (!text) return res.status(400).json({ error: 'text required' });

  const key = process.env.OPENAI_API_KEY;
  if (!key) return res.status(500).json({ error: 'OpenAI API key not configured' });

  try {
    const r = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini-tts',
        voice: 'alloy',
        input: text
      })
    });

    if (!r.ok) {
      const t = await r.text();
      console.error('TTS error', r.status, t);
      return res.status(500).json({ error: 'TTS generation failed' });
    }

    const arrayBuffer = await r.arrayBuffer();
    const buffer = Buffer.from(new Uint8Array(arrayBuffer));
    const base64 = buffer.toString('base64');
    return res.json({ audio: base64 });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'tts error' });
  }
}
