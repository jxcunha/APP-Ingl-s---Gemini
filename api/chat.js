// api/chat.js — Gemini com respostas curtas e controle de idioma/tradução

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY is not set");
    return res.status(500).json({ error: "GEMINI_API_KEY is not set" });
  }

  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const { message } = body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Missing message" });
    }

    const lower = message.toLowerCase();

    // -------------------------------------------------
    // 1) DETECTAR SE O USUÁRIO PEDIU UM IDIOMA ESPECÍFICO
    // -------------------------------------------------
    let forcedLanguage = null; // "english" ou "portuguese"

    // Pede resposta/tradução em inglês
    if (
      lower.includes("responda em inglês") ||
      lower.includes("responder em inglês") ||
      lower.includes("resposta em inglês") ||
      lower.includes("em ingles") || // sem acento
      lower.includes("para o inglês") ||
      lower.includes("para ingles") ||
      lower.includes("traduza para o inglês") ||
      lower.includes("traduz para o inglês") ||
      lower.includes("como se fala") && lower.includes("em inglês") ||
      lower.includes("translate to english") ||
      lower.includes("answer in english") ||
      lower.includes("reply in english")
    ) {
      forcedLanguage = "english";
    }

    // Pede resposta/tradução em português
    if (
      lower.includes("responda em português") ||
      lower.includes("responder em português") ||
      lower.includes("resposta em português") ||
      lower.includes("para o português") ||
      lower.includes("para portugues") ||
      lower.includes("traduza para o português") ||
      lower.includes("traduza a sentença para o português") ||
      lower.includes("traduza a frase para o português") ||
      lower.includes("translate this sentence to portuguese") ||
      lower.includes("translate to portuguese") ||
      lower.includes("how do you say in portuguese")
    ) {
      forcedLanguage = "portuguese";
    }

    // -------------------------------------------------
    // 2) HEURÍSTICA: A FRASE PARECE MAIS INGLÊS OU PORTUGUÊS?
    // -------------------------------------------------
    const looksEnglish =
      /[a-zA-Z]/.test(message) && !/[áéíóúàãõâêôç]/i.test(message);

    let targetLanguage; // "english" ou "portuguese"

    if (forcedLanguage) {
      // Se o usuário pediu explicitamente um idioma, obedecemos
      targetLanguage = forcedLanguage;
    } else {
      // Regra padrão:
      // - frase parece inglês  -> responde em inglês
      // - caso contrário       -> responde em português
      targetLanguage = looksEnglish ? "english" : "portuguese";
    }

    // -------------------------------------------------
    // 3) PROMPT DE SISTEMA CONFORME O IDIOMA ALVO
    // -------------------------------------------------
    let systemPrompt;

    if (targetLanguage === "english") {
      // Regra 1 e 2:
      // - frase em inglês -> responde em inglês
      // - frase em português pedindo tradução p/ inglês -> responde em inglês
      systemPrompt =
        "You are an English teacher. " +
        "Default rule: answer ONLY in English, using simple vocabulary and a maximum of two sentences. " +
        "If the student explicitly asks for a translation to Portuguese, then translate and answer in Portuguese instead.";
    } else {
      // Regra 3 e 4:
      // - pedido de tradução p/ português -> responde em português
      // - frase normal em português -> responde em português
      systemPrompt =
        "Você é professora de inglês. " +
        "Regra padrão: responda SOMENTE em português, com linguagem simples e no máximo duas frases. " +
        "Se o estudante pedir explicitamente para responder em inglês ou traduzir para o inglês, então responda em inglês.";
    }

    // -------------------------------------------------
    // 4) CHAMADA À API GEMINI
    // -------------------------------------------------
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
                    systemPrompt +
                    "\n\nStudent message:\n" +
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
      console.error("Gemini API error:", geminiRes.status, text);
      return res.status(500).json({ error: "Gemini API error" });
    }

    const data = await geminiRes.json();

    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      "Desculpa, não consegui responder agora.";

    return res.status(200).json({ reply });
  } catch (err) {
    console.error("API /api/chat error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
