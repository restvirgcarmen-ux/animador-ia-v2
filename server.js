import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.6";

app.use(cors());
app.use(express.json({ limit: "12mb" }));

// ─────────────────────────────────────
// SALUD DEL BACKEND
// ─────────────────────────────────────

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "Animador IA Backend",
    version: "1.2.0"
  });
});

// ─────────────────────────────────────
// GENERAR GUIÓN
// ─────────────────────────────────────

function templateScript(
  brief,
  style = "animador",
  energy = "media"
) {
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

  const t =
    templates[style] ||
    [
      "¡ATENCIÓN, ATENCIÓN!",
      "¡Te esperamos!"
    ];

  let middle = String(brief).trim();

  if (energy === "alta" || energy === "explosiva") {
    middle = middle.replace(/[.,]/g, "!!!");
  } else if (energy === "media") {
    middle = middle.replace(/\./g, "!");
  }

  return `${t[0]}

${middle}

${t[1]}`;
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

// ─────────────────────────────────────
// GENERAR GUIÓN DESDE IMAGEN
// ─────────────────────────────────────

app.post(
  "/api/generate-script-from-image",
  async (req, res) => {
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

Estilo: ${style}.
Energía: ${energy}.

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
          data?.error?.message ||
          "Error del servicio de IA."
        );
      }

      const script = data.output_text?.trim();

      if (!script) {
        throw new Error(
          "La IA no devolvió un guion."
        );
      }

      res.json({
        ok: true,
        script,
        engine: "vision-ai"
      });

    } catch (e) {
      res.status(500).json({
        ok: false,
        error:
          e.message ||
          "No se pudo analizar la imagen."
      });
    }
  }
);

// ─────────────────────────────────────
// GENERAR AUDIO CON VOZ
// ─────────────────────────────────────

app.post("/api/voice/generate", async (req, res) => {
  const {
    text,
    voiceId,
    speed = 1.0,
    instructions = ""
  } = req.body || {};

  if (!text?.trim()) {
    return res.status(400).json({
      ok: false,
      error: "Falta el texto para generar la voz."
    });
  }

  if (!OPENAI_API_KEY) {
    return res.status(503).json({
      ok: false,
      error:
        "Falta configurar OPENAI_API_KEY en el backend."
    });
  }

  try {
    const voice = voiceId
      ? { id: voiceId }
      : "marin";

    const response = await fetch(
      "https://api.openai.com/v1/audio/speech",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`
        },

        body: JSON.stringify({
          model: "gpt-4o-mini-tts",
          voice,
          input: text.trim(),
          instructions:
            instructions ||
            "Habla en español con voz de animador, clara, natural, alegre y con energía.",
          response_format: "mp3",
          speed: Number(speed) || 1.0
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      throw new Error(
        errorText || "No se pudo generar el audio."
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
    res.status(500).json({
      ok: false,
      error:
        e.message ||
        "No se pudo generar la voz."
    });
  }
});

// ─────────────────────────────────────
// CREAR CONSENTIMIENTO DE VOZ
// ─────────────────────────────────────

app.post(
  "/api/voice/consent",
  async (req, res) => {
    const {
      audio,
      name = "Voz R",
      language = "es"
    } = req.body || {};

    if (!audio?.startsWith("data:audio/")) {
      return res.status(400).json({
        ok: false,
        error:
          "Falta la grabación de consentimiento."
      });
    }

    if (!OPENAI_API_KEY) {
      return res.status(503).json({
        ok: false,
        error:
          "Falta configurar OPENAI_API_KEY."
      });
    }

    try {
      const match = audio.match(
        /^data:([^;]+);base64,(.+)$/
      );

      if (!match) {
        throw new Error(
          "Formato de audio no válido."
        );
      }

      const mimeType = match[1];
      const base64Data = match[2];

      const audioBuffer =
        Buffer.from(base64Data, "base64");

      const extension =
        mimeType.includes("webm")
          ? "webm"
          : mimeType.includes("wav")
          ? "wav"
          : mimeType.includes("mp4")
          ? "mp4"
          : "webm";

      const blob = new Blob(
        [audioBuffer],
        { type: mimeType }
      );

      const form = new FormData();

      form.append(
        "name",
        name
      );

      form.append(
        "language",
        language
      );

      form.append(
        "recording",
        blob,
        `consent.${extension}`
      );

      const response = await fetch(
        "https://api.openai.com/v1/audio/voice_consents",
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${OPENAI_API_KEY}`
          },

          body: form
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error?.message ||
          "No se pudo guardar el consentimiento."
        );
      }

      res.json({
        ok: true,
        consentId: data.id,
        consent: data
      });

    } catch (e) {
      res.status(500).json({
        ok: false,
        error:
          e.message ||
          "No se pudo crear el consentimiento."
      });
    }
  }
);

// ─────────────────────────────────────
// CREAR VOZ PERSONALIZADA
// ─────────────────────────────────────

app.post(
  "/api/voice/create",
  async (req, res) => {
    const {
      audio,
      consentId,
      name = "Voz R"
    } = req.body || {};

    if (!audio?.startsWith("data:audio/")) {
      return res.status(400).json({
        ok: false,
        error:
          "Falta la muestra de voz."
      });
    }

    if (!consentId) {
      return res.status(400).json({
        ok: false,
        error:
          "Falta el ID del consentimiento."
      });
    }

    if (!OPENAI_API_KEY) {
      return res.status(503).json({
        ok: false,
        error:
          "Falta configurar OPENAI_API_KEY."
      });
    }

    try {
      const match = audio.match(
        /^data:([^;]+);base64,(.+)$/
      );

      if (!match) {
        throw new Error(
          "Formato de audio no válido."
        );
      }

      const mimeType = match[1];
      const base64Data = match[2];

      const audioBuffer =
        Buffer.from(base64Data, "base64");

      const extension =
        mimeType.includes("webm")
          ? "webm"
          : mimeType.includes("wav")
          ? "wav"
          : mimeType.includes("mp4")
          ? "mp4"
          : "webm";

      const blob = new Blob(
        [audioBuffer],
        { type: mimeType }
      );

      const form = new FormData();

      form.append(
        "name",
        name
      );

      form.append(
        "consent",
        consentId
      );

      form.append(
        "audio_sample",
        blob,
        `voice-sample.${extension}`
      );

      const response = await fetch(
        "https://api.openai.com/v1/audio/voices",
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${OPENAI_API_KEY}`
          },

          body: form
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error?.message ||
          "No se pudo crear la voz personalizada."
        );
      }

      res.json({
        ok: true,
        voiceId: data.id,
        voice: data
      });

    } catch (e) {
      res.status(500).json({
        ok: false,
        error:
          e.message ||
          "No se pudo crear la voz personalizada."
      });
    }
  }
);

// ─────────────────────────────────────
// INICIAR SERVIDOR
// ─────────────────────────────────────

app.listen(PORT, () => {
  console.log(
    `Animador IA Backend escuchando en puerto ${PORT}`
  );
});
