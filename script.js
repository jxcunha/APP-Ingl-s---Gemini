// APP Inglês – Professora interativa com Gemini (chat + voz)

const chatMessagesEl = document.getElementById("chat-messages");
const chatInputEl = document.getElementById("chat-input");
const chatSendBtn = document.getElementById("chat-send");
const statusEl = document.getElementById("chat-status");

const listenLastBtn = document.getElementById("btn-listen-last");
const speakVoiceBtn = document.getElementById("btn-speak-voice");

let lastBotReply =
  "Oi, Ju! Eu sou sua professora de inglês. Você pode falar comigo em português ou inglês que eu te ajudo.";

// ----- Utilitário para mostrar mensagens no chat -----
function appendMessage(text, who) {
  const div = document.createElement("div");
  div.classList.add("chat-msg");
  if (who === "me") {
    div.classList.add("me");
    div.textContent = text;
  } else {
    div.classList.add("bot");
    div.innerHTML = "<strong>Profa:</strong> " + text;
  }
  chatMessagesEl.appendChild(div);
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

// ----- Enviar mensagem para a API de chat (Gemini) -----
async function sendMessage(rawText) {
  const text = (rawText || "").trim();
  if (!text) return;

  appendMessage(text, "me");
  chatInputEl.value = "";
  statusEl.textContent = "Profa está pensando...";

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    });

    if (!res.ok) {
      throw new Error("Erro HTTP " + res.status);
    }

    const data = await res.json();
    const reply =
      (data.reply ||
        "Desculpa, não consegui responder agora. Tente de novo.") + "";

    lastBotReply = reply;
    appendMessage(reply, "bot");
    statusEl.textContent = "";

    // 🔊 Fala automaticamente assim que a resposta chega
    speakText(reply);
  } catch (err) {
    console.error(err);
    statusEl.textContent =
      "Erro ao falar com a professora. Confere a API /api/chat.";
  }
}

chatSendBtn.addEventListener("click", () => {
  sendMessage(chatInputEl.value);
});

chatInputEl.addEventListener("keydown", (ev) => {
  if (ev.key === "Enter") {
    ev.preventDefault();
    sendMessage(chatInputEl.value);
  }
});

// ----- Leitura em voz alta usando Gemini TTS -----
async function speakText(text) {
  const cleanText = (text || "").trim();
  if (!cleanText) return;

  statusEl.textContent = "Gerando áudio...";

  try {
    const res = await fetch("/api/voice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: cleanText }),
    });

    if (!res.ok) {
      throw new Error("Erro TTS " + res.status);
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);

    audio.onended = () => {
      URL.revokeObjectURL(url);
      statusEl.textContent = "";
    };

    await audio.play();
  } catch (err) {
    console.error("Erro Gemini TTS:", err);
    statusEl.textContent =
      "Não consegui gerar a voz agora.";
  }
}

// Botão "Ouvir última resposta" (vira REPLAY)
listenLastBtn.addEventListener("click", () => {
  if (!lastBotReply) {
    statusEl.textContent = "Ainda não tenho nenhuma resposta para ler.";
    return;
  }
  speakText(lastBotReply);
});

// ----- Reconhecimento de voz (entrada por fala) -----
let recognition = null;

if ("SpeechRecognition" in window || "webkitSpeechRecognition" in window) {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.lang = "pt-BR";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    statusEl.textContent = "Ouvindo... fale devagar.";
  };

  recognition.onend = () => {
    if (statusEl.textContent.startsWith("Ouvindo")) {
      statusEl.textContent = "";
    }
  };

  recognition.onerror = (event) => {
    console.error("Erro no reconhecimento de voz:", event.error);
    statusEl.textContent =
      "Erro no reconhecimento de voz: " + event.error;
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    chatInputEl.value = transcript;
    sendMessage(transcript);
  };
} else {
  console.warn("Web Speech API não disponível neste navegador.");
}

// Botão "Falar com a professora" (entrada de voz)
speakVoiceBtn.addEventListener("click", () => {
  if (!recognition) {
    statusEl.textContent =
      "Reconhecimento de voz não disponível neste navegador.";
    return;
  }
  statusEl.textContent = "";
  recognition.start();
});
