const $ = x => document.getElementById(x);

const BACKEND = "https://animador-ia-backend.onrender.com";

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

let selectedImage = null;

// ======================================================
// VOZ PERSONALIZADA SELECCIONADA
// ======================================================

let selectedVoiceId =
  localStorage.getItem("animadorIA_selectedVoice") || null;

function getSelectedVoiceId() {
  return selectedVoiceId;
}

function setSelectedVoice(id) {
  selectedVoiceId = id;

  if (id) {
    localStorage.setItem(
      "animadorIA_selectedVoice",
      id
    );
  } else {
    localStorage.removeItem(
      "animadorIA_selectedVoice"
    );
  }
}

// ======================================================
// GUIÓN
// ======================================================

function fallbackScript(b, style, energy) {
  let t = b;
  const s = templates[style] || templates.animador;

  if (energy === "Explosiva") {
    t = t.replace(/[.,]/g, "!!!");
  } else if (energy === "Media") {
    t = t.replace(/\./g, "!");
  }

  return `${s[0]}

${t}

${s[1]}`;
}

// ======================================================
// IMAGEN
// ======================================================

$("imageInput").onchange = e => {
  const f = e.target.files?.[0];

  if (!f) return;

  if (!f.type.startsWith("image/")) {
    setImageStatus(
      "Selecciona una imagen válida.",
      true
    );
    return;
  }

  if (f.size > 8 * 1024 * 1024) {
    setImageStatus(
      "La imagen supera 8 MB. Elige una más pequeña.",
      true
    );
    return;
  }

  selectedImage = f;

  const u = URL.createObjectURL(f);

  $("imagePreview").src = u;
  $("imagePreview").hidden = false;
  $("imageEmpty").hidden = true;
  $("removeImage").hidden = false;

  setImageStatus(
    "Imagen lista. Si el texto está vacío, la IA usará la imagen para crear el guion."
  );
};

$("removeImage").onclick = () => {
  selectedImage = null;

  $("imageInput").value = "";
  $("imagePreview").hidden = true;
  $("imagePreview").removeAttribute("src");
  $("imageEmpty").hidden = false;
  $("removeImage").hidden = true;

  setImageStatus("");
};

function setImageStatus(t, error = false) {
  $("imageStatus").textContent = t;
  $("imageStatus").className =
    "status " + (error ? "error" : "success");
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();

    r.onload = () => resolve(r.result);
    r.onerror = reject;

    r.readAsDataURL(file);
  });
}

// ======================================================
// GENERAR GUIÓN
// ======================================================

$("generate").onclick = async () => {
  const b = $("brief").value.trim();
  const style = $("style").value;
  const energy = $("energy").value.toLowerCase();

  if (!b && !selectedImage) {
    $("script").value =
      "Escribe los datos del anuncio o sube una imagen publicitaria.";
    return;
  }

  $("script").value = "🎙️ Preparando...";
  setImageStatus("");

  try {
    let r, d;

    if (selectedImage && !b) {
      const dataUrl =
        await fileToDataURL(selectedImage);

      setImageStatus(
        "🖼️ Analizando la publicidad..."
      );

      r = await fetch(
        BACKEND +
          "/api/generate-script-from-image",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            image: dataUrl,
            style,
            energy
          })
        }
      );
    } else {
      r = await fetch(
        BACKEND + "/api/generate-script",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            brief: b,
            style,
            energy
          })
        }
      );
    }

    d = await r.json();

    if (!r.ok || !d.ok) {
      throw Error(
        d.error ||
          "No se pudo generar el guion."
      );
    }

    $("script").value = d.script;

    setImageStatus(
      selectedImage && !b
        ? "✅ Guion generado a partir de la imagen."
        : ""
    );

  } catch (e) {

    if (selectedImage && !b) {

      $("script").value =
        "No se pudo analizar la imagen todavía. Revisa que el backend tenga configurada su clave de IA.\n\nTambién puedes escribir los datos manualmente para generar el guion.";

      setImageStatus(
        e.message ||
          "Error al analizar la imagen.",
        true
      );

    } else {

      $("script").value =
        fallbackScript(
          b,
          style,
          $("energy").value
        );
    }
  }
};

// ======================================================
// ESCUCHAR
// ======================================================
//
// POR AHORA sigue usando la voz del sistema.
// En el siguiente paso conectaremos la voz personalizada
// seleccionada con el backend.
// ======================================================

