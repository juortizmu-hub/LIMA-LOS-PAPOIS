// Amigo UCV: lógica del lado del cliente.
// Los datos personales (ánimo, visión board, posts, nombre ficticio) se guardan en localStorage del navegador.

const $ = (sel) => document.querySelector(sel);

const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(`amigoucv:${key}`);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    localStorage.setItem(`amigoucv:${key}`, JSON.stringify(value));
  },
  clearAll() {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("amigoucv:"))
      .forEach((k) => localStorage.removeItem(k));
  },
};

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// ---------- Filtro de contenido (publicaciones, metas, notas y apodos) ----------
// Se aplica a lo que se publica o se guarda para otras personas. El chat privado NO se filtra,
// para que nadie se quede sin poder pedir ayuda al escribir algo fuerte.
// Cada entrada es el inicio de una palabra: "asesin" cubre asesino, asesinar, asesinato, etc.
const PALABRAS_BLOQUEADAS = [
  // Sexual explícito
  "porno", "desnud", "nudes", "masturb", "follar", "orgia", "pene", "vagina", "tetas", "sexo oral",
  // Asesinatos y violencia contra otros
  "asesin", "homicid", "masacr", "descuartiz", "degoll", "decapit", "genocid", "tiroteo",
  // Ofensas y insultos a personas
  "puta", "puto", "perra", "zorra", "maricon", "pendej", "imbecil", "idiota", "estupid", "retrasad",
];

// Amenazas, burlas y humillaciones: expresiones que pueden herir aunque no tengan palabras fuertes
const PATRONES_DANINOS = [
  /\bte (voy a|vamos a) (matar|golpear|pegar|lastimar|hacer dano)/, // amenazas
  /\bnadie te (quiere|extrana|necesita)\b/, // burlas sobre sentimientos
  /\beres (un |una )?(fracasad[oa]|inutil|bueno para nada|perdedor[a]?|loser|patetic[oa])\b/, // humillaciones
  /\b(todos|los) \w+ (son|sois) (unos |unas )?(ladrones|sucios|basura|animales)\b/, // discriminación generalizada
];

const AVISO_FILTRO =
  "Parece que este mensaje podría herir a alguien. ¿Quieres cambiar algunas palabras? Tu texto sigue aquí para que lo edites.";

// Quita tildes y pasa a minúsculas para que "Múltiple" y "multiple" se comparen igual
const normalizarTexto = (s) =>
  String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function contieneContenidoBloqueado(texto) {
  const limpio = normalizarTexto(texto);
  const palabra = PALABRAS_BLOQUEADAS.some((termino) => {
    const patron = new RegExp(`\\b${normalizarTexto(termino).replace(/ /g, "\\s+")}`);
    return patron.test(limpio);
  });
  return palabra || PATRONES_DANINOS.some((patron) => patron.test(limpio));
}

