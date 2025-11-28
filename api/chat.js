// api/chat.js — Gemini com respostas curtas e controle de idioma/tradução/correção

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
    // 1) VER SE O USUÁRIO PEDIU EXPLICITAMENTE UM IDIOMA
    // -------------------------------------------------
    let forcedLanguage = null; // "english" ou "portuguese"

    const asksEnglish =
      lower.includes("responda em inglês") ||
      lower.includes("responder em inglês") ||
      lower.includes("resposta em inglês") ||
      lower.includes("em ingles") ||
      lower.includes("para o inglês") ||
      lower.includes("para ingles") ||
      lower.includes("traduza para o inglês") ||
      lower.includes("traduza para ingles") ||
      (lower.includes("como se fala") && lower.includes("em inglês")) ||
      lower.includes("translate to english") ||
      lower.includes("answer in english") ||
      lower.includes("reply in english");

    const asksPortuguese =
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
      lower.includes("how do you say in portuguese");

    if (asksEnglish) {
      forcedLanguage = "english";
    } else if (asksPortuguese) {
      forcedLanguage = "portuguese";
    }

    // -------------------------------------------------
    // 2) HEURÍSTICA: A FRASE PARECE MAIS EN OU PT?
    // -------------------------------------------------
    const looksEnglish =
      /[a-zA-Z]/.test(message) && !/[áéíóúàãõâêôç]/i.test(message);

    let targetLanguage;

    if (forcedLanguage) {
      // se o usuário pediu um idioma, obedecemos
      targetLanguage = forcedLanguage;
    } else {
      // regra padrão
      targetLanguage = looksEnglish ? "english" : "portuguese";
    }

    // -------------------------------------------------
    // 3) PROMPT DE SISTEMA CONFORME O IDIOMA ALVO
    // -------------------------------------------------
    let systemPrompt;

    if (targetLanguage === "english") {
      // Regra padrão EN:
      // - frase em inglês -> responde em inglês
      // - PT pedindo tradução p/ inglês -> responde em inglês
      // EXTRA: se houver erro de inglês, explicar em PT e dar exemplos em EN
      systemPrompt =
        "You are an English teacher. " +
        "Default rule: answer ONLY in English, using simple vocabulary and at most two sentences. " +
        "HOWEVER, when the student writes an English sentence that is incorrect, or asks if a sentence is correct, " +
        "you must explain the correction in Brazilian Portuguese, and always show the corrected examples in English. " +
        "If the student explicitly asks for a translation to Portuguese, then answer in Portuguese only.";
    } else {
      // Regra padrão PT:
      // - pedido de tradução p/ PT -> responde em PT
      // - frase normal em PT -> responde em PT
      systemPrompt =
        "Você é professora de inglês. " +
        "Regra padrão: responda SOMENTE em português, com linguagem simples e no máximo duas frases. " +
        "Quando o estudante pedir para responder em inglês ou traduzir para o inglês, então responda em inglês, " +
        "também em no máximo duas frases.";
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