$("speak").onclick = () => {

  speechSynthesis.cancel();

  const text =
    $("script").value.trim();

  if (!text) return;

  const voiceName =
    selectedVoiceId
      ? "Voz personalizada seleccionada"
      : "voz del sistema";

  setImageStatus(
    `🔊 Reproduciendo con ${voiceName}.`
  );

  const u =
    new SpeechSynthesisUtterance(text);

  const v =
    speechSynthesis.getVoices();

  u.voice =
    v.find(x =>
      x.lang
        ?.toLowerCase()
        .startsWith("es")
    ) || v[0];

  u.rate = +$("rate").value;
  u.pitch = +$("pitch").value;

  speechSynthesis.speak(u);
};

$("stop").onclick = () => {
  speechSynthesis.cancel();
};

$("copy").onclick = async () => {

  await navigator.clipboard.writeText(
    $("script").value
  );

  $("copy").textContent =
    "¡Copiado!";

  setTimeout(() => {
    $("copy").textContent =
      "Copiar";
  }, 1200);
};

// ======================================================
// VELOCIDAD / TONO
// ======================================================

$("rate").oninput = () => {
  $("rv").textContent =
    (+$("rate").value).toFixed(2) +
    "x";
};

$("pitch").oninput = () => {
  $("pv").textContent =
    (+$("pitch").value).toFixed(2);
};

// ======================================================
// BASE DE DATOS DE VOCES
// ======================================================

let db;
let rec;
let stream;
let ch = [];
let editing = null;

let recording = false;
let preparing = false;

let audioCtx = null;
let sourceNode = null;
let processorNode = null;

let recordedSamples = [];
let recordedSampleRate = 44100;

// ======================================================
// INDEXED DB
// ======================================================

function openDB() {
  return new Promise((ok, no) => {

    const r =
      indexedDB.open(
        "AnimadorIA",
        1
      );

    r.onupgradeneeded = () => {

      if (
        !r.result.objectStoreNames
          .contains("voices")
      ) {

        r.result.createObjectStore(
          "voices",
          { keyPath: "id" }
        );
      }
    };

    r.onsuccess = () => {
      db = r.result;
      ok();
    };

    r.onerror = () =>
      no(r.error);
  });
}

function all() {
  return new Promise((ok, no) => {

    const r =
      db
        .transaction("voices")
        .objectStore("voices")
        .getAll();

    r.onsuccess = () =>
      ok(r.result);

    r.onerror = () =>
      no(r.error);
  });
}

function put(v) {
  return new Promise((ok, no) => {

    const r =
      db
        .transaction(
          "voices",
          "readwrite"
        )
        .objectStore("voices")
        .put(v);

    r.onsuccess = ok;

    r.onerror = () =>
      no(r.error);
  });
}

function del(id) {
  return new Promise((ok, no) => {

    const r =
      db
        .transaction(
          "voices",
          "readwrite"
        )
        .objectStore("voices")
        .delete(id);

    r.onsuccess = ok;

    r.onerror = () =>
      no(r.error);
  });
}

// ======================================================
// SEGURIDAD HTML
// ======================================================

function escapeHtml(s) {

  return String(s).replace(
    /[&<>'"]/g,
    c =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;"
      })[c]
  );
}

// ======================================================
// GUARDAR VOZ
// ======================================================

async function saveVoiceBlob(
  blob,
  name,
  id
) {

  if (!blob || !blob.size) {
    throw Error(
      "La grabación está vacía."
    );
  }

  const voiceId =
    id || crypto.randomUUID();

  await put({
    id: voiceId,
    name,
    blob,
    date: Date.now(),
    mime:
      blob.type ||
      "audio/wav"
  });

  await render();
}

// ======================================================
// RENDERIZAR VOCES
// ======================================================

