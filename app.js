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

const AVISO_FILTRO = "Tu texto contiene palabras no permitidas. Cámbialo e inténtalo de nuevo.";

// Quita tildes y pasa a minúsculas para que "Múltiple" y "multiple" se comparen igual
const normalizarTexto = (s) =>
  String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function contieneContenidoBloqueado(texto) {
  const limpio = normalizarTexto(texto);
  return PALABRAS_BLOQUEADAS.some((termino) => {
    const patron = new RegExp(`\\b${normalizarTexto(termino).replace(/ /g, "\\s+")}`);
    return patron.test(limpio);
  });
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
  btn.addEventListener("click", () => showView(btn.dataset.view))
);

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

// ---------- Muro de posts ----------
function renderFeed() {
  const posts = store.get("posts", []);
  const visible = posts.filter((p) => p.visibility === "publico" || p.own);
  $("#feed").innerHTML = visible.length
    ? visible
        .slice()
        .reverse()
        .map((p) => {
          const author = p.identity === "anonimo" ? "Anónimo" : escapeHtml(p.alias || "Estudiante");
          const tag = p.visibility === "privado" ? " · Privado (solo tú lo ves)" : "";
          return `<article class="post">
            <div class="post-meta">${author} · ${escapeHtml(p.emotion)} · ${new Date(p.date).toLocaleString("es")}${tag}</div>
            <p>${escapeHtml(p.text)}</p>
          </article>`;
        })
        .join("")
    : `<p class="hint">Aún no hay publicaciones.</p>`;
}

$("#post-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const identity = $("#post-identity").value;
  const alias = getActiveProfile()?.apodo || "";
  if (contieneContenidoBloqueado($("#post-text").value) || contieneContenidoBloqueado(alias)) {
    alert(AVISO_FILTRO);
    return;
  }
  if (identity === "ficticio" && !alias) {
    alert("Crea un perfil y márcalo como activo en Configuración antes de publicar con tu apodo.");
    showView("config");
    return;
  }
  const posts = store.get("posts", []);
  posts.push({
    text: $("#post-text").value.trim(),
    emotion: $("#post-emotion").value,
    visibility: $("#post-visibility").value,
    identity,
    alias: identity === "ficticio" ? alias : "",
    own: true,
    date: new Date().toISOString(),
  });
  store.set("posts", posts);
  e.target.reset();
  renderFeed();
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

// ---------- Inicio ----------
renderFeed();
renderMood();
renderVision();
renderProfiles();
