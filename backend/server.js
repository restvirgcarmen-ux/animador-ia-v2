import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Buffer } from "buffer";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_MODEL = process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";

app.use(cors({
  origin: "*",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: "20mb" }));

// RUTA PRINCIPAL DE CONTROL
app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "Animador IA Backend",
    version: "1.1.0",
    status: "online"
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "Animador IA Backend",
    version: "1.1.0"
  });
});

function templateScript(brief, style = "animador", energy = "media") {
  const stylesMap = new Map([
    ["animador", ["¡ATENCIÓN, ATENCIÓN, SEÑORES Y SEÑORAS!", "¡No te lo puedes perder! ¡Te esperamos!"]],
    ["fiesta", ["¡¡¡PREPÁRATE PARA LA FIESTA!!!", "¡¡¡QUE EMPIECE LA FIESTA!!!"]],
    ["comercial", ["Atención a todos nuestros amigos y clientes.", "Los esperamos. ¡No faltes!"]],
    ["orquesta", ["¡Señoras y señores, amantes de la buena música!", "¡Recibamos este gran espectáculo con un fuerte aplauso!"]]
  ]);

  const selectedStyle = stylesMap.get(style) || ["¡ATENCIÓN, ATENCIÓN!", "¡Te esperamos!"];
  const intro = selectedStyle.slice(0, 1).shift();
  const outro = selectedStyle.slice(1, 2).shift();

  let middle = String(brief).trim();

  if (energy === "alta" || energy === "explosiva") {
    middle = middle.replace(/[.,]/g, "!!!");
  } else if (energy === "media") {
    middle = middle.replace(/\./g, "!");
  }

  return `${intro}\n\n${middle}\n\n${outro}`;
}

app.post("/api/generate-script", (req, res) => {
  const { brief, style = "animador", energy = "media" } = req.body || {};

  if (!brief?.trim()) {
    return res.status(400).json({
      ok: false,
      error: "Falta el texto del anuncio."
    });
  }

  res.json({
    ok: true,
    script: templateScript(brief, style, energy),
    engine: "template-v1"
  });
});

// ======================================================
// ENDPOINT: CLONACIÓN DE VOZ (LÍNEAS 82 A 148 EN TU ARCHIVO)
// ======================================================
app.post("/api/voice/clone", async (req, res) => {
  console.log("================================");
  console.log("CLONE VOICE: PROCESANDO AUDIO");
  console.log("================================");

  if (!ELEVENLABS_API_KEY) {
    return res.status(503).json({ ok: false, error: "Falta configurar la API Key en el servidor." });
  }

  try {
    const { audioBase64, name } = req.body || {};

    if (!audioBase64 || !name?.trim()) {
      return res.status(400).json({ ok: false, error: "Faltan datos obligatorios de la voz." });
    }

    let base64Data = audioBase64;
    let mimeType = "audio/mpeg";

    if (String(audioBase64).includes(";base64,")) {
      const parts = String(audioBase64).split(";base64,");
      const rawMime = parts.shift() || "";
      mimeType = rawMime.replace("data:", "");
      base64Data = parts.pop() || "";
    }

    base64Data = base64Data.replace(/[\s\r\n]+/g, "");
    const audioBuffer = Buffer.from(base64Data, "base64");

    if (audioBuffer.length === 0) {
      return res.status(400).json({ ok: false, error: "El archivo de audio está vacío." });
    }

    let extension = "mp3";
    if (mimeType.includes("wav")) extension = "wav";
    if (mimeType.includes("webm")) extension = "webm";
    if (mimeType.includes("ogg")) extension = "ogg";
    if (mimeType.includes("mp4") || mimeType.includes("m4a")) extension = "m4a";

    const boundary = "----WebKitFormBoundary" + Math.random().toString(16).substring(2);
    
    const header = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="audio_clonado.${extension}"\r\nContent-Type: ${mimeType}\r\n\r\n`
    );
    const middleField = Buffer.from(
      `\r\n--${boundary}\r\nContent-Disposition: form-data; name="name"\r\n\r\n${name.trim()}\r\n--${boundary}--\r\n`
    );
    
    const bodyBuffer = Buffer.concat([header, audioBuffer, middleField]);

    const response = await fetch("https://elevenlabs.io", {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": `multipart/form-data; boundary=${boundary}`
      },
      body: bodyBuffer
    });

    const data = await response.json();
    
    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        error: data?.detail?.message || data?.message || "ElevenLabs rechazó la muestra de voz."
      });
    }

    return res.json({
      ok: true,
      voice_id: data.voice_id,
      requires_verification: data.requires_verification || false
    });

  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// ======================================================
// ENDPOINT: GENERACIÓN DE ANUNCIO TEXT-TO-SPEECH (LÍNEAS 149 A 206)
// ======================================================
app.post("/api/voice/clone", async (req, res) => {
  console.log("================================");
  console.log("CLONE VOICE: PROCESANDO CON FORMDATA");
  console.log("================================");

  if (!ELEVENLABS_API_KEY) {
    return res.status(503).json({ ok: false, error: "Falta configurar la API Key en el servidor." });
  }

  try {
    const { audioBase64, name } = req.body || {};

    if (!audioBase64 || !name?.trim()) {
      return res.status(400).json({ ok: false, error: "Faltan datos obligatorios de la voz." });
    }

    let base64Data = audioBase64;
    let mimeType = "audio/mpeg";

    if (String(audioBase64).includes(";base64,")) {
      const parts = String(audioBase64).split(";base64,");
      const rawMime = parts.shift() || "";
      mimeType = rawMime.replace("data:", "");
      base64Data = parts.pop() || "";
    }

    base64Data = base64Data.replace(/[\s\r\n]+/g, "");
    const audioBuffer = Buffer.from(base64Data, "base64");

    if (audioBuffer.length === 0) {
      return res.status(400).json({ ok: false, error: "El archivo de audio está vacío." });
    }

    let extension = "mp3";
    if (mimeType.includes("wav")) extension = "wav";
    if (mimeType.includes("webm")) extension = "webm";
    if (mimeType.includes("ogg")) extension = "ogg";
    if (mimeType.includes("mp4") || mimeType.includes("m4a")) extension = "m4a";

    // SOLUCIÓN DEFINITIVA: Usamos el objeto nativo FormData de Node.js
    const form = new FormData();
    
    // Convertimos el Buffer a un archivo Blob virtual legible por la API de ElevenLabs
    const audioBlob = new Blob([audioBuffer], { type: mimeType });
    
    form.append("files", audioBlob, `audio_clonado.${extension}`);
    form.append("name", name.trim());

    // Realizamos la petición sin definir 'Content-Type' manualmente (fetch lo calcula solo)
    const response = await fetch("https://elevenlabs.io", {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY
      },
      body: form
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error("Error devuelto por ElevenLabs:", data);
      return res.status(response.status).json({
        ok: false,
        error: data?.detail?.message || data?.message || "ElevenLabs rechazó la muestra de voz."
      });
    }

    return res.json({
      ok: true,
      voice_id: data.voice_id,
      requires_verification: data.requires_verification || false
    });

  } catch (e) {
    console.error("EXCEPCIÓN EN CLONACIÓN:", e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor activo en el puerto ${PORT}`);
});