async function render() {

  const list = await all();
  const el = $("voices");

  // ------------------------------------------
  // ENCABEZADO DE VOZ SELECCIONADA
  // ------------------------------------------

  const selected =
    list.find(
      v =>
        v.id ===
        selectedVoiceId
    );

  let header =
    el.querySelector(
      ".selected-voice-box"
    );

  if (!header) {

    header =
      document.createElement("div");

    header.className =
      "selected-voice-box";

    el.prepend(header);
  }

  if (selected) {

    header.innerHTML = `
      <div style="
        padding:12px;
        margin-bottom:12px;
        border-radius:10px;
        border:1px solid #aaa;
        background:rgba(0,0,0,.04);
      ">
        <strong>🎙️ Voz seleccionada:</strong>
        <span style="font-weight:bold;">
          ${escapeHtml(selected.name)}
        </span>
        <br>
        <small>
          Esta será la voz elegida para el anuncio.
        </small>
      </div>
    `;

  } else {

    header.innerHTML = `
      <div style="
        padding:12px;
        margin-bottom:12px;
        border-radius:10px;
        border:1px solid #aaa;
      ">
        <strong>🎙️ Voz seleccionada:</strong>
        <span>
          Ninguna
        </span>
        <br>
        <small>
          Selecciona una voz de la lista.
        </small>
      </div>
    `;
  }

  // ------------------------------------------
  // LISTA
  // ------------------------------------------

  let container =
    el.querySelector(
      ".voice-list-container"
    );

  if (!container) {

    container =
      document.createElement("div");

    container.className =
      "voice-list-container";

    el.appendChild(container);
  }

  container.innerHTML =
    list.length
      ? ""
      : "<p>Aún no hay voces almacenadas.</p>";

  list.forEach(v => {

    const d =
      document.createElement("div");

    d.className = "voice";

    const active =
      recording &&
      editing === v.id;

    const preparingThis =
      preparing &&
      editing === v.id;

    const isSelected =
      selectedVoiceId === v.id;

    d.innerHTML = `

      <b>
        🎙️ ${escapeHtml(v.name)}
      </b>

      <span class="ready">
        ${
          preparingThis
            ? "🎙️ Preparando..."
            : active
            ? "🔴 Grabando..."
            : isSelected
            ? "✅ SELECCIONADA"
            : "● Lista"
        }
      </span>

      <div class="meta">
        ${
          preparingThis
            ? "Preparando el micrófono..."
            : active
            ? "La muestra anterior está oculta mientras grabas una nueva."
            : isSelected
            ? "Esta es la voz seleccionada."
            : "Muestra almacenada localmente"
        }
      </div>

      <audio
        controls
        preload="metadata"
        ${
          active ||
          preparingThis
            ? "hidden"
            : ""
        }
      ></audio>

      <div>

        <button
          data-select="${v.id}"
          ${
            isSelected
              ? "disabled"
              : ""
          }
        >
          ${
            isSelected
              ? "✅ VOZ SELECCIONADA"
              : "🎙️ SELECCIONAR VOZ"
          }
        </button>

        <button data-r="${v.id}">
          ${
            active
              ? "⏹ Detener"
              : "🔄 Regrabar"
          }
        </button>

        <button
          data-u="${v.id}"
          ${
            active ||
            preparingThis
              ? "disabled"
              : ""
          }
        >
          📁 Reemplazar archivo
        </button>

        <button
          class="danger"
          data-d="${v.id}"
          ${
            active ||
            preparingThis
              ? "disabled"
              : ""
          }
        >
          🗑️ Eliminar
        </button>

      </div>
    `;

    const audio =
      d.querySelector(
        "audio"
      );

    if (
      !active &&
      !preparingThis
    ) {

      try {

        audio.src =
          URL.createObjectURL(
            v.blob
          );

      } catch {}
    }

    container.appendChild(d);
  });

  // ==================================================
  // SELECCIONAR VOZ
  // ==================================================

  container
    .querySelectorAll(
      "[data-select]"
    )
    .forEach(b => {

      b.onclick = async () => {

        const id =
          b.dataset.select;

        setSelectedVoice(id);

        await render();

        const voice =
          (await all()).find(
            v => v.id === id
          );

        setImageStatus(
          `✅ Voz "${voice?.name || ""}" seleccionada.`
        );
      };
    });

  // ==================================================
  // ELIMINAR
  // ==================================================

  container
    .querySelectorAll(
      "[data-d]"
    )
    .forEach(b => {

      b.onclick = async () => {

        if (
          confirm(
            "¿Eliminar esta voz almacenada?"
          )
        ) {

          const id =
            b.dataset.d;

          await del(id);

          if (
            selectedVoiceId === id
          ) {
            setSelectedVoice(null);
          }

          if (
            editing === id
          ) {
            cancelRecorder();
          } else {
            await render();
          }
        }
      };
    });

  // ==================================================
  // REGRABAR
  // ==================================================

  container
    .querySelectorAll(
      "[data-r]"
    )
    .forEach(b => {

      b.onclick = async () => {

        const id =
          b.dataset.r;

        if (
          recording &&
          editing === id
        ) {

          await stopRecording();
          return;
        }

        await openRecorder(id);
      };
    });

  // ==================================================
  // REEMPLAZAR ARCHIVO
  // ==================================================

  container
    .querySelectorAll(
      "[data-u]"
    )
    .forEach(b => {

      b.onclick = () =>
        openRecorder(
          b.dataset.u
        );
    });
}

