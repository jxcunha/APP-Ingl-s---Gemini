// api/chat.js
// Função serverless da Vercel: recebe o texto do app,
// chama a API Gemini e devolve { reply: "texto da professora" }.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  // 👉 Agora usamos GEMINI_API_KEY (não mais OPENAI_API_KEY)
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Faltando GEMINI_API_KEY nas variáveis de ambiente");
    return res.status(500).json({ error: "GEMINI_API_KEY is not set" });
  }

  try {
    // Vercel às vezes manda o body como string
    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const { message } = body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Missing message" });
    }

    // 👉 Chamada à API Gemini (modelo de texto)
    const geminiRes = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text:
                    "Você é uma professora de inglês da Ju. " +
                    "Responda curto, claro e de forma educativa.\n\n" +
                    "Pergunta da Ju: " +
                    message,
                },
              ],
            },
          ],
        }),
      }
    );

    if (!geminiRes.ok) {
      const text = await geminiRes.text();
      console.error("Erro da Gemini API:", geminiRes.status, text);
      return res.status(500).json({ error: "Gemini API error" });
    }

    const data = await geminiRes.json();

    // 👉 Pega o texto da resposta no formato do Gemini
    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      "Desculpa, não consegui responder agora. Tente de novo.";

    return res.status(200).json({ reply });
  } catch (err) {
    console.error("API /api/chat (Gemini) error:", err);
    return res.status(500).json({ error: "API error" });
  }
}
