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


/* =========================================================
   GUIONES
========================================================= */

function fallbackScript(brief, style, energy) {

  let text = brief;
  const s = templates[style] || templates.animador;

  if (energy === "Explosiva") {
    text = text.replace(/[.,]/g, "!!!");
  } else if (energy === "Media") {
    text = text.replace(/\./g, "!");
  }

  return `${s[0]}\n\n${text}\n\n${s[1]}`;
}


/* =========================================================
   IMAGEN
========================================================= */

$("imageInput").onchange = e => {

  const file = e.target.files?.[0];

  if (!file) return;

  if (!file.type.startsWith("image/")) {
    setImageStatus("Selecciona una imagen válida.", true);
    return;
  }

  if (file.size > 8 * 1024 * 1024) {
    setImageStatus(
      "La imagen supera 8 MB. Elige una más pequeña.",
      true
    );
    return;
  }

  selectedImage = file;

  const url = URL.createObjectURL(file);

  $("imagePreview").src = url;
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


function setImageStatus(text, error = false) {

  const el = $("imageStatus");

  if (!el) return;

  el.textContent = text;

  el.className =
    "status " + (error ? "error" : "success");
}


function fileToDataURL(file) {

  return new Promise((resolve, reject) => {

    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;

    reader.readAsDataURL(file);
  });
}


/* =========================================================
   GENERAR GUIÓN
========================================================= */

$("generate").onclick = async () => {

  const brief = $("brief").value.trim();
  const style = $("style").value;
  const energy = $("energy").value.toLowerCase();

  if (!brief && !selectedImage) {

    $("script").value =
      "Escribe los datos del anuncio o sube una imagen publicitaria.";

    return;
  }

  $("script").value = "🎙️ Preparando...";
  setImageStatus("");

  try {

    let response;
    let data;

    if (selectedImage && !brief) {

      const dataUrl =
        await fileToDataURL(selectedImage);

      setImageStatus(
        "🖼️ Analizando la publicidad..."
      );

      response = await fetch(
        BACKEND + "/api/generate-script-from-image",
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

      response = await fetch(
        BACKEND + "/api/generate-script",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json"
          },

          body: JSON.stringify({
            brief,
            style,
            energy
          })
        }
      );
    }

    data = await response.json();

    if (!response.ok || !data.ok) {
      throw Error(
        data.error ||
        "No se pudo generar el guion."
      );
    }

    $("script").value = data.script;

    setImageStatus(
      selectedImage && !brief
        ? "✅ Guion generado a partir de la imagen."
        : ""
    );

  } catch (error) {

    if (selectedImage && !brief) {

      $("script").value =
        "No se pudo analizar la imagen todavía. Revisa que el backend tenga configurada su clave de IA.\n\nTambién puedes escribir los datos manualmente para generar el guion.";

      setImageStatus(
        error.message ||
        "Error al analizar la imagen.",
        true
      );

    } else {

      $("script").value =
        fallbackScript(
          brief,
          style,
          $("energy").value
        );
    }
  }
};


/* =========================================================
   VOZ PERSONALIZADA
========================================================= */

let selectedVoiceId =
  localStorage.getItem("animadorSelectedVoice") || null;

let currentAudio = null;

let generatingAudio = false;


/* =========================================================
   DETENER AUDIO
========================================================= */

function stopCustomAudio() {

  if (currentAudio) {

    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch {}

    try {
      if (currentAudio.src) {
        URL.revokeObjectURL(currentAudio.src);
      }
    } catch {}

    currentAudio = null;
  }
}


/* =========================================================
   MENSAJE DE VOZ
========================================================= */

function setVoiceMessage(text) {

  /*
    Usamos imageStatus solamente como indicador general
    si no existe un elemento específico para voz.
  */

  const el = $("imageStatus");

  if (el) {
    el.textContent = text;
    el.className = "status success";
  }
}


/* =========================================================
   CONVERTIR AUDIO A BASE64
========================================================= */

async function blobToDataURL(blob) {

  return new Promise((resolve, reject) => {

    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;

    reader.readAsDataURL(blob);
  });
}


/* =========================================================
   PREPARAR / CLONAR VOZ
========================================================= */