// ======================================================
// ABRIR GRABADOR
// ======================================================

async function openRecorder(
  id = null
) {

  if (
    recording ||
    preparing
  ) {
    return;
  }

  editing = id;

  const list =
    await all();

  const existing =
    list.find(
      v => v.id === id
    );

  $("voiceName").value =
    existing?.name || "";

  $("consent").checked =
    false;

  $("recTitle").textContent =
    existing
      ? "Regrabar voz"
      : "Nueva voz";

  $("record").textContent =
    "🎙️ GRABAR MUESTRA";

  $("status").textContent =
    existing
      ? "Listo para regrabar. La muestra anterior se conservará hasta que termines correctamente."
      : "Listo para grabar o subir un archivo.";

  $("recorder").hidden =
    false;

  await render();
}

$("addVoice").onclick =
  () => openRecorder();

// ======================================================
// LIMPIAR AUDIO
// ======================================================

function cleanupAudio() {

  try {
    sourceNode?.disconnect();
  } catch {}

  try {
    processorNode?.disconnect();
  } catch {}

  sourceNode =
    null;

  processorNode =
    null;

  if (stream) {

    stream
      .getTracks()
      .forEach(
        t => t.stop()
      );

    stream = null;
  }

  if (audioCtx) {

    try {
      audioCtx.close();
    } catch {}

    audioCtx =
      null;
  }
}

// ======================================================
// CANCELAR
// ======================================================

function cancelRecorder() {

  recording = false;
  preparing = false;

  cleanupAudio();

  recordedSamples = [];

  $("record").textContent =
    "🎙️ GRABAR MUESTRA";

  $("recorder").hidden =
    true;

  $("audioInput").value =
    "";

  render();
}

$("cancel").onclick =
  cancelRecorder;

// ======================================================
// UNIR GRABACIONES
// ======================================================

function mergeFloat32(
  chunks
) {

  let len = 0;

  chunks.forEach(
    a => len += a.length
  );

  const out =
    new Float32Array(len);

  let o = 0;

  chunks.forEach(a => {

    out.set(a, o);

    o += a.length;
  });

  return out;
}

// ======================================================
// CREAR WAV
// ======================================================

function encodeWav(
  samples,
  sampleRate
) {

  const buffer =
    new ArrayBuffer(
      44 +
      samples.length * 2
    );

  const view =
    new DataView(buffer);

  const write =
    (offset, str) => {

      for (
        let i = 0;
        i < str.length;
        i++
      ) {

        view.setUint8(
          offset + i,
          str.charCodeAt(i)
        );
      }
    };

  write(0, "RIFF");

  view.setUint32(
    4,
    36 +
      samples.length * 2,
    true
  );

  write(8, "WAVE");

  write(12, "fmt ");

  view.setUint32(
    16,
    16,
    true
  );

  view.setUint16(
    20,
    1,
    true
  );

  view.setUint16(
    22,
    1,
    true
  );

  view.setUint32(
    24,
    sampleRate,
    true
  );

  view.setUint32(
    28,
    sampleRate * 2,
    true
  );

  view.setUint16(
    32,
    2,
    true
  );

  view.setUint16(
    34,
    16,
    true
  );

  write(36, "data");

  view.setUint32(
    40,
    samples.length * 2,
    true
  );

  let off = 44;

  for (
    let i = 0;
    i < samples.length;
    i++
  ) {

    let x =
      Math.max(
        -1,
        Math.min(
          1,
          samples[i]
        )
      );

    view.setInt16(
      off,
      x < 0
        ? x * 0x8000
        : x * 0x7fff,
      true
    );

    off += 2;
  }

  return new Blob(
    [view],
    {
      type:
        "audio/wav"
    }
  );
}

// ======================================================
// DETENER GRABACIÓN
// ======================================================

async function stopRecording() {

  if (
    !recording ||
    !audioCtx
  ) {
    return;
  }

  $("status").textContent =
    "⏳ Procesando la grabación...";

  $("record").textContent =
    "⏳ GUARDANDO...";

  recording = false;

  try {

    const samples =
      mergeFloat32(
        recordedSamples
      );

    const blob =
      encodeWav(
        samples,
        recordedSampleRate
      );

    cleanupAudio();

    recordedSamples = [];

    if (
      !blob.size ||
      samples.length < 1000
    ) {

      throw Error(
        "La grabación está vacía o es demasiado corta."
      );
    }

    await saveVoiceBlob(
      blob,
      $("voiceName").value.trim(),
      editing
    );

    $("status").textContent =
      "✅ Muestra guardada correctamente.";

    $("recorder").hidden =
      true;

  } catch (e) {

    cleanupAudio();

    recordedSamples = [];

    $("status").textContent =
      "❌ No se pudo guardar la grabación: " +
      (e.message || "error");

    await render();
  }
}

