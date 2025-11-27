// api/voice.js
// Gera áudio usando a voz neural da OpenAI (Text-to-Speech)

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("Faltando OPENAI_API_KEY nas variáveis de ambiente");
    return res.status(500).json({ error: "OPENAI_API_KEY is not set" });
  }

  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const { text } = body;

    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Missing text" });
    }

    const openaiRes = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini-tts",
        voice: "alloy",
        input: text,
        format: "mp3",
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.error("Erro da OpenAI TTS:", openaiRes.status, errText);
      return res.status(500).json({ error: "OpenAI TTS error" });
    }

    const arrayBuffer = await openaiRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(buffer);
  } catch (err) {
    console.error("Erro na rota /api/voice:", err);
    return res.status(500).json({ error: "API voice error" });
  }
}