async function ensureVoiceCloned(voice) {

  if (!voice || !voice.blob) {
    throw new Error(
      "No se encontró la muestra de voz."
    );
  }

  /*
    Si la voz ya tiene voice_id,
    no volvemos a crearla.
  */

  if (voice.voice_id) {
    return voice.voice_id;
  }

  setVoiceMessage(
    "🎙️ Preparando la voz " +
    voice.name +
    "..."
  );

  const audioBase64 =
    await blobToDataURL(voice.blob);

  const response = await fetch(
    BACKEND + "/api/voice/clone",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        audioBase64,
        name: voice.name
      })
    }
  );

  const data =
    await response.json();

  if (!response.ok || !data.ok) {

    throw new Error(
      data.error ||
      "No se pudo preparar la voz personalizada."
    );
  }

  if (!data.voice_id) {

    throw new Error(
      "El servidor no devolvió el identificador de la voz."
    );
  }

  /*
    Guardamos el voice_id dentro de IndexedDB.
    Así no necesitamos volver a crear la voz.
  */

  voice.voice_id =
    data.voice_id;

  await put(voice);

  return data.voice_id;
}


/* =========================================================
   GENERAR AUDIO CON LA VOZ SELECCIONADA
========================================================= */

async function generateCustomVoice() {

  if (generatingAudio) return;

  const text =
    $("script").value.trim();

  if (!text) {

    alert(
      "Primero genera o escribe un guion."
    );

    return;
  }

  if (!selectedVoiceId) {

    alert(
      "Primero selecciona una voz personalizada."
    );

    return;
  }

  generatingAudio = true;

  stopCustomAudio();

  $("speak").textContent =
    "⏳ GENERANDO AUDIO...";

  $("speak").disabled = true;

  try {

    const voices =
      await all();

    const voice =
      voices.find(
        v => v.id === selectedVoiceId
      );

    if (!voice) {

      throw new Error(
        "La voz seleccionada ya no está disponible."
      );
    }

    /*
      Primera vez:
      se prepara la voz R y se obtiene
      su voice_id.
    */

    const voiceId =
      await ensureVoiceCloned(voice);

    setVoiceMessage(
      "🎙️ Generando el anuncio con la voz " +
      voice.name +
      "..."
    );

    const response =
      await fetch(
        BACKEND + "/api/voice/generate",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json"
          },

          body: JSON.stringify({
            text,

            voice_id: voiceId,

            rate:
              +$("rate").value,

            pitch:
              +$("pitch").value
          })
        }
      );

    if (!response.ok) {

  let message = "No se pudo generar el audio.";

  try {

    const contentType =
      response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {

      const data =
        await response.json();

      message =
        data.error ||
        message;

    } else {

      const text =
        await response.text();

      console.error(
        "Respuesta no JSON del servidor:",
        text
      );

      message =
        "El servidor no respondió correctamente. Verifica que el backend de Render esté funcionando.";
    }

  } catch (error) {

    console.error(
      "Error leyendo respuesta:",
      error
    );
  }

  throw new Error(message);
    }

    console.error(
      "Error leyendo respuesta:",
      error
    );
  }

  throw new Error(message);
    }

    const audioBlob =
      await response.blob();

    if (!audioBlob.size) {

      throw new Error(
        "El servidor devolvió un audio vacío."
      );
    }

    const audioURL =
      URL.createObjectURL(
        audioBlob
      );

    currentAudio =
      new Audio(audioURL);

    currentAudio.preload = "auto";

    currentAudio.onended = () => {

      try {
        URL.revokeObjectURL(audioURL);
      } catch {}

      currentAudio = null;

      $("speak").disabled = false;

      $("speak").textContent =
        "🔊 ESCUCHAR";
    };

    currentAudio.onerror = () => {

      try {
        URL.revokeObjectURL(audioURL);
      } catch {}

      currentAudio = null;

      $("speak").disabled = false;

      $("speak").textContent =
        "🔊 ESCUCHAR";

      alert(
        "No se pudo reproducir el audio generado."
      );
    };

    await currentAudio.play();

    setVoiceMessage(
      "✅ Reproduciendo con la voz " +
      voice.name
    );

  } catch (error) {

    console.error(
      "ERROR DE VOZ:",
      error
    );

    alert(
      error.message ||
      "No se pudo generar el audio."
    );

    $("speak").disabled = false;

    $("speak").textContent =
      "🔊 ESCUCHAR";

  } finally {

    generatingAudio = false;
  }
}