// ======================================================
// GRABAR
// ======================================================

$("record").onclick =
  async () => {

    if (recording) {

      await stopRecording();
      return;
    }

    if (preparing) {
      return;
    }

    if (
      !$("consent").checked
    ) {

      $("status").textContent =
        "Marca la autorización primero.";

      return;
    }

    const name =
      $("voiceName")
        .value
        .trim();

    if (!name) {

      $("status").textContent =
        "Escribe un nombre para la voz.";

      return;
    }

    if (
      !navigator
        .mediaDevices
        ?.getUserMedia
    ) {

      $("status").textContent =
        "Este navegador no permite acceder al micrófono.";

      return;
    }

    try {

      preparing = true;

      $("status").textContent =
        "🎙️ Solicitando permiso para usar el micrófono...";

      $("record").textContent =
        "⏳ PREPARANDO...";

      await render();

      stream =
        await navigator
          .mediaDevices
          .getUserMedia({
            audio: {
              channelCount: 1,
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          });

      audioCtx =
        new (
          window.AudioContext ||
          window.webkitAudioContext
        )();

      if (
        audioCtx.state ===
        "suspended"
      ) {

        await audioCtx.resume();
      }

      recordedSampleRate =
        audioCtx.sampleRate;

      sourceNode =
        audioCtx
          .createMediaStreamSource(
            stream
          );

      processorNode =
        audioCtx
          .createScriptProcessor(
            4096,
            1,
            1
          );

      recordedSamples = [];

      processorNode.onaudioprocess =
        e => {

          if (!recording)
            return;

          recordedSamples.push(
            new Float32Array(
              e.inputBuffer
                .getChannelData(0)
            )
          );
        };

      const silentGain =
        audioCtx.createGain();

      silentGain.gain.value =
        0;

      sourceNode.connect(
        processorNode
      );

      processorNode.connect(
        silentGain
      );

      silentGain.connect(
        audioCtx.destination
      );

      preparing = false;
      recording = true;

      await render();

      $("record").textContent =
        "⏹ DETENER GRABACIÓN";

      $("status").textContent =
        "🔴 Grabando... Habla ahora.";

    } catch (e) {

      preparing = false;
      recording = false;

      cleanupAudio();

      recordedSamples = [];

      $("record").textContent =
        "🎙️ GRABAR MUESTRA";

      if (
        e?.name ===
          "NotAllowedError" ||
        e?.name ===
          "PermissionDeniedError"
      ) {

        $("status").textContent =
          "❌ El micrófono no fue autorizado. Revisa el permiso de micrófono del navegador para esta página.";

      } else if (
        e?.name ===
        "NotFoundError"
      ) {

        $("status").textContent =
          "❌ No se encontró un micrófono disponible.";

      } else {

        $("status").textContent =
          "❌ No se pudo acceder al micrófono: " +
          (e.message || "error");
      }

      await render();
    }
  };

// ======================================================
// SUBIR ARCHIVO DE VOZ
// ======================================================

$("audioInput").onchange =
  async e => {

    const file =
      e.target.files?.[0];

    if (!file)
      return;

    if (
      !$("consent").checked
    ) {

      $("status").textContent =
        "Marca la autorización primero.";

      e.target.value = "";

      return;
    }

    const name =
      $("voiceName")
        .value
        .trim() ||
      "Mi voz";

    if (
      file.size >
      15 * 1024 * 1024
    ) {

      $("status").textContent =
        "El archivo supera 15 MB.";

      e.target.value = "";

      return;
    }

    if (
      !file.type.startsWith(
        "audio/"
      )
    ) {

      $("status").textContent =
        "Selecciona un archivo de audio válido.";

      e.target.value = "";

      return;
    }

    try {

      await saveVoiceBlob(
        file,
        name,
        editing
      );

      $("recorder").hidden =
        true;

      $("status").textContent =
        "Archivo de voz guardado.";

    } catch (err) {

      $("status").textContent =
        "No se pudo guardar el archivo.";
    }

    e.target.value = "";
  };

// ======================================================
// INICIAR
// ======================================================

openDB().then(
  render
);
