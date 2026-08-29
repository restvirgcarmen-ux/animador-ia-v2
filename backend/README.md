# Animador IA Backend V4

Backend Express para Animador IA.

## Variables de entorno
- `OPENAI_API_KEY`: clave de API guardada como secreto en Render.
- `OPENAI_MODEL`: modelo multimodal (por defecto `gpt-5.6`).

## Endpoints
- `GET /api/health`
- `POST /api/generate-script`
- `POST /api/generate-script-from-image`

No guardes claves API en el frontend ni en GitHub.
