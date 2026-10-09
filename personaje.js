// Mi personaje: galería de modelos, emociones, accesorios y colores.
// Todo se dibuja con SVG propio. Para añadir modelos, emociones o accesorios, agrega una entrada
// en MODELOS, EMOCIONES o ACCESORIOS. No hace falta tocar el resto del código.
(() => {
  const KEY = "amigoucv:personajeGaleria";
  const $ = (sel) => document.querySelector(sel);
  const TINTA = "#1d2a36";
  const HEX = /^#[0-9a-f]{6}$/i;

  // ---------- Emociones: cambian la cara y la animación ----------
  const EMOCIONES = [
    { id: "feliz", nombre: "Feliz", icono: "😊", anim: "anim-bounce" },
    { id: "triste", nombre: "Triste", icono: "😢", anim: "anim-sway" },
    { id: "enojado", nombre: "Enojado", icono: "😠", anim: "anim-shake" },
    { id: "enamorado", nombre: "Enamorado", icono: "😍", anim: "anim-pulse" },
    { id: "sorprendido", nombre: "Sorprendido", icono: "😲", anim: "anim-jump" },
    { id: "dormido", nombre: "Dormido", icono: "😴", anim: "anim-breath" },
    { id: "relajado", nombre: "Relajado", icono: "😌", anim: "anim-float" },
    { id: "pensativo", nombre: "Pensativo", icono: "🤔", anim: "anim-tilt" },
    { id: "travieso", nombre: "Travieso", icono: "😜", anim: "anim-wiggle" },
    { id: "tierno", nombre: "Tierno", icono: "🥰", anim: "anim-float" },
    { id: "divertido", nombre: "Divertido", icono: "😂", anim: "anim-spin" },
  ];

  // Caras: se dibujan en coordenadas relativas al centro de la cara (0,0)
  const CARAS = {
    feliz: `
      <path d="M -30 0 Q -22 -10 -14 0" fill="none" stroke="${TINTA}" stroke-width="4" stroke-linecap="round"/>
      <path d="M 14 0 Q 22 -10 30 0" fill="none" stroke="${TINTA}" stroke-width="4" stroke-linecap="round"/>
      <path d="M -16 14 Q 0 32 16 14" fill="none" stroke="${TINTA}" stroke-width="4" stroke-linecap="round"/>
      <circle cx="-34" cy="14" r="5" fill="#f9a8d4" opacity="0.8"/><circle cx="34" cy="14" r="5" fill="#f9a8d4" opacity="0.8"/>`,
    triste: `
      <circle cx="-22" cy="2" r="9" fill="#fff" stroke="${TINTA}" stroke-width="2"/><circle cx="-22" cy="6" r="5" fill="${TINTA}"/>
      <circle cx="22" cy="2" r="9" fill="#fff" stroke="${TINTA}" stroke-width="2"/><circle cx="22" cy="6" r="5" fill="${TINTA}"/>
      <path d="M -32 -14 L -12 -20 M 32 -14 L 12 -20" stroke="${TINTA}" stroke-width="3" stroke-linecap="round"/>
      <path d="M -14 26 Q 0 14 14 26" fill="none" stroke="${TINTA}" stroke-width="4" stroke-linecap="round"/>
      <ellipse cx="-30" cy="18" rx="3" ry="6" fill="#9fd8ff"/>`,
    enojado: `
      <circle cx="-22" cy="2" r="7" fill="${TINTA}"/><circle cx="22" cy="2" r="7" fill="${TINTA}"/>
      <path d="M -32 -20 L -10 -10 M 32 -20 L 10 -10" stroke="${TINTA}" stroke-width="5" stroke-linecap="round"/>
      <path d="M -14 24 L 14 24" stroke="${TINTA}" stroke-width="5" stroke-linecap="round"/>`,
    enamorado: `
      <path d="M -22 8 C -32 -2 -28 -12 -22 -6 C -16 -12 -12 -2 -22 8 Z" fill="#f43f5e"/>
      <path d="M 22 8 C 12 -2 16 -12 22 -6 C 28 -12 32 -2 22 8 Z" fill="#f43f5e"/>
      <path d="M -14 14 Q 0 30 14 14" fill="none" stroke="${TINTA}" stroke-width="4" stroke-linecap="round"/>`,
    sorprendido: `
      <circle cx="-22" cy="0" r="12" fill="#fff" stroke="${TINTA}" stroke-width="2"/><circle cx="-22" cy="0" r="3" fill="${TINTA}"/>
      <circle cx="22" cy="0" r="12" fill="#fff" stroke="${TINTA}" stroke-width="2"/><circle cx="22" cy="0" r="3" fill="${TINTA}"/>
      <ellipse cx="0" cy="26" rx="8" ry="10" fill="${TINTA}"/>`,
    dormido: `
      <path d="M -30 0 Q -22 6 -14 0" fill="none" stroke="${TINTA}" stroke-width="4" stroke-linecap="round"/>
      <path d="M 14 0 Q 22 6 30 0" fill="none" stroke="${TINTA}" stroke-width="4" stroke-linecap="round"/>
      <path d="M -6 18 Q 0 22 6 18" fill="none" stroke="${TINTA}" stroke-width="3" stroke-linecap="round"/>
      <text x="32" y="-26" font-size="16" font-weight="700" fill="${TINTA}">z</text>
      <text x="42" y="-42" font-size="12" font-weight="700" fill="${TINTA}">z</text>`,
    relajado: `
      <path d="M -30 2 Q -22 -6 -14 2" fill="none" stroke="${TINTA}" stroke-width="4" stroke-linecap="round"/>
      <path d="M 14 2 Q 22 -6 30 2" fill="none" stroke="${TINTA}" stroke-width="4" stroke-linecap="round"/>
      <path d="M -12 16 Q 0 22 12 16" fill="none" stroke="${TINTA}" stroke-width="4" stroke-linecap="round"/>`,
    pensativo: `
      <circle cx="-22" cy="0" r="9" fill="#fff" stroke="${TINTA}" stroke-width="2"/><circle cx="-22" cy="-4" r="5" fill="${TINTA}"/>
      <circle cx="22" cy="0" r="9" fill="#fff" stroke="${TINTA}" stroke-width="2"/><circle cx="22" cy="-4" r="5" fill="${TINTA}"/>
      <path d="M -10 22 L 10 22" stroke="${TINTA}" stroke-width="3" stroke-linecap="round"/>
      <circle cx="40" cy="-30" r="3" fill="${TINTA}"/><circle cx="48" cy="-40" r="4" fill="${TINTA}"/>`,
    travieso: `
      <circle cx="-22" cy="0" r="9" fill="#fff" stroke="${TINTA}" stroke-width="2"/><circle cx="-20" cy="2" r="5" fill="${TINTA}"/>
      <path d="M 14 0 Q 22 -6 30 0" fill="none" stroke="${TINTA}" stroke-width="4" stroke-linecap="round"/>
      <path d="M -8 18 Q 6 28 16 14" fill="none" stroke="${TINTA}" stroke-width="4" stroke-linecap="round"/>`,
    tierno: `
      <circle cx="-22" cy="0" r="10" fill="#fff" stroke="${TINTA}" stroke-width="2"/><circle cx="-22" cy="2" r="6" fill="${TINTA}"/>
      <circle cx="22" cy="0" r="10" fill="#fff" stroke="${TINTA}" stroke-width="2"/><circle cx="22" cy="2" r="6" fill="${TINTA}"/>
      <circle cx="-30" cy="-4" r="2.5" fill="#fff"/><circle cx="14" cy="-4" r="2.5" fill="#fff"/>
      <circle cx="-34" cy="14" r="6" fill="#f9a8d4" opacity="0.9"/><circle cx="34" cy="14" r="6" fill="#f9a8d4" opacity="0.9"/>
      <path d="M -5 18 Q 0 22 5 18" fill="none" stroke="${TINTA}" stroke-width="3" stroke-linecap="round"/>`,
    divertido: `
      <path d="M -30 2 Q -22 -10 -14 2" fill="none" stroke="${TINTA}" stroke-width="4" stroke-linecap="round"/>
      <path d="M 14 2 Q 22 -10 30 2" fill="none" stroke="${TINTA}" stroke-width="4" stroke-linecap="round"/>
      <path d="M -16 12 Q 0 36 16 12 Z" fill="${TINTA}"/>
      <ellipse cx="0" cy="25" rx="6" ry="4" fill="#f9a8d4"/>`,
  };

  // ---------- Accesorios: se dibujan sobre la cabeza ----------
  const ACCESORIOS = [
    { id: "ninguno", nombre: "Ninguno", icono: "🚫" },
    { id: "gorro", nombre: "Gorro", icono: "🧢" },
    { id: "lentes", nombre: "Lentes", icono: "🕶️" },
    { id: "mono", nombre: "Moño", icono: "🎀" },
    { id: "corona", nombre: "Corona", icono: "👑" },
    { id: "flor", nombre: "Flor", icono: "🌼" },
    { id: "bufanda", nombre: "Bufanda", icono: "🧣" },
  ];

  const accesorio = (id, t, cara, c) => {
    const { x: fx, y: fy, s } = cara;
    switch (id) {
      case "gorro":
        return `<path d="M ${t.x - 42} ${t.y + 6} Q ${t.x} ${t.y - 58} ${t.x + 42} ${t.y + 6} Z" fill="${c.detalle}" stroke="${TINTA}" stroke-width="3"/>
          <circle cx="${t.x}" cy="${t.y - 56}" r="7" fill="#fff" stroke="${TINTA}" stroke-width="2"/>`;
      case "lentes":
        return `<g fill="none" stroke="${TINTA}" stroke-width="4">
          <circle cx="${fx - 22 * s}" cy="${fy}" r="16"/><circle cx="${fx + 22 * s}" cy="${fy}" r="16"/>
          <path d="M ${fx - 6 * s} ${fy} L ${fx + 6 * s} ${fy}"/></g>`;
      case "mono":
        return `<g transform="translate(${t.x + 32} ${t.y + 6})" fill="${c.detalle}" stroke="${TINTA}" stroke-width="2">
          <path d="M 0 0 L -16 -10 L -16 10 Z"/><path d="M 0 0 L 16 -10 L 16 10 Z"/><circle cx="0" cy="0" r="4"/></g>`;
      case "corona":
        return `<path d="M ${t.x - 30} ${t.y + 4} L ${t.x - 30} ${t.y - 18} L ${t.x - 14} ${t.y - 4} L ${t.x} ${t.y - 24} L ${t.x + 14} ${t.y - 4} L ${t.x + 30} ${t.y - 18} L ${t.x + 30} ${t.y + 4} Z"
          fill="#fdd835" stroke="${TINTA}" stroke-width="3" stroke-linejoin="round"/>`;
      case "flor":
        return `<g transform="translate(${t.x - 34} ${t.y + 8})">
          <circle cx="0" cy="-8" r="7" fill="#f9a8d4"/><circle cx="8" cy="0" r="7" fill="#f9a8d4"/>
          <circle cx="0" cy="8" r="7" fill="#f9a8d4"/><circle cx="-8" cy="0" r="7" fill="#f9a8d4"/>
          <circle cx="0" cy="0" r="5" fill="#fdd835" stroke="${TINTA}" stroke-width="1.5"/></g>`;
      case "bufanda":
        return `<g transform="translate(${100} ${cara.y + 58 * cara.s})">
          <rect x="-44" y="0" width="88" height="14" rx="7" fill="${c.detalle}" stroke="${TINTA}" stroke-width="2"/>
          <rect x="22" y="8" width="14" height="30" rx="6" fill="${c.detalle}" stroke="${TINTA}" stroke-width="2"/></g>`;
      default:
        return "";
    }
  };

  // ---------- Modelos: cada uno dibuja su cuerpo, su cara y el punto donde va el accesorio ----------
  const MODELOS = [
    {
      id: "buddy", nombre: "Buddy",
      dibujar: (c) => `
        <rect x="55" y="25" width="90" height="185" rx="45" fill="${c.cuerpo}" stroke="${TINTA}" stroke-width="3"/>
        <rect x="55" y="158" width="90" height="52" rx="26" fill="${c.detalle}" stroke="${TINTA}" stroke-width="3"/>`,
      cara: { x: 100, y: 85, s: 1.1 }, tope: { x: 100, y: 25 },
    },
    {
      id: "chibi", nombre: "Chibi",
      dibujar: (c) => `
        <circle cx="100" cy="85" r="60" fill="${c.cuerpo}" stroke="${TINTA}" stroke-width="3"/>
        <rect x="68" y="140" width="64" height="55" rx="22" fill="${c.detalle}" stroke="${TINTA}" stroke-width="3"/>`,
      cara: { x: 100, y: 85, s: 1.2 }, tope: { x: 100, y: 25 },
    },
    {
      id: "oso", nombre: "Osito",
      dibujar: (c) => `
        <circle cx="55" cy="50" r="20" fill="${c.cuerpo}" stroke="${TINTA}" stroke-width="3"/><circle cx="55" cy="50" r="10" fill="${c.detalle}"/>
        <circle cx="145" cy="50" r="20" fill="${c.cuerpo}" stroke="${TINTA}" stroke-width="3"/><circle cx="145" cy="50" r="10" fill="${c.detalle}"/>
        <ellipse cx="100" cy="190" rx="45" ry="30" fill="${c.cuerpo}" stroke="${TINTA}" stroke-width="3"/>
        <circle cx="100" cy="100" r="55" fill="${c.cuerpo}" stroke="${TINTA}" stroke-width="3"/>`,
      cara: { x: 100, y: 105, s: 1 }, tope: { x: 100, y: 45 },
    },
    {
      id: "gato", nombre: "Gatito",
      dibujar: (c) => `
        <polygon points="60,80 62,30 92,62" fill="${c.cuerpo}" stroke="${TINTA}" stroke-width="3" stroke-linejoin="round"/>
        <polygon points="140,80 138,30 108,62" fill="${c.cuerpo}" stroke="${TINTA}" stroke-width="3" stroke-linejoin="round"/>
        <ellipse cx="100" cy="195" rx="40" ry="25" fill="${c.cuerpo}" stroke="${TINTA}" stroke-width="3"/>
        <ellipse cx="100" cy="105" rx="55" ry="50" fill="${c.cuerpo}" stroke="${TINTA}" stroke-width="3"/>
        <path d="M 40 112 L 10 108 M 40 122 L 12 126 M 160 112 L 190 108 M 160 122 L 188 126" stroke="${TINTA}" stroke-width="2.5"/>`,
      cara: { x: 100, y: 105, s: 1 }, tope: { x: 100, y: 45 },
    },
    {
      id: "robot", nombre: "Robot",
      dibujar: (c) => `
        <line x1="100" y1="40" x2="100" y2="18" stroke="${TINTA}" stroke-width="4"/>
        <circle cx="100" cy="14" r="7" fill="${c.detalle}" stroke="${TINTA}" stroke-width="2"/>
        <rect x="40" y="145" width="20" height="40" rx="10" fill="${c.cuerpo}" stroke="${TINTA}" stroke-width="3"/>
        <rect x="140" y="145" width="20" height="40" rx="10" fill="${c.cuerpo}" stroke="${TINTA}" stroke-width="3"/>
        <rect x="55" y="40" width="90" height="90" rx="16" fill="${c.cuerpo}" stroke="${TINTA}" stroke-width="3"/>
        <rect x="68" y="135" width="64" height="65" rx="12" fill="${c.detalle}" stroke="${TINTA}" stroke-width="3"/>`,
      cara: { x: 100, y: 85, s: 1 }, tope: { x: 100, y: 40 },
    },
    {
      id: "banana", nombre: "Bananita",
      dibujar: (c) => `
        <path d="M 62 40 Q 160 60 150 150 Q 142 205 92 210 Q 128 180 120 128 Q 112 70 62 40 Z" fill="${c.cuerpo}" stroke="${TINTA}" stroke-width="3" stroke-linejoin="round"/>
        <rect x="56" y="30" width="12" height="16" rx="4" fill="${c.detalle}" stroke="${TINTA}" stroke-width="2"/>`,
      cara: { x: 112, y: 112, s: 0.9 }, tope: { x: 100, y: 35 },
    },
    {
      id: "conejo", nombre: "Conejito",
      dibujar: (c) => `
        <ellipse cx="78" cy="45" rx="14" ry="38" fill="${c.cuerpo}" stroke="${TINTA}" stroke-width="3"/>
        <ellipse cx="78" cy="45" rx="7" ry="26" fill="${c.detalle}"/>
        <ellipse cx="122" cy="45" rx="14" ry="38" fill="${c.cuerpo}" stroke="${TINTA}" stroke-width="3"/>
        <ellipse cx="122" cy="45" rx="7" ry="26" fill="${c.detalle}"/>
        <ellipse cx="100" cy="195" rx="42" ry="26" fill="${c.cuerpo}" stroke="${TINTA}" stroke-width="3"/>
        <circle cx="100" cy="112" r="50" fill="${c.cuerpo}" stroke="${TINTA}" stroke-width="3"/>`,
      cara: { x: 100, y: 112, s: 1 }, tope: { x: 100, y: 12 },
    },
    {
      id: "pinguino", nombre: "Pingüino",
      dibujar: (c) => `
        <ellipse cx="100" cy="206" rx="16" ry="8" fill="#fdd835" stroke="${TINTA}" stroke-width="2"/>
        <ellipse cx="78" cy="206" rx="16" ry="8" fill="#fdd835" stroke="${TINTA}" stroke-width="2"/>
        <ellipse cx="100" cy="120" rx="62" ry="85" fill="${c.cuerpo}" stroke="${TINTA}" stroke-width="3"/>
        <ellipse cx="100" cy="130" rx="38" ry="60" fill="${c.detalle}"/>
        <polygon points="92,105 108,105 100,120" fill="#fdd835" stroke="${TINTA}" stroke-width="2"/>`,
      cara: { x: 100, y: 88, s: 0.9 }, tope: { x: 100, y: 35 },
    },
  ];

  // ---------- Niveles: qué se desbloquea en cada nivel (ver progreso.js) ----------
  // Requisito de nivel por elemento. 999 = solo se desbloquea con un cofre.
  const NIVEL_MODELO = { buddy: 1, chibi: 1, oso: 2, gato: 3, robot: 4, banana: 5, conejo: 6, pinguino: 10 };
  const NIVEL_EMOCION = { feliz: 1, triste: 1, tierno: 1, enojado: 2, relajado: 2, enamorado: 3, pensativo: 3, sorprendido: 4, dormido: 4, travieso: 5, divertido: 5 };
  const NIVEL_ACCESORIO = { ninguno: 1, gorro: 3, lentes: 4, mono: 6, flor: 8, bufanda: 999, corona: 20 };
  const NIVEL_FONDO = { cielo: 1, atardecer: 5, espacio: 999 };
  const NIVEL_EFECTO = { ninguno: 1, brillo: 999, estrellas: 999 };
  // Tipo de cada mapa: se usa para buscar desbloqueos de cofre ("accesorio:bufanda")
  const TIPO_DE = new Map([
    [NIVEL_MODELO, "modelo"], [NIVEL_EMOCION, "emocion"], [NIVEL_ACCESORIO, "accesorio"],
    [NIVEL_FONDO, "fondo"], [NIVEL_EFECTO, "efecto"],
  ]);
  const FONDOS = [
    { id: "cielo", nombre: "Cielo" },
    { id: "atardecer", nombre: "Atardecer" },
    { id: "espacio", nombre: "Espacio" },
  ];
  const EFECTOS = [
    { id: "ninguno", nombre: "Ninguno", icono: "🚫" },
    { id: "brillo", nombre: "Brillo", icono: "✨" },
    { id: "estrellas", nombre: "Estrellas", icono: "⭐" },
  ];
  let nivelActual = 1;
  const EXTRAS_KEY = "amigoucv:extras";
  const extras = () => {
    try {
      return JSON.parse(localStorage.getItem(EXTRAS_KEY) || "[]");
    } catch {
      return [];
    }
  };
  const desbloqueado = (mapa, id) => (mapa[id] || 1) <= nivelActual || extras().includes(`${TIPO_DE.get(mapa)}:${id}`);
  const bloqueoHtml = (mapa, id) => {
    if (desbloqueado(mapa, id)) return "";
    return mapa[id] >= 999 ? ` <span class="pj-lock">🎁 Cofre</span>` : ` <span class="pj-lock">🔒 Nivel ${mapa[id]}</span>`;
  };

  // ---------- Dibujo completo ----------
  const colorValido = (v, defecto) => (HEX.test(v) ? v : defecto);
  const DEFECTO = { nombre: "Lunito", modelo: "buddy", emocion: "feliz", accesorio: "ninguno", fondo: "cielo", efecto: "ninguno", cuerpo: "#fdd835", detalle: "#1e63c9" };

  function svgPersonaje(e) {
    const modelo = MODELOS.find((m) => m.id === e.modelo) || MODELOS[0];
    const c = {
      cuerpo: colorValido(e.cuerpo, DEFECTO.cuerpo),
      detalle: colorValido(e.detalle, DEFECTO.detalle),
    };
    const emocion = EMOCIONES.find((x) => x.id === e.emocion) || EMOCIONES[0];
    const cara = modelo.cara;
    const caraSvg = `<g transform="translate(${cara.x} ${cara.y}) scale(${cara.s})">${CARAS[emocion.id]}</g>`;
    const acc = accesorio(e.accesorio, modelo.tope, cara, c);
    return `<svg viewBox="0 0 200 230" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${modelo.nombre}, ${emocion.nombre}">
      ${modelo.dibujar(c)}${caraSvg}${acc}</svg>`;
  }

  function vistaPrevia(e) {
    const emocion = EMOCIONES.find((x) => x.id === e.emocion) || EMOCIONES[0];
    return `<div class="pj-stage ${emocion.anim} efecto-${e.efecto || "ninguno"}">${svgPersonaje(e)}</div>`;
  }

  // ---------- Estado y guardado ----------
  let estado = { ...DEFECTO };

  function cargarGuardado() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? { ...DEFECTO, ...JSON.parse(raw) } : { ...DEFECTO };
    } catch {
      return { ...DEFECTO };
    }
  }

  function renderTodo() {
    $("#pj-preview").innerHTML = vistaPrevia(estado);
    const modelo = MODELOS.find((m) => m.id === estado.modelo) || MODELOS[0];
    const emocion = EMOCIONES.find((x) => x.id === estado.emocion) || EMOCIONES[0];
    $("#pj-nombre").textContent = `${modelo.nombre} · ${emocion.nombre}`;

    $("#pj-galeria").innerHTML = MODELOS.map((m) => {
      const bloqueado = !desbloqueado(NIVEL_MODELO, m.id);
      return `<button type="button" class="pj-card${m.id === estado.modelo ? " selected" : ""}${bloqueado ? " locked" : ""}" data-modelo="${m.id}" aria-pressed="${m.id === estado.modelo}" ${bloqueado ? "disabled" : ""}>
        <span class="pj-card-art">${svgPersonaje({ ...estado, modelo: m.id, emocion: "feliz", accesorio: "ninguno" })}</span>
        <span class="pj-card-name">${m.nombre}${bloqueoHtml(NIVEL_MODELO, m.id)}</span>
      </button>`;
    }).join("");

    $("#pj-emociones").innerHTML = EMOCIONES.map((x) => {
      const bloqueado = !desbloqueado(NIVEL_EMOCION, x.id);
      return `<button type="button" class="pj-chip${x.id === estado.emocion ? " selected" : ""}${bloqueado ? " locked" : ""}" data-emocion="${x.id}" aria-pressed="${x.id === estado.emocion}" ${bloqueado ? "disabled" : ""}>${x.icono} ${x.nombre}${bloqueoHtml(NIVEL_EMOCION, x.id)}</button>`;
    }).join("");

    $("#pj-accesorios").innerHTML = ACCESORIOS.map((x) => {
      const bloqueado = !desbloqueado(NIVEL_ACCESORIO, x.id);
      return `<button type="button" class="pj-chip${x.id === estado.accesorio ? " selected" : ""}${bloqueado ? " locked" : ""}" data-accesorio="${x.id}" aria-pressed="${x.id === estado.accesorio}" ${bloqueado ? "disabled" : ""}>${x.icono} ${x.nombre}${bloqueoHtml(NIVEL_ACCESORIO, x.id)}</button>`;
    }).join("");

    $("#pj-fondos").innerHTML = FONDOS.map((x) => {
      const bloqueado = !desbloqueado(NIVEL_FONDO, x.id);
      return `<button type="button" class="pj-chip${x.id === estado.fondo ? " selected" : ""}${bloqueado ? " locked" : ""}" data-fondo="${x.id}" aria-pressed="${x.id === estado.fondo}" ${bloqueado ? "disabled" : ""}>${x.nombre}${bloqueoHtml(NIVEL_FONDO, x.id)}</button>`;
    }).join("");
    $("#pj-efectos").innerHTML = EFECTOS.map((x) => {
      const bloqueado = !desbloqueado(NIVEL_EFECTO, x.id);
      return `<button type="button" class="pj-chip${x.id === estado.efecto ? " selected" : ""}${bloqueado ? " locked" : ""}" data-efecto="${x.id}" aria-pressed="${x.id === estado.efecto}" ${bloqueado ? "disabled" : ""}>${x.icono} ${x.nombre}${bloqueoHtml(NIVEL_EFECTO, x.id)}</button>`;
    }).join("");
    $("#pj-preview").className = `pj-preview fondo-${estado.fondo}`;
    $("#pj-nombre-personaje").value = estado.nombre;
    $("#pj-cuerpo").value = estado.cuerpo;
    $("#pj-detalle").value = estado.detalle;
  }

  const mostrarEstado = (texto) => {
    $("#pj-estado").textContent = texto;
  };

  // ---------- Eventos ----------
  $("#pj-galeria").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-modelo]");
    if (!btn) return;
    if (!desbloqueado(NIVEL_MODELO, btn.dataset.modelo)) return;
    estado.modelo = btn.dataset.modelo;
    mostrarEstado("");
    renderTodo();
  });

  $("#pj-emociones").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-emocion]");
    if (!btn) return;
    if (!desbloqueado(NIVEL_EMOCION, btn.dataset.emocion)) return;
    estado.emocion = btn.dataset.emocion;
    mostrarEstado("");
    renderTodo();
  });

  $("#pj-accesorios").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-accesorio]");
    if (!btn) return;
    if (!desbloqueado(NIVEL_ACCESORIO, btn.dataset.accesorio)) return;
    estado.accesorio = btn.dataset.accesorio;
    mostrarEstado("");
    renderTodo();
  });

  $("#pj-fondos").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-fondo]");
    if (!btn || !desbloqueado(NIVEL_FONDO, btn.dataset.fondo)) return;
    estado.fondo = btn.dataset.fondo;
    renderTodo();
  });

  $("#pj-efectos").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-efecto]");
    if (!btn || !desbloqueado(NIVEL_EFECTO, btn.dataset.efecto)) return;
    estado.efecto = btn.dataset.efecto;
    renderTodo();
  });

  $("#pj-nombre-personaje").addEventListener("input", (e) => {
    estado.nombre = e.target.value.trim().slice(0, 20) || "Lunito";
  });

  $("#pj-cuerpo").addEventListener("input", (e) => {
    estado.cuerpo = e.target.value;
    $("#pj-preview").innerHTML = vistaPrevia(estado);
  });

  $("#pj-detalle").addEventListener("input", (e) => {
    estado.detalle = e.target.value;
    $("#pj-preview").innerHTML = vistaPrevia(estado);
  });

  $("#pj-guardar").addEventListener("click", () => {
    localStorage.setItem(KEY, JSON.stringify(estado));
    mostrarEstado("¡Personaje guardado! ✨");
    window.dispatchEvent(new Event("amigo:personaje-guardado"));
  });

  $("#pj-restablecer").addEventListener("click", () => {
    estado = { ...DEFECTO };
    localStorage.setItem(KEY, JSON.stringify(estado));
    renderTodo();
    mostrarEstado("Personaje restablecido.");
  });

  $("#pj-aleatorio").addEventListener("click", () => {
    const elegir = (lista) => lista[Math.floor(Math.random() * lista.length)];
    const colores = ["#fdd835", "#1e63c9", "#9fd8ff", "#f9a8d4", "#ffffff", "#ff8a65", "#66bb6a", "#a78bfa"];
    estado = {
      modelo: elegir(MODELOS.filter((m) => desbloqueado(NIVEL_MODELO, m.id))).id,
      emocion: elegir(EMOCIONES.filter((x) => desbloqueado(NIVEL_EMOCION, x.id))).id,
      accesorio: elegir(ACCESORIOS.filter((x) => desbloqueado(NIVEL_ACCESORIO, x.id))).id,
      cuerpo: elegir(colores),
      detalle: elegir(colores),
    };
    renderTodo();
    mostrarEstado("¡Personaje aleatorio! Guárdalo si te gusta.");
  });

  // ---------- Inicio ----------
  // Puente con progreso.js: tarjeta de inicio y niveles
  window.AmigoPersonaje = {
    svgGuardado: () => svgPersonaje({ ...DEFECTO, ...cargarGuardado() }),
    claseGuardada: () => {
      const g = { ...DEFECTO, ...cargarGuardado() };
      return `fondo-${g.fondo} efecto-${g.efecto}`;
    },
    nombre: () => ({ ...DEFECTO, ...cargarGuardado() }).nombre,
  };
  window.addEventListener("amigo:extras", () => renderTodo());
  window.addEventListener("amigo:nivel", (e) => {
    nivelActual = e.detail.nivel;
    renderTodo();
  });
  if (window.AmigoNivel) nivelActual = window.AmigoNivel.nivel;

  estado = cargarGuardado();
  renderTodo();
})();