/* =========================================================
   BOTONES ESCUCHAR / DETENER
========================================================= */

$("speak").onclick =
  generateCustomVoice;


$("stop").onclick = () => {

  stopCustomAudio();

  $("speak").disabled = false;

  $("speak").textContent =
    "🔊 ESCUCHAR";
};


/* =========================================================
   COPIAR
========================================================= */

$("copy").onclick = async () => {

  try {

    await navigator.clipboard.writeText(
      $("script").value
    );

    $("copy").textContent =
      "¡Copiado!";

    setTimeout(() => {

      $("copy").textContent =
        "Copiar";

    }, 1200);

  } catch {

    alert(
      "No se pudo copiar el guion."
    );
  }
};


/* =========================================================
   VELOCIDAD Y TONO
========================================================= */

$("rate").oninput = () => {

  $("rv").textContent =
    (+$("rate").value).toFixed(2) +
    "x";
};


$("pitch").oninput = () => {

  $("pv").textContent =
    (+$("pitch").value).toFixed(2);
};


/* =========================================================
   INDEXEDDB — VOCES
========================================================= */

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


/* =========================================================
   ABRIR BASE DE DATOS
========================================================= */

function openDB() {

  return new Promise((resolve, reject) => {

    const request =
      indexedDB.open(
        "AnimadorIA",
        1
      );

    request.onupgradeneeded = () => {

      if (
        !request.result.objectStoreNames.contains(
          "voices"
        )
      ) {

        request.result.createObjectStore(
          "voices",
          {
            keyPath: "id"
          }
        );
      }
    };

    request.onsuccess = () => {

      db = request.result;

      resolve();
    };

    request.onerror = () =>
      reject(request.error);
  });
}


/* =========================================================
   OBTENER VOCES
========================================================= */

function all() {

  return new Promise((resolve, reject) => {

    const request =
      db
        .transaction("voices")
        .objectStore("voices")
        .getAll();

    request.onsuccess = () =>
      resolve(request.result);

    request.onerror = () =>
      reject(request.error);
  });
}


/* =========================================================
   GUARDAR VOZ
========================================================= */

function put(voice) {

  return new Promise((resolve, reject) => {

    const request =
      db
        .transaction(
          "voices",
          "readwrite"
        )
        .objectStore("voices")
        .put(voice);

    request.onsuccess = resolve;

    request.onerror = () =>
      reject(request.error);
  });
}


/* =========================================================
   ELIMINAR VOZ
========================================================= */

function del(id) {

  return new Promise((resolve, reject) => {

    const request =
      db
        .transaction(
          "voices",
          "readwrite"
        )
        .objectStore("voices")
        .delete(id);

    request.onsuccess = resolve;

    request.onerror = () =>
      reject(request.error);
  });
}


/* =========================================================
   ESCAPAR HTML
========================================================= */

function escapeHtml(value) {

  return String(value).replace(
    /[&<>'"]/g,
    character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    }[character])
  );
}


/* =========================================================
   GUARDAR ARCHIVO DE VOZ
========================================================= */

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

  const voice = {

    id:
      id ||
      crypto.randomUUID(),

    name:
      name || "Mi voz",

    blob,

    date:
      Date.now(),

    mime:
      blob.type ||
      "audio/wav"
  };

  /*
    Si estamos reemplazando una voz que
    ya tenía voice_id, lo eliminamos.

    Así la nueva grabación se prepara
    como una voz nueva.
  */

  await put(voice);

  await render();
}


/* =========================================================
   RENDERIZAR VOCES
========================================================= */

