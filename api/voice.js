// api/voice.js
// Gera áudio usando Gemini TTS (preview) e devolve como WAV simples

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY não configurada");
    return res.status(500).json({ error: "GEMINI_API_KEY is not set" });
  }

  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const { text } = body;

    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Missing text" });
    }

    // Chamada à API do Gemini TTS (single speaker)
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text }],
            },
          ],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  // Voz neutra e clara (você pode trocar depois, ex: "Puck", "Zephyr"...)
                  voiceName: "Kore",
                },
              },
            },
          },
          model: "gemini-2.5-flash-preview-tts",
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erro Gemini TTS:", response.status, errorText);
      return res.status(500).json({ error: "Gemini TTS request failed" });
    }

    const data = await response.json();
    const base64Pcm =
      data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Pcm) {
      console.error("Resposta do Gemini sem áudio");
      return res.status(500).json({ error: "No audio data from Gemini" });
    }

    const pcmBuffer = Buffer.from(base64Pcm, "base64");

    // Converte PCM cru em um WAV simples (mono, 24kHz, 16 bits)
    const sampleRate = 24000;
    const numChannels = 1;
    const bitsPerSample = 16;

    const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const dataSize = pcmBuffer.length;
    const chunkSize = 36 + dataSize;

    const header = Buffer.alloc(44);
    header.write("RIFF", 0); // ChunkID
    header.writeUInt32LE(chunkSize, 4); // ChunkSize
    header.write("WAVE", 8); // Format
    header.write("fmt ", 12); // Subchunk1ID
    header.writeUInt32LE(16, 16); // Subchunk1Size (PCM)
    header.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
    header.writeUInt16LE(numChannels, 22); // NumChannels
    header.writeUInt32LE(sampleRate, 24); // SampleRate
    header.writeUInt32LE(byteRate, 28); // ByteRate
    header.writeUInt16LE(blockAlign, 32); // BlockAlign
    header.writeUInt16LE(bitsPerSample, 34); // BitsPerSample
    header.write("data", 36); // Subchunk2ID
    header.writeUInt32LE(dataSize, 40); // Subchunk2Size

    const wavBuffer = Buffer.concat([header, pcmBuffer]);

    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(wavBuffer);
  } catch (err) {
    console.error("Erro geral no /api/voice:", err);
    return res.status(500).json({ error: "Internal TTS error" });
  }
}

