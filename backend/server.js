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

app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "Animador IA Backend",
    version: "1.1.0",
    status: "online"
  });
});

app.get("/api/health", (req, res) =>
  res.json({
    ok: true,
    service: "Animador IA Backend",
    version: "1.1.0"
  })
);

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

app.post("/api/voice/clone", async (req, res) => {

  if (!ELEVENLABS_API_KEY) {
    return res.status(503).json({
      ok: false,
      error: "Falta configurar ELEVENLABS_API_KEY en Render."
    });
  }

  const {
    audioBase64,
    name = "Gerardo"
  } = req.body || {};

  if (!audioBase64) {
    return res.status(400).json({
      ok: false,
      error: "Falta la grabación de voz."
    });
  }

  try {

    // -----------------------------------------
    // Convertir Base64 recibido del navegador
    // a un archivo de audio
    // -----------------------------------------

    let base64Data = String(audioBase64);

    if (base64Data.includes(",")) {
      base64Data = base64Data.split(",")[1];
    }

    const audioBuffer = Buffer.from(base64Data, "base64");

    if (!audioBuffer.length) {
      return res.status(400).json({
        ok: false,
        error: "La grabación de voz está vacía."
      });
    }

    // -----------------------------------------
    // Crear formulario multipart para ElevenLabs
    // -----------------------------------------

    const form = new FormData();

    const audioBlob = new Blob(
      [audioBuffer],
      { type: "audio/webm" }
    );

    form.append(
      "files",
      audioBlob,
      "gerardo.webm"
    );

    form.append(
      "name",
      String(name).trim() || "Gerardo"
    );

    form.append(
      "description",
      "Voz personalizada autorizada para anuncios."
    );

    // -----------------------------------------
    // Crear Instant Voice Clone
    // -----------------------------------------

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

    // -----------------------------------------
    // Leer respuesta de ElevenLabs
    // -----------------------------------------

    const contentType =
      response.headers.get("content-type") || "";

    const responseText = await response.text();

    if (!response.ok) {

      console.error(
        "Error ElevenLabs clonando voz:",
        response.status,
        responseText
      );

      let errorMessage =
        "ElevenLabs no pudo crear la voz.";

      try {
        const errorData =
          JSON.parse(responseText);

        errorMessage =
          errorData?.detail?.message ||
          errorData?.detail ||
          errorData?.error ||
          errorMessage;

      } catch {
        if (responseText) {
          errorMessage = responseText;
        }
      }

      return res.status(response.status).json({
        ok: false,
        error: errorMessage
      });
    }

    // -----------------------------------------
    // ElevenLabs devuelve JSON
    // -----------------------------------------

    let data;

    try {
      data = JSON.parse(responseText);
    } catch {
      return res.status(500).json({
        ok: false,
        error: "ElevenLabs devolvió una respuesta inválida."
      });
    }

    if (!data?.voice_id) {
      return res.status(500).json({
        ok: false,
        error: "ElevenLabs no devolvió el voice_id."
      });
    }

    console.log(
      "Voz creada correctamente:",
      data.voice_id
    );

    // -----------------------------------------
    // Respuesta al navegador
    // -----------------------------------------

    return res.json({
      ok: true,
      voice_id: data.voice_id,
      name: String(name).trim() || "Gerardo",
      requires_verification:
        data.requires_verification || false
    });

  } catch (e) {

    console.error(
      "Error interno clonando voz:",
      e
    );

    return res.status(500).json({
      ok: false,
      error:
        e.message ||
        "No se pudo crear la voz personalizada."
    });
  }
});

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

app.post("/api/generate-script-from-image", async (req, res) => {
  const { image, style = "animador", energy = "media" } = req.body || {};

  if (!image?.startsWith("data:image/")) {
    return res.status(400).json({
      ok: false,
      error: "Falta una imagen válida."
    });
  }

  if (!OPENAI_API_KEY) {
    return res.status(503).json({
      ok: false,
      error: "El análisis de imágenes necesita configurar OPENAI_API_KEY en Render."
    });
  }

  try {
    const prompt = `Analiza esta imagen publicitaria y crea un guion breve, claro y atractivo para un animador en español. Extrae solamente información visible o razonablemente legible: nombre del negocio/evento, fecha, hora, lugar, precios, promociones, artistas, productos y llamados a la acción. No inventes datos. Estilo: ${style}. Energía: ${energy}. Devuelve únicamente el guion final, sin explicaciones ni listas.`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: [{
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            { type: "input_image", image_url: image }
          ]
        }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error?.message || "Error del servicio de IA.");
    }

    const script = data.output_text?.trim();

    if (!script) {
      throw new Error("La IA no devolvió un guion.");
    }

    res.json({ ok: true, script, engine: "vision-ai" });
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: e.message || "No se pudo analizar la imagen."
    });
  }
});

app.post("/api/voice/generate", async (req, res) => {

  if (!ELEVENLABS_API_KEY) {
    return res.status(503).json({
      ok: false,
      error: "Falta configurar ELEVENLABS_API_KEY en Render."
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
      error: "Primero selecciona una voz personalizada."
    });
  }

  try {

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
            similarity_boost: 0.8,
            style: 0.25,
            use_speaker_boost: true
          }
        })
      }
    );

    if (!response.ok) {

      const errorText = await response.text();

      throw new Error(
        errorText || "ElevenLabs no pudo generar el audio."
      );
    }

    const audioBuffer = Buffer.from(
      await response.arrayBuffer()
    );

    res.set({
      "Content-Type": "audio/mpeg",
      "Content-Length": audioBuffer.length,
      "Cache-Control": "no-store"
    });

    res.send(audioBuffer);

  } catch (e) {

    console.error("Error generando voz:", e);

    res.status(500).json({
      ok: false,
      error: e.message || "No se pudo generar el audio."
    });
  }
});

app.listen(PORT, () =>
  console.log(`Animador IA Backend escuchando en puerto ${PORT}`)
);