// ---------- Navegación (barra lateral siempre visible) ----------
function showView(name) {
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${name}`));
  document.querySelectorAll(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.view === name));
  // El fondo espacial cambia según la sección (ver body[data-view] en styles.css)
  document.body.dataset.view = name;
}
showView("inicio");
document.querySelectorAll(".nav-item").forEach((btn) =>
  btn.addEventListener("click", () => {
    showView(btn.dataset.view);
    setMenuOpen(false); // al elegir una sección, el menú se cierra solo
  })
);

// ---------- Menú desplegable (☰ Menú ⌄) ----------
function setMenuOpen(open) {
  $("#main-nav").classList.toggle("open", open);
  $("#menu-toggle").classList.toggle("open", open);
  $("#menu-toggle").setAttribute("aria-expanded", String(open));
}
$("#menu-toggle").addEventListener("click", () => {
  setMenuOpen(!$("#main-nav").classList.contains("open"));
});

// ---------- Chat privado (no se persiste) ----------
const chatHistory = [];

function addMessage(role, text) {
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.textContent = text;
  $("#chat-log").appendChild(div);
  $("#chat-log").scrollTop = $("#chat-log").scrollHeight;
}

$("#chat-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = $("#chat-input");
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  addMessage("user", text);
  chatHistory.push({ role: "user", content: text });

  const pending = document.createElement("div");
  pending.className = "msg bot";
  pending.textContent = "Escribiendo...";
  $("#chat-log").appendChild(pending);

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: chatHistory.slice(-20) }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error del servidor");
    chatHistory.push({ role: "assistant", content: data.reply });
    pending.textContent = data.reply;
  } catch (err) {
    chatHistory.pop();
    pending.textContent = "No pude responder en este momento. Intenta de nuevo más tarde.";
    console.error(err);
  }
});

// ---------- Estado de ánimo ----------
function renderMood() {
  const entries = store.get("mood", []);
  $("#mood-history").innerHTML = entries.length
    ? entries
        .slice()
        .reverse()
        .slice(0, 30)
        .map((m) => {
          const labels = ["", "Muy mal", "Mal", "Regular", "Bien", "Muy bien"];
          return `<li><strong>${labels[m.level]}</strong> · ${new Date(m.date).toLocaleString("es")}${
            m.note ? `<br>${escapeHtml(m.note)}` : ""
          }</li>`;
        })
        .join("")
    : `<li class="hint">Aún no has registrado tu estado de ánimo.</li>`;
}

$("#mood-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const level = Number(document.querySelector('input[name="mood"]:checked')?.value);
  if (!level) return;
  if (contieneContenidoBloqueado($("#mood-note").value)) {
    alert(AVISO_FILTRO);
    return;
  }
  const entries = store.get("mood", []);
  entries.push({ level, note: $("#mood-note").value.trim(), date: new Date().toISOString() });
  store.set("mood", entries);
  e.target.reset();
  renderMood();
});

// ---------- Visión board ----------
function renderVision() {
  const items = store.get("vision", []);
  $("#vision-board").innerHTML = items
    .map(
      (t, i) => `<div class="vision-card">${escapeHtml(t)}
        <button type="button" data-index="${i}" aria-label="Eliminar">×</button></div>`
    )
    .join("");
}

$("#vision-form").addEventListener("submit", (e) => {
  e.preventDefault();
  if (contieneContenidoBloqueado($("#vision-text").value)) {
    alert(AVISO_FILTRO);
    return;
  }
  const items = store.get("vision", []);
  items.push($("#vision-text").value.trim());
  store.set("vision", items);
  e.target.reset();
  renderVision();
});

$("#vision-board").addEventListener("click", (e) => {
  const idx = e.target.dataset.index;
  if (idx === undefined) return;
  const items = store.get("vision", []);
  items.splice(Number(idx), 1);
  store.set("vision", items);
  renderVision();
});

// ---------- Perfiles y apodos ----------
function getProfiles() {
  return store.get("perfiles", []);
}

function getActiveProfile() {
  const id = store.get("perfilActivo", null);
  return getProfiles().find((p) => p.id === id) || null;
}

function renderProfiles() {
  const profiles = getProfiles();
  const activeId = store.get("perfilActivo", null);
  $("#profile-list").innerHTML = profiles.length
    ? profiles
        .map((p) => {
          const icon = p.genero === "mujer" ? "👩" : "👨";
          const isActive = p.id === activeId;
          return `<li>
            <span>${icon} <strong>${escapeHtml(p.apodo)}</strong> · ${p.genero === "mujer" ? "Mujer" : "Hombre"}${
              isActive ? " · <em>(activo)</em>" : ""
            }</span>
            <button type="button" data-use="${p.id}" class="use-btn">${isActive ? "Activo" : "Usar"}</button>
            <button type="button" data-delete="${p.id}" class="danger" aria-label="Eliminar perfil">×</button>
          </li>`;
        })
        .join("")
    : `<li class="hint">Aún no tienes perfiles.</li>`;
}

$("#profile-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const apodo = $("#profile-alias").value.trim();
  if (!apodo) return;
  if (contieneContenidoBloqueado(apodo)) {
    alert(AVISO_FILTRO);
    return;
  }
  const profiles = getProfiles();
  const profile = { id: Date.now().toString(36), genero: $("#profile-gender").value, apodo };
  profiles.push(profile);
  store.set("perfiles", profiles);
  if (!getActiveProfile()) store.set("perfilActivo", profile.id);
  e.target.reset();
  renderProfiles();
});

$("#profile-list").addEventListener("click", (e) => {
  const useId = e.target.dataset.use;
  const deleteId = e.target.dataset.delete;
  if (useId) {
    store.set("perfilActivo", useId);
  } else if (deleteId) {
    store.set("perfiles", getProfiles().filter((p) => p.id !== deleteId));
    if (store.get("perfilActivo", null) === deleteId) store.set("perfilActivo", null);
  } else {
    return;
  }
  renderProfiles();
});

$("#clear-data").addEventListener("click", () => {
  if (!confirm("¿Borrar todos tus datos guardados en este navegador?")) return;
  store.clearAll();
  location.reload();
});

// ---------- Mi personaje (muñeco con cuerpo y colores) ----------
// Dibujo propio en SVG: el usuario elige forma y colores, y el muñeco se dibuja con esos valores.
const FORMAS_PERSONAJE = {
  redondo: { w: 130, h: 150 },
  alto: { w: 100, h: 190 },
  pequeno: { w: 120, h: 115 },
};
const COLORES_DEFECTO = { forma: "redondo", cuerpo: "#fdd835", ropa: "#1e63c9", cabello: "#1d2a36" };
const HEX = /^#[0-9a-f]{6}$/i;

function dibujarPersonaje(p) {
  const f = FORMAS_PERSONAJE[p.forma] || FORMAS_PERSONAJE.redondo;
  const cuerpo = HEX.test(p.cuerpo) ? p.cuerpo : COLORES_DEFECTO.cuerpo;
  const ropa = HEX.test(p.ropa) ? p.ropa : COLORES_DEFECTO.ropa;
  const cabello = HEX.test(p.cabello) ? p.cabello : COLORES_DEFECTO.cabello;
  const x = 100 - f.w / 2;
  const top = 215 - f.h;
  const ex = f.w * 0.2;
  const ey = top + f.h * 0.35;
  return `<svg viewBox="0 0 200 230" xmlns="http://www.w3.org/2000/svg">
    <rect x="${x - 10}" y="${top + f.h * 0.45}" width="14" height="${f.h * 0.35}" rx="7" fill="${cabello}" />
    <rect x="${x + f.w - 4}" y="${top + f.h * 0.45}" width="14" height="${f.h * 0.35}" rx="7" fill="${cabello}" />
    <rect x="${x}" y="${top}" width="${f.w}" height="${f.h}" rx="${f.w / 2}" fill="${cuerpo}" stroke="#1d2a36" stroke-width="3" />
    <rect x="${x}" y="${top + f.h * 0.6}" width="${f.w}" height="${f.h * 0.4}" rx="22" fill="${ropa}" stroke="#1d2a36" stroke-width="3" />
    <ellipse cx="100" cy="${top + 6}" rx="${f.w * 0.42}" ry="12" fill="${cabello}" />
    <circle cx="${100 - ex}" cy="${ey}" r="11" fill="#fff" stroke="#1d2a36" stroke-width="2" />
    <circle cx="${100 + ex}" cy="${ey}" r="11" fill="#fff" stroke="#1d2a36" stroke-width="2" />
    <circle cx="${100 - ex + 2}" cy="${ey + 2}" r="5" fill="#1d2a36" />
    <circle cx="${100 + ex + 2}" cy="${ey + 2}" r="5" fill="#1d2a36" />
    <path d="M ${100 - 14} ${top + f.h * 0.72} Q 100 ${top + f.h * 0.82} ${100 + 14} ${top + f.h * 0.72}" fill="none" stroke="#1d2a36" stroke-width="3" stroke-linecap="round" />
  </svg>`;
}

function leerFormularioPersonaje() {
  return {
    forma: $("#avatar-shape").value,
    cuerpo: $("#avatar-body").value,
    ropa: $("#avatar-cloth").value,
    cabello: $("#avatar-hair").value,
  };
}

function mostrarPersonajeGuardado() {
  const guardado = { ...COLORES_DEFECTO, ...store.get("personaje", {}) };
  $("#avatar-shape").value = guardado.forma;
  $("#avatar-body").value = guardado.cuerpo;
  $("#avatar-cloth").value = guardado.ropa;
  $("#avatar-hair").value = guardado.cabello;
  $("#avatar-preview").innerHTML = dibujarPersonaje(guardado);
}

$("#avatar-form").addEventListener("input", () => {
  $("#avatar-preview").innerHTML = dibujarPersonaje(leerFormularioPersonaje());
});

$("#avatar-form").addEventListener("submit", (e) => {
  e.preventDefault();
  store.set("personaje", leerFormularioPersonaje());
  alert("Personaje guardado.");
});

mostrarPersonajeGuardado();

// ---------- Inicio ----------
renderMood();
renderVision();
renderProfiles();
