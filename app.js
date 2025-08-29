// ===============================
// Selector de Espacios - Banco de Tiempo
// ===============================

/**
 * Utilidades
 */

function norm(s) {
  return (s ?? "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function toArray(v) {
  if (Array.isArray(v)) return v;
  if (v == null) return [];
  return [v];
}

// Acepta {min,max} o strings como "2-8", "8-20", "8-20+", "2-2", "20+"
function parseCapacity(raw) {
  if (!raw) return { min: 0, max: Number.MAX_SAFE_INTEGER, label: "cualquiera" };

  if (typeof raw === "object" && raw.min != null && raw.max != null) {
    return { min: Number(raw.min), max: Number(raw.max), label: `${raw.min}-${raw.max}` };
  }

  const str = String(raw).trim();
  const plus = /\+$/.test(str);
  const rangeMatch = str.match(/(\d+)\s*-\s*(\d+)\+?/);
  const singleMatch = str.match(/^\s*(\d+)\s*\+?\s*$/);

  if (rangeMatch) {
    const min = Number(rangeMatch[1]);
    const max = Number(rangeMatch[2]);
    return { min, max: plus ? Number.MAX_SAFE_INTEGER : max, label: str };
  }
  if (singleMatch) {
    const n = Number(singleMatch[1]);
    return { min: n, max: plus ? Number.MAX_SAFE_INTEGER : n, label: str };
  }
  // fallback
  return { min: 0, max: Number.MAX_SAFE_INTEGER, label: String(raw) };
}

/**
 * Estado
 */
let espacios = [];
let questions = [];
let answers = {
  capacidad: null,    // {min,max,label}
  privacidad: null,   // "público" | "semi" | "privado"
  equipamiento: []    // [string, ...]
};
let step = 0;

/**
 * Referencias de DOM (compatibles con tus dos variantes de HTML)
 */
const appRoot = document.getElementById("app") || document.body;
const container =
  document.getElementById("question-container") ||
  document.getElementById("form") ||
  (() => {
    const d = document.createElement("div");
    d.id = "question-container";
    appRoot.appendChild(d);
    return d;
  })();

const nextBtn =
  document.getElementById("next-btn") ||
  document.getElementById("nextBtn") ||
  (() => {
    const b = document.createElement("button");
    b.id = "next-btn";
    b.textContent = "Siguiente";
    b.disabled = true;
    appRoot.appendChild(b);
    return b;
  })();

const resultDiv =
  document.getElementById("result") ||
  (() => {
    const d = document.createElement("div");
    d.id = "result";
    appRoot.appendChild(d);
    return d;
  })();

/**
 * Cargar JSON y armar preguntas
 */
fetch("espacios.json")
  .then((r) => r.json())
  .then((data) => {
    espacios = Array.isArray(data) ? data : [];
    buildQuestionsFromData(espacios);
    renderStep();
  })
  .catch((err) => {
    console.error("No se pudo cargar espacios.json", err);
    container.innerHTML =
      "<p style='color:#b00'>No se pudo cargar <b>espacios.json</b>. Verificá que esté en la misma carpeta y que estés usando un servidor local (Live Server).</p>";
  });

function buildQuestionsFromData(data) {
  // Paso 0 - Capacidad (buckets fijos)
  const capacidadBuckets = [
    { label: "2 personas", min: 2, max: 2 },
    { label: "2 a 4", min: 2, max: 4 },
    { label: "4 a 8", min: 4, max: 8 },
    { label: "8 a 20", min: 8, max: 20 },
    { label: "Más de 20", min: 21, max: Number.MAX_SAFE_INTEGER }
  ];

  // Paso 1 - Privacidad
  const PRIVS = ["público", "semi", "privado"];

  // Paso 2 - Equipamiento (extraído dinámicamente del JSON)
  const equipSet = new Set();
  data.forEach((e) => {
    toArray(e.equipamiento).forEach((eq) => equipSet.add(String(eq)));
  });
  const equipamientoOpts = Array.from(equipSet).sort((a, b) => norm(a).localeCompare(norm(b)));

  questions = [
    { id: "capacidad", type: "single-object", text: "¿Para cuántas personas será el espacio?", options: capacidadBuckets },
    { id: "privacidad", type: "single", text: "¿Qué nivel de privacidad necesitás?", options: PRIVS },
    { id: "equipamiento", type: "multiple", text: "¿Qué equipamiento necesitás? (podés elegir más de uno)", options: equipamientoOpts }
  ];
}

/**
 * Render de pasos
 */
function renderStep() {
  resultDiv.innerHTML = "";
  container.innerHTML = "";

  if (step >= questions.length) {
    renderResults();
    nextBtn.style.display = "none";
    return;
  }

  const q = questions[step];
  const h2 = document.createElement("h2");
  h2.textContent = q.text;
  container.appendChild(h2);

  const optionsWrap = document.createElement("div");
  container.appendChild(optionsWrap);

  // Dibujar opciones según tipo
  if (q.type === "single") {
    q.options.forEach((opt) => {
      const id = `${q.id}-${norm(opt)}`;
      const label = document.createElement("label");
      label.style.display = "block";

      const input = document.createElement("input");
      input.type = "radio";
      input.name = q.id;
      input.value = opt;
      input.id = id;
      if (answers[q.id] === opt) input.checked = true;

      label.setAttribute("for", id);
      label.appendChild(input);
      label.append(" " + opt);
      optionsWrap.appendChild(label);
    });
  } else if (q.type === "single-object") {
    q.options.forEach((opt) => {
      const id = `${q.id}-${norm(opt.label)}`;
      const label = document.createElement("label");
      label.style.display = "block";

      const input = document.createElement("input");
      input.type = "radio";
      input.name = q.id;
      input.value = JSON.stringify(opt);
      input.id = id;
      if (answers[q.id] && answers[q.id].label === opt.label) input.checked = true;

      label.setAttribute("for", id);
      label.appendChild(input);
      label.append(` ${opt.label}`);
      optionsWrap.appendChild(label);
    });
  } else if (q.type === "multiple") {
    q.options.forEach((opt) => {
      const id = `${q.id}-${norm(opt)}`;
      const label = document.createElement("label");
      label.style.display = "block";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = q.id;
      input.value = opt;
      input.id = id;
      if (Array.isArray(answers[q.id]) && answers[q.id].includes(opt)) input.checked = true;

      label.setAttribute("for", id);
      label.appendChild(input);
      label.append(" " + opt);
      optionsWrap.appendChild(label);
    });
  }

  // Estado del botón "Siguiente"
  const anyChecked = () => optionsWrap.querySelectorAll("input:checked").length > 0;
  nextBtn.disabled = !anyChecked();

  // Escuchar cambios y guardar respuestas
  optionsWrap.querySelectorAll("input").forEach((input) => {
    input.addEventListener("change", () => {
      if (q.type === "single") {
        answers[q.id] = input.value;
      } else if (q.type === "single-object") {
        answers[q.id] = JSON.parse(input.value);
      } else if (q.type === "multiple") {
        const selected = Array.from(optionsWrap.querySelectorAll("input:checked")).map((i) => i.value);
        answers[q.id] = selected;
      }
      nextBtn.disabled = !anyChecked();
    });
  });

  // Click "Siguiente"
  nextBtn.onclick = () => {
    step += 1;
    renderStep();
  };
}

/**
 * Filtrado de resultados
 */
function renderResults() {
  container.innerHTML = "<h2>Resultados</h2>";

  const seleccionCap = answers.capacidad; // {min,max,label}
  const seleccionPriv = norm(answers.privacidad); // string normalizado
  const seleccionEquip = (answers.equipamiento || []).map((e) => norm(e));

  const resultados = espacios
    .map((esp) => {
      // Normalizar espacio
      const cap = parseCapacity(esp.capacidad);
      const privs = toArray(esp.privacidad).map(norm);
      const equip = toArray(esp.equipamiento).map(norm);

      // Coincidencias
      const overlapCap = !(cap.max < seleccionCap.min || cap.min > seleccionCap.max); // intersección de rangos
      const matchPriv = privs.includes(seleccionPriv);
      const allEquip = seleccionEquip.every((eq) => equip.includes(eq));

      // Puntuar para ordenar: +2 si equipamiento completo, +1 si privacidad coincide, +1 si el rango de capacidad es ajustado
      let score = 0;
      if (allEquip) score += 2;
      if (matchPriv) score += 1;
      if (overlapCap) score += 1;

      return { esp, cap, privs, equip, overlapCap, matchPriv, allEquip, score };
    })
    .filter((r) => r.score >= 3) // requiere: overlapCap + matchPriv + allEquip
    .sort((a, b) => b.score - a.score);

  if (resultados.length === 0) {
    container.innerHTML += "<p>No se encontraron espacios que coincidan con tu selección.</p>";

    // Mostrar alternativas cercanas (si al menos coincide privacidad y capacidad)
    const cercanos = espacios
      .map((esp) => {
        const cap = parseCapacity(esp.capacidad);
        const privs = toArray(esp.privacidad).map(norm);
        const equip = toArray(esp.equipamiento).map(norm);
        const overlapCap = !(cap.max < seleccionCap.min || cap.min > seleccionCap.max);
        const matchPriv = privs.includes(seleccionPriv);
        const equipMatches = seleccionEquip.filter((eq) => equip.includes(eq)).length;

        let score = 0;
        if (overlapCap) score += 1;
        if (matchPriv) score += 1;
        score += equipMatches * 0.5;

        return { esp, cap, privs, equip, equipMatches, score };
      })
      .filter((r) => r.score >= 1.5)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    if (cercanos.length) {
      const h3 = document.createElement("h3");
      h3.textContent = "Alternativas cercanas";
      container.appendChild(h3);

      cercanos.forEach(({ esp }) => {
        const card = document.createElement("div");
        card.className = "resultado";
        card.innerHTML = `
          <h4>${esp.nombre}</h4>
          <p><b>Capacidad:</b> ${esp.capacidad.min != null ? `${esp.capacidad.min}-${esp.capacidad.max}` : esp.capacidad}</p>
          <p><b>Privacidad:</b> ${toArray(esp.privacidad).join(", ")}</p>
          <p><b>Equipamiento:</b> ${toArray(esp.equipamiento).join(", ")}</p>
        `;
        container.appendChild(card);
      });
    }
  } else {
    resultados.forEach(({ esp }) => {
      const card = document.createElement("div");
      card.className = "resultado";
      card.innerHTML = `
        <h3>${esp.nombre}</h3>
        <p><b>Capacidad:</b> ${esp.capacidad.min != null ? `${esp.capacidad.min}-${esp.capacidad.max}` : esp.capacidad}</p>
        <p><b>Privacidad:</b> ${toArray(esp.privacidad).join(", ")}</p>
        <p><b>Equipamiento:</b> ${toArray(esp.equipamiento).join(", ")}</p>
        <p>${esp.descripcion || ""}</p>
        <img src="imagenes/${esp.imagen}" alt="${esp.nombre}" class="resultado-img">
      `;
      container.appendChild(card);
    });
  }

  // Botón para reiniciar
  const restart = document.createElement("button");
  restart.textContent = "Volver a empezar";
  restart.onclick = () => {
    step = 0;
    answers = { capacidad: null, privacidad: null, equipamiento: [] };
    nextBtn.style.display = "";
    renderStep();
  };
  container.appendChild(restart);
}