async function render() {

  const list = await all();

  const element =
    $("voices");

  element.innerHTML =
    list.length
      ? ""
      : "<p>Aún no hay voces almacenadas.</p>";


  list.forEach(voice => {

    const div =
      document.createElement("div");

    div.className =
      "voice";


    const active =
      recording &&
      editing === voice.id;


    const preparingThis =
      preparing &&
      editing === voice.id;


    const selected =
      selectedVoiceId === voice.id;


    div.innerHTML = `

      <b>
        🎙️ ${escapeHtml(voice.name)}
      </b>

      <span class="ready">

        ${
          preparingThis
            ? "🎙️ Preparando..."
            : active
              ? "🔴 Grabando..."
              : selected
                ? "● SELECCIONADA"
                : "● Lista"
        }

      </span>


      <div class="meta">

        ${
          preparingThis
            ? "Preparando el micrófono..."
            : active
              ? "La muestra anterior está oculta mientras grabas una nueva."
              : selected
                ? "Esta es la voz que se utilizará para generar los anuncios."
                : "Muestra almacenada localmente"
        }

      </div>


      <audio
        controls
        preload="metadata"
        ${active || preparingThis ? "hidden" : ""}
      ></audio>


      <div>

        <button
          data-select="${voice.id}"
          ${active || preparingThis ? "disabled" : ""}
        >

          ${
            selected
              ? "✅ VOZ SELECCIONADA"
              : "🎙️ SELECCIONAR VOZ"
          }

        </button>


        <button
          data-r="${voice.id}"
          ${selected && !active ? "" : ""}
        >

          ${
            active
              ? "⏹ Detener"
              : "🔄 Regrabar"
          }

        </button>


        <button
          data-u="${voice.id}"
          ${active || preparingThis ? "disabled" : ""}
        >

          📁 Reemplazar archivo

        </button>


        <button
          class="danger"
          data-d="${voice.id}"
          ${active || preparingThis ? "disabled" : ""}
        >

          🗑️ Eliminar

        </button>

      </div>
    `;


    const audio =
      div.querySelector("audio");


    if (
      !active &&
      !preparingThis
    ) {

      try {

        audio.src =
          URL.createObjectURL(
            voice.blob
          );

      } catch {}
    }


    element.appendChild(div);
  });


  /* =====================================================
     SELECCIONAR VOZ
  ===================================================== */

  element
    .querySelectorAll(
      "[data-select]"
    )
    .forEach(button => {

      button.onclick = async () => {

        selectedVoiceId =
          button.dataset.select;

        localStorage.setItem(
          "animadorSelectedVoice",
          selectedVoiceId
        );

        const voices =
          await all();

        const selected =
          voices.find(
            v =>
              v.id ===
              selectedVoiceId
          );

        if (selected) {

          setVoiceMessage(
            "🎙️ Voz seleccionada: " +
            selected.name
          );
        }

        await render();
      };
    });


  /* =====================================================
     ELIMINAR VOZ
  ===================================================== */

  element
    .querySelectorAll(
      "[data-d]"
    )
    .forEach(button => {

      button.onclick = async () => {

        if (
          !confirm(
            "¿Eliminar esta voz almacenada?"
          )
        ) {
          return;
        }

        const id =
          button.dataset.d;

        await del(id);

        if (
          selectedVoiceId === id
        ) {

          selectedVoiceId = null;

          localStorage.removeItem(
            "animadorSelectedVoice"
          );
        }

        if (
          editing === id
        ) {

          cancelRecorder();

        } else {

          await render();
        }
      };
    });


  /* =====================================================
     REGRABAR
  ===================================================== */

  element
    .querySelectorAll(
      "[data-r]"
    )
    .forEach(button => {

      button.onclick = async () => {

        const id =
          button.dataset.r;

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


  /* =====================================================
     REEMPLAZAR ARCHIVO
  ===================================================== */

  element
    .querySelectorAll(
      "[data-u]"
    )
    .forEach(button => {

      button.onclick = () =>
        openRecorder(
          button.dataset.u
        );
    });
}


/* =========================================================
   ABRIR GRABADOR
========================================================= */

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
      voice =>
        voice.id === id
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


/* =========================================================
   AGREGAR VOZ
========================================================= */

$("addVoice").onclick =
  () => openRecorder();


/* =========================================================
   LIMPIAR AUDIO
========================================================= */

function cleanupAudio() {

  try {
    sourceNode?.disconnect();
  } catch {}

  try {
    processorNode?.disconnect();
  } catch {}

  sourceNode = null;

  processorNode = null;


  if (stream) {

    stream
      .getTracks()
      .forEach(
        track =>
          track.stop()
      );

    stream = null;
  }


  if (audioCtx) {

    try {
      audioCtx.close();
    } catch {}

    audioCtx = null;
  }
}


/* =========================================================
   CANCELAR GRABADOR
========================================================= */

function cancelRecorder() {

  recording = false;

  preparing = false;

  cleanupAudio();

  recordedSamples = [];

  $("record").textContent =
    "🎙️ GRABAR MUESTRA";

  $("recorder").hidden =
    true;

  $("audioInput").value = "";

  render();
}


$("cancel").onclick =
  cancelRecorder;


/* =========================================================
   UNIR MUESTRAS
========================================================= */

function mergeFloat32(
  chunks
) {

  let length = 0;

  chunks.forEach(
    array =>
      length += array.length
  );

  const output =
    new Float32Array(
      length
    );

  let offset = 0;

  chunks.forEach(array => {

    output.set(
      array,
      offset
    );

    offset += array.length;
  });

  return output;
}


/* =========================================================
   CREAR WAV
========================================================= */

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
    (offset, text) => {

      for (
        let i = 0;
        i < text.length;
        i++
      ) {

        view.setUint8(
          offset + i,
          text.charCodeAt(i)
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


  let offset = 44;


  for (
    let i = 0;
    i < samples.length;
    i++
  ) {

    let value =
      Math.max(
        -1,
        Math.min(
          1,
          samples[i]
        )
      );


    view.setInt16(
      offset,
      value < 0
        ? value * 0x8000
        : value * 0x7fff,
      true
    );


    offset += 2;
  }


  return new Blob(
    [view],
    {
      type: "audio/wav"
    }
  );
}


/* =========================================================
   DETENER GRABACIÓN
========================================================= */

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
      $("voiceName")
        .value
        .trim(),
      editing
    );


    $("status").textContent =
      "✅ Muestra guardada correctamente.";


    $("recorder").hidden =
      true;


  } catch (error) {

    cleanupAudio();

    recordedSamples = [];


    $("status").textContent =
      "❌ No se pudo guardar la grabación: " +
      (
        error.message ||
        "error"
      );


    await render();
  }
}


/* =========================================================
   GRABAR
========================================================= */

$("record").onclick =
  async () => {

    if (recording) {

      await stopRecording();

      return;
    }


    if (preparing) {
      return;
    }


    if (!$("consent").checked) {

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
      !navigator.mediaDevices?.getUserMedia
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
        await navigator.mediaDevices
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
        audioCtx.createMediaStreamSource(
          stream
        );


      processorNode =
        audioCtx.createScriptProcessor(
          4096,
          1,
          1
        );


      recordedSamples = [];


      processorNode.onaudioprocess =
        event => {

          if (!recording) {
            return;
          }


          recordedSamples.push(
            new Float32Array(
              event.inputBuffer
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


    } catch (error) {

      preparing = false;

      recording = false;

      cleanupAudio();

      recordedSamples = [];


      $("record").textContent =
        "🎙️ GRABAR MUESTRA";


      if (
        error?.name ===
          "NotAllowedError" ||
        error?.name ===
          "PermissionDeniedError"
      ) {

        $("status").textContent =
          "❌ El micrófono no fue autorizado. Revisa el permiso de micrófono del navegador para esta página.";

      } else if (
        error?.name ===
        "NotFoundError"
      ) {

        $("status").textContent =
          "❌ No se encontró un micrófono disponible.";

      } else {

        $("status").textContent =
          "❌ No se pudo acceder al micrófono: " +
          (
            error.message ||
            "error"
          );
      }


      await render();
    }
  };


/* =========================================================
   SUBIR ARCHIVO DE VOZ
========================================================= */

$("audioInput").onchange =
  async e => {

    const file =
      e.target.files?.[0];


    if (!file) {
      return;
    }


    if (!$("consent").checked) {

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


    } catch (error) {

      $("status").textContent =
        "No se pudo guardar el archivo.";
    }


    e.target.value = "";
  };


/* =========================================================
   INICIAR
========================================================= */

openDB()
  .then(render)
  .catch(error => {

    console.error(
      "No se pudo abrir la base de datos:",
      error
    );
  });
