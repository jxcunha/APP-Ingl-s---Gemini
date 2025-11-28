// api/chat.js — Gemini com controle de idioma, tradução e correção

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
    // 0) CLASSIFICAR O TIPO DE PEDIDO
    // -------------------------------------------------
    // Quer tradução para inglês? (ex: "como se diz ... em inglês", "traduza para o inglês")
    const wantsToEnglishTranslation =
      (lower.includes("como se diz") && lower.includes("em ingles")) ||
      (lower.includes("como se fala") && lower.includes("em ingles")) ||
      lower.includes("traduza para o inglês") ||
      lower.includes("traduza para ingles") ||
      lower.includes("tradução para o inglês") ||
      lower.includes("traduza isso para o inglês") ||
      lower.includes("translate to english") ||
      lower.includes("translate this sentence to english");

    // Quer tradução para português? (ex: "translate to Portuguese")
    const wantsToPortugueseTranslation =
      lower.includes("traduza para o português") ||
      lower.includes("traduza para portugues") ||
      lower.includes("traduza a sentença para o português") ||
      lower.includes("traduza a frase para o português") ||
      lower.includes("translate this sentence to portuguese") ||
      lower.includes("translate to portuguese") ||
      lower.includes("how do you say in portuguese");

    // -------------------------------------------------
    // 1) SE TIVER PEDIDO CLARO DE TRADUÇÃO, ENTRA EM MODO ESPECIAL
    // -------------------------------------------------
    let mode = "normal"; // "normal" | "toEnglish" | "toPortuguese"

    if (wantsToEnglishTranslation) {
      mode = "toEnglish";
    } else if (wantsToPortugueseTranslation) {
      mode = "toPortuguese";
    }

    // -------------------------------------------------
    // 2) LÓGICA DE IDIOMA PARA O MODO "NORMAL"
    // -------------------------------------------------
    let forcedLanguage = null; // "english" ou "portuguese"

    const asksEnglish =
      lower.includes("responda em inglês") ||
      lower.includes("responder em inglês") ||
      lower.includes("resposta em inglês") ||
      lower.includes("em ingles") ||
      lower.includes("answer in english") ||
      lower.includes("reply in english");

    const asksPortuguese =
      lower.includes("responda em português") ||
      lower.includes("responder em português") ||
      lower.includes("resposta em português") ||
      lower.includes("resposta em portugues") ||
      lower.includes("answer in portuguese");

    if (asksEnglish) {
      forcedLanguage = "english";
    } else if (asksPortuguese) {
      forcedLanguage = "portuguese";
    }

    // Heurística: parece mais inglês ou português?
    const looksEnglish =
      /[a-zA-Z]/.test(message) && !/[áéíóúàãõâêôç]/i.test(message);

    let targetLanguage = "portuguese"; // default

    if (mode === "normal") {
      if (forcedLanguage) {
        targetLanguage = forcedLanguage;
      } else {
        targetLanguage = looksEnglish ? "english" : "portuguese";
      }
    } else if (mode === "toEnglish") {
      // caso especial: tradução para inglês -> resposta em PT explicando + exemplos em EN
      targetLanguage = "portuguese";
    } else if (mode === "toPortuguese") {
      // tradução para português -> resposta em PT
      targetLanguage = "portuguese";
    }

    // -------------------------------------------------
    // 3) MONTAR O PROMPT DE SISTEMA
    // -------------------------------------------------
    let systemPrompt = "";

    if (mode === "toEnglish") {
      // 💙 CASO ESPECIAL QUE VOCÊ QUER:
      // pergunta tipo "como se diz 'eu vou viajar' em inglês"
      // → resposta em PORTUGUÊS com exemplos em INGLÊS
      systemPrompt =
        "Você é professora de inglês. " +
        "O estudante está perguntando como dizer algo em inglês. " +
        "Responda SEMPRE em português, de forma simples, em no máximo duas frases, " +
        "mas inclua uma ou mais opções CORRETAS em inglês entre aspas. " +
        "Exemplo de estilo: 'Você pode falar \"I am going to travel.\" Ou também \"I will travel.\"'.";
    } else if (mode === "toPortuguese") {
      // tradução para português
      systemPrompt =
        "Você é professora de inglês. " +
        "O estudante quer uma tradução para o português. " +
        "Explique de forma simples em português, em no máximo duas frases, " +
        "podendo citar a frase original em inglês se for útil.";
    } else {
      // modo normal (sem pedido claro de tradução)
      if (targetLanguage === "english") {
        systemPrompt =
          "You are an English teacher. " +
          "Default rule: answer ONLY in English, using simple vocabulary and at most two sentences. " +
          "When the student writes an incorrect English sentence or asks if a sentence is correct, " +
          "you must explain the correction in Brazilian Portuguese and show the corrected examples in English. " +
          "If the student explicitly asks for a translation to Portuguese, then answer in Portuguese only.";
      } else {
        systemPrompt =
          "Você é professora de inglês. " +
          "Regra padrão: responda SOMENTE em português, com linguagem simples e no máximo duas frases. " +
          "Quando o estudante pedir explicitamente para responder em inglês ou para traduzir algo para o inglês, " +
          "então responda em inglês, também em no máximo duas frases.";
      }
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
