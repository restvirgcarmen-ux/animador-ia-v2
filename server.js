import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.6";
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_MODEL =
  process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";

app.use(cors());
app.use(express.json({ limit: "20mb" }));

/* =========================
   SALUD DEL BACKEND
========================= */

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "Animador IA Backend",
    version: "1.2.0",
    voiceEngine: ELEVENLABS_API_KEY ? "elevenlabs" : "not-configured"
  });
});

/* =========================
   GENERADOR DE GUIONES
========================= */

function templateScript(brief, style = "animador", energy = "media") {
  const templates = {
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
  };

  const t = templates[style] || templates.animador;

  let middle = String(brief).trim();

  if (energy === "alta" || energy === "explosiva") {
    middle = middle.replace(/[.,]/g, "!!!");
  } else if (energy === "media") {
    middle = middle.replace(/\./g, "!");
  }

  return `${t[0]}\n\n${middle}\n\n${t[1]}`;
}

app.post("/api/generate-script", (req, res) => {
  const {
    brief,
    style = "animador",
    energy = "media"
  } = req.body || {};

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

/* =========================
   GENERAR GUIÓN DESDE IMAGEN
========================= */

app.post("/api/generate-script-from-image", async (req, res) => {
  const {
    image,
    style = "animador",
    energy = "media"
  } = req.body || {};

  if (!image?.startsWith("data:image/")) {
    return res.status(400).json({
      ok: false,
      error: "Falta una imagen válida."
    });
  }

  if (!OPENAI_API_KEY) {
    return res.status(503).json({
      ok: false,
      error:
        "El análisis de imágenes necesita configurar OPENAI_API_KEY en Render."
    });
  }

  try {
    const prompt = `
Analiza esta imagen publicitaria y crea un guion breve,
claro y atractivo para un animador en español.

Extrae solamente información visible o razonablemente legible:

- nombre del negocio o evento
- fecha
- hora
- lugar
- precios
- promociones
- artistas
- productos
- llamados a la acción

No inventes datos.

Estilo: ${style}
Energía: ${energy}

Devuelve únicamente el guion final,
sin explicaciones ni listas.
`;

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`
        },

        body: JSON.stringify({
          model: OPENAI_MODEL,

          input: [
            {
              role: "user",

              content: [
                {
                  type: "input_text",
                  text: prompt
                },

                {
                  type: "input_image",
                  image_url: image
                }
              ]
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error?.message || "Error del servicio de IA."
      );
    }

    const script = data.output_text?.trim();

    if (!script) {
      throw new Error("La IA no devolvió un guion.");
    }

    res.json({
      ok: true,
      script,
      engine: "vision-ai"
    });

  } catch (error) {

    res.status(500).json({
      ok: false,
      error:
        error.message ||
        "No se pudo analizar la imagen."
    });
  }
});

/* =========================
   CREAR VOZ PERSONALIZADA
========================= */

/*
   Recibe una muestra de audio en Base64
   y crea una voz en ElevenLabs.

   IMPORTANTE:
   La clave de ElevenLabs permanece únicamente
   en el backend / Render.
*/

app.post("/api/voice/clone", async (req, res) => {

  if (!ELEVENLABS_API_KEY) {
    return res.status(503).json({
      ok: false,
      error:
        "Falta configurar ELEVENLABS_API_KEY en Render."
    });
  }

  const {
    audioBase64,
    name = "Mi voz"
  } = req.body || {};

  if (!audioBase64) {
    return res.status(400).json({
      ok: false,
      error: "Falta la muestra de voz."
    });
  }

  try {

    let mime = "audio/wav";
    let base64 = audioBase64;

    const match = audioBase64.match(
      /^data:(audio\/[^;]+);base64,(.+)$/s
    );

    if (match) {
      mime = match[1];
      base64 = match[2];
    }

    const audioBuffer = Buffer.from(base64, "base64");

    const blob = new Blob(
      [audioBuffer],
      { type: mime }
    );

    const form = new FormData();

    form.append(
      "name",
      String(name).trim() || "Mi voz"
    );

    const extensionByMime = {
      "audio/wav": "wav",
      "audio/wave": "wav",
      "audio/x-wav": "wav",
      "audio/mpeg": "mp3",
      "audio/mp3": "mp3",
      "audio/mp4": "m4a",
      "audio/x-m4a": "m4a",
      "audio/webm": "webm",
      "audio/ogg": "ogg",
      "audio/aac": "aac"
    };

    const extension =
      extensionByMime[mime] ||
      "audio";

    form.append(
      "files[]",
      blob,
      `voice-sample.${extension}`
    );

    const response = await fetch(
      "https://api.elevenlabs.io/v1/voices/add",
      {
        method: "POST",

        headers: {
          "xi-api-key": ELEVENLABS_API_KEY
        },

        body: form
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.detail?.message ||
        data?.detail ||
        "No se pudo crear la voz."
      );
    }

    if (!data.voice_id) {
      throw new Error(
        "ElevenLabs no devolvió un voice_id."
      );
    }

    res.json({
      ok: true,
      voice_id: data.voice_id,
      name: name,
      requires_verification:
        data.requires_verification || false
    });

  } catch (error) {

    console.error("VOICE CLONE ERROR:", error);

    res.status(500).json({
      ok: false,
      error:
        error.message ||
        "No se pudo crear la voz personalizada."
    });
  }
});

/* =========================
   GENERAR AUDIO CON LA VOZ
========================= */

app.post("/api/voice/generate", async (req, res) => {

  if (!ELEVENLABS_API_KEY) {
    return res.status(503).json({
      ok: false,
      error:
        "Falta configurar ELEVENLABS_API_KEY en Render."
    });
  }

  const {
    text,
    voice_id,
    rate = 1,
    pitch = 0.9
  } = req.body || {};

  if (!text?.trim()) {
    return res.status(400).json({
      ok: false,
      error: "Falta el texto del guion."
    });
  }

  if (!voice_id) {
    return res.status(400).json({
      ok: false,
      error:
        "Primero selecciona una voz personalizada."
    });
  }

  try {

    /*
       ElevenLabs controla principalmente
       la voz y sus parámetros.
       La velocidad se limita a valores seguros.
    */

    const speed = Math.max(
      0.7,
      Math.min(1.2, Number(rate) || 1)
    );

    const response = await fetch(
      "https://api.elevenlabs.io/v1/text-to-speech/" +
        encodeURIComponent(voice_id) +
        "?output_format=mp3_44100_128",
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
            similarity_boost: 0.85,
            style: 0.35,
            use_speaker_boost: true
          },

          speed
        })
      }
    );

    if (!response.ok) {

      const errorText =
        await response.text();

      let message =
        "No se pudo generar el audio.";

      try {

        const errorData =
          JSON.parse(errorText);

        message =
          errorData?.detail?.message ||
          errorData?.detail ||
          message;

      } catch {}

      throw new Error(message);
    }

    const audioBuffer =
      Buffer.from(
        await response.arrayBuffer()
      );

    res.setHeader(
      "Content-Type",
      "audio/mpeg"
    );

    res.setHeader(
      "Content-Length",
      audioBuffer.length
    );

    res.setHeader(
      "Cache-Control",
      "no-store"
    );

    res.send(audioBuffer);

  } catch (error) {

    console.error(
      "VOICE GENERATE ERROR:",
      error
    );

    res.status(500).json({
      ok: false,
      error:
        error.message ||
        "No se pudo generar el audio."
    });
  }
});

/* =========================
   SERVIDOR
========================= */

app.listen(PORT, () => {

  console.log(
    `Animador IA Backend escuchando en puerto ${PORT}`
  );

});
