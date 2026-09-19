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

// Configuración de CORS habilitada para todas las peticiones externas
app.use(cors({
  origin: "*",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: "20mb" }));

// RUTA PRINCIPAL (CORREGIDA: Ya no saldrá Cannot GET /)
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
  const t = {
    animador: [
      "¡ATENCIÓN, ATENCIÓN, SEÑORES Y SEÑORAS!",
      "¡No te lo puedes perder! ¡Te esperamos!"
    ],
    fiesta: [
      "¡¡¡PREPÁRATE PARA LA FIESTA!!!",
      "¡¡¡QUE EMPIECE LA FIESTA!!!"
    ],
    comercial: [
      "Atención a todos nuestros amigos y clientes.",
      "Los esperamos. ¡No faltes!"
    ],
    orquesta: [
      "¡Señoras y señores, amantes de la buena música!",
      "¡Recibamos este gran espectáculo con un fuerte aplauso!"
    ]
  }[style] || ["¡ATENCIÓN, ATENCIÓN!", "¡Te esperamos!"];

  let middle = String(brief).trim();

  if (energy === "alta" || energy === "explosiva") {
    middle = middle.replace(/[.,]/g, "!!!");
  } else if (energy === "media") {
    middle = middle.replace(/\./g, "!");
  }

  return `${t[0]}\n\n${middle}\n\n${t[1]}`;
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

// ENDPOINT: CLONACIÓN DE VOZ (REPARADO Y SEGURO)
app.post("/api/voice/clone", async (req, res) => {
  console.log("================================");
  console.log("CLONE VOICE: PETICIÓN RECIBIDA");
  console.log("================================");

  if (!ELEVENLABS_API_KEY) {
    return res.status(503).json({
      ok: false,
      error: "Falta configurar ELEVENLABS_API_KEY en el servidor."
    });
  }

  try {
    const { audioBase64, name } = req.body || {};

    if (!audioBase64) {
      return res.status(400).json({ ok: false, error: "No se recibió la muestra de voz." });
    }

    if (!name?.trim()) {
      return res.status(400).json({ ok: false, error: "Falta el nombre de la voz." });
    }

    let mimeType = "audio/mpeg";
    let base64Data = "";

    if (typeof audioBase64 === 'string' && audioBase64.includes(";base64,")) {
      const parts = audioBase64.split(";base64,");
      let rawMime = parts.shift();
      mimeType = rawMime.replace("data:", "");
      base64Data = parts.pop();
    } else {
      base64Data = audioBase64;
    }

    base64Data = String(base64Data).replace(/[\s\r\n]+/g, "");
    const audioBuffer = Buffer.from(base64Data, "base64");

    if (audioBuffer.length === 0) {
      return res.status(400).json({ ok: false, error: "El archivo de audio está vacío o corrupto." });
    }

    const extension = mimeType.includes("wav") ? "wav" : mimeType.includes("mpeg") ? "mp3" : "m4a";
    const boundary = "----WebKitFormBoundary" + Math.random().toString(16).substring(2);
    
    const header = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="voz.${extension}"\r\nContent-Type: ${mimeType}\r\n\r\n`
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

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error("ElevenLabs devolvió una respuesta inesperada.");
    }

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.detail?.message || data?.message || "ElevenLabs no pudo crear la voz.");
    }

    return res.json({
      ok: true,
      voice_id: data.voice_id,
      requires_verification: data.requires_verification || false
    });

  } catch (e) {
    console.error("ERROR CLONANDO VOZ:", e);
    return res.status(500).json({
      ok: false,
      error: e.message || "No se pudo crear la voz."
    });
  }
});

// ENDPOINT: GENERACIÓN DE AUDIO TEXT-TO-SPEECH (COMPLETO)
app.post("/api/voice/generate", async (req, res) => {
  if (!ELEVENLABS_API_KEY) {
    return res.status(503).json({
      ok: false,
      error: "Falta configurar ELEVENLABS_API_KEY en el servidor."
    });
  }

  const { text, voice_id } = req.body || {};

  if (!text?.trim()) {
    return res.status(400).json({ ok: false, error: "Falta el texto del guion." });
  }

  if (!voice_id) {
    return res.status(400).json({ ok: false, error: "Primero selecciona una voz personalizada." });
  }

  try {
    const response = await fetch(
      `https://elevenlabs.io{encodeURIComponent(voice_id)}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
          "Accept": "audio/mpeg"
        },
        body: JSON.stringify({
          text: String(text).trim(),
          model_id: ELEVENLABS_MODEL,
          language_code: "es",
          voice_settings: {
            stability: 0.45,
            similarity_boost: 0.8,
            style: 0.25,
            use_speaker_boost: true
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "ElevenLabs no pudo generar el audio.");
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    res.set({
      "Content-Type": "audio/mpeg",
      "Content-Length": audioBuffer.length
    });

    return res.send(audioBuffer);

  } catch (e) {
    console.error("ERROR GENERANDO AUDIO:", e);
    return res.status(500).json({
      ok: false,
      error: e.message || "No se pudo procesar la conversión."
    });
  }
});

// ENDPOINT: INTELIGENCIA ARTIFICIAL CON IMAGENES (REPARADO)
app.post("/api/generate-script-from-image", async (req, res) => {
  const { image, style = "animador", energy = "media" } = req.body || {};

  if (!image?.startsWith("data:image/")) {
    return res.status(400).json({ ok: false, error: "Falta una imagen válida." });
  }

  if (!OPENAI_API_KEY) {
    return res.status(503).json({ ok: false, error: "Falta la clave de OpenAI." });
  }

  try {
    const prompt = `Analiza esta imagen publicitaria y crea un guion breve y atractivo para un animador en español. Extrae el nombre del negocio, fechas, lugar y promociones. Estilo: ${style}. Energía: ${energy}. Devuelve únicamente el guion final.`;

    const response = await fetch("https://openai.com", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: image } }
          ]
        }]
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || "Error de OpenAI.");

    const script = data.choices[0].message.content.trim();
    res.json({ ok: true, script, engine: "vision-ai" });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor activo corriendo en http://localhost:${PORT}`);
});
