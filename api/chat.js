// api/chat.js
// Função serverless da Vercel: recebe o texto do app,
// chama a OpenAI via HTTP e devolve { reply: "texto da professora" }.

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
    // Vercel às vezes manda o body como string
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const { message } = body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Missing message" });
    }

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Você é uma professora de inglês da Ju. Responda curto, claro e de forma educativa.",
          },
          {
            role: "user",
            content: message,
          },
        ],
      }),
    });

    if (!openaiRes.ok) {
      const text = await openaiRes.text();
      console.error("Erro da OpenAI:", openaiRes.status, text);
      return res.status(500).json({ error: "OpenAI API error" });
    }

    const result = await openaiRes.json();
    const reply =
      result.choices?.[0]?.message?.content?.trim() ||
      "Desculpa, não consegui responder agora. Tente de novo.";

    return res.status(200).json({ reply });
  } catch (err) {
    console.error("API /api/chat error:", err);
    return res.status(500).json({ error: "API error" });
  }
}
