// Mi compañero UCV: tarjeta de progreso, niveles, racha diaria y cofres de recompensa.
// - XP: cada publicación válida (10+ caracteres) da 25 XP y cada registro de ánimo da 10 XP.
// - Nivel: cada 100 XP sube un nivel. Las recompensas dependen del progreso, no de cómo te sientes.
// - Racha: días seguidos con alguna actividad (publicar o registrar ánimo).
// - Cofres: se abren al llegar a ciertos niveles y al cumplir cada 7 días de racha.
// Usa window.AmigoSocial (social.js) para leer tus publicaciones y window.AmigoPersonaje (personaje.js) para dibujarlo.
(() => {
  const $ = (sel) => document.querySelector(sel);
  const XP_PUBLICACION = 25;
  const XP_ANIMO = 10;
  const XP_POR_NIVEL = 100;
  const CARACTERES_MINIMOS = 10;
  const DIAS_RACHA_COFRE = 7;
  const NIVELES_COFRE = [4, 8, 12];
  const CLAVE_COFRES = "amigoucv:cofres";
  const CLAVE_EXTRAS = "amigoucv:extras";

  // Nombres por nivel. Los niveles que no aparecen usan "Compañero en crecimiento".
  const NOMBRES_NIVEL = {
    1: "🌱 Compañero nuevo",
    2: "🌿 Explorador emocional",
    3: "🌼 Amigo en crecimiento",
    5: "🌳 Compañero especial",
    10: "🌟 Amigo extraordinario",
    20: "💎 Compañero legendario",
  };
  // Recompensa de cada nivel clave, para mostrar la "próxima recompensa"
  const RECOMPENSAS_NIVEL = {
    2: "nueva expresión",
    3: "accesorio",
    5: "nuevo fondo",
    10: "apariencia especial",
    20: "accesorio exclusivo",
  };
  const MENSAJES = [
    "¡Qué bueno que te tomes un momento para reconocer tus emociones! 💙",
    "Cada emoción merece ser escuchada.",
    "Los pequeños pasos también cuentan. 🌱",
    "Tu constancia se nota: ¡sigue así! 🔥",
  ];
  // Premios posibles de un cofre (ropa, lentes, fondos y efectos)
  const PREMIOS = {
    "accesorio:bufanda": "🧣 Bufanda",
    "accesorio:corona": "👑 Corona",
    "fondo:espacio": "🌌 Fondo Espacio",
    "efecto:brillo": "✨ Efecto brillo",
    "efecto:estrellas": "⭐ Efecto estrellas",
  };

  const nivelDe = (xp) => 1 + Math.floor(xp / XP_POR_NIVEL);
  const nombreDe = (nivel) => NOMBRES_NIVEL[nivel] || "🌼 Compañero en crecimiento";
  const leer = (clave, defecto) => {
    try {
      return JSON.parse(localStorage.getItem(clave)) ?? defecto;
    } catch {
      return defecto;
    }
  };

  // Cofres: "pendientes" esperan a abrirse; "abiertos" ya se abrieron
  let cofres = leer(CLAVE_COFRES, { pendientes: [], abiertos: [] });
  const guardarCofres = () => localStorage.setItem(CLAVE_COFRES, JSON.stringify(cofres));

  // Días (en formato fecha local) con actividad. Cuenta la racha hasta hoy, o hasta ayer si hoy aún no hay actividad.
  function rachaDias(dias) {
    const d = new Date();
    if (!dias.has(d.toDateString())) d.setDate(d.getDate() - 1);
    let racha = 0;
    while (dias.has(d.toDateString())) {
      racha++;
      d.setDate(d.getDate() - 1);
    }
    return racha;
  }

  // Un cofre por cada nivel clave y uno por cada ciclo de 7 días de racha
  function revisarCofres(nivel, racha) {
    const nuevos = [];
    NIVELES_COFRE.filter((n) => nivel >= n).forEach((n) => nuevos.push(`nivel-${n}`));
    const ciclos = Math.floor(racha / DIAS_RACHA_COFRE);
    for (let i = 1; i <= ciclos; i++) nuevos.push(`racha-${i}`);
    let cambio = false;
    nuevos.forEach((id) => {
      if (!cofres.abiertos.includes(id) && !cofres.pendientes.includes(id)) {
        cofres.pendientes.push(id);
        cambio = true;
      }
    });
    if (cambio) guardarCofres();
  }

  let estado = { xp: 0, racha: 0, aviso: "" };

  function pintar() {
    const nivel = nivelDe(estado.xp);
    const progresoNivel = estado.xp % XP_POR_NIVEL;
    const porcentaje = Math.round((progresoNivel / XP_POR_NIVEL) * 100);
    const personaje = window.AmigoPersonaje;

    $("#pc-personaje").innerHTML = personaje ? personaje.svgGuardado() : "";
    $("#pc-personaje").className = `pc-personaje ${personaje ? personaje.claseGuardada() : ""}`;
    $("#pc-personaje-nombre").textContent = `🐥 Mi personaje: ${personaje ? personaje.nombre() : "Lunito"}`;
    $("#pc-nivel").textContent = `🏆 Nivel ${nivel} — ${nombreDe(nivel).replace(/^\S+\s/, "")}`;
    $("#pc-xp").textContent = `⭐ Experiencia: ${progresoNivel}/${XP_POR_NIVEL} XP`;
    $("#pc-relleno").style.width = `${porcentaje}%`;
    $("#pc-barra").setAttribute("aria-valuenow", String(porcentaje));
    $("#pc-porcentaje").textContent = `${porcentaje} %`;
    $("#pc-racha").textContent = estado.racha > 0
      ? `🔥 Racha actual: ${estado.racha} ${estado.racha === 1 ? "día" : "días"}`
      : "🔥 Registra cómo te sientes hoy para empezar tu racha";
    $("#pc-recompensa").textContent = proximaRecompensa(nivel);
    $("#pc-mensaje").textContent = `«${MENSAJES[estado.xp % MENSAJES.length]}»`;
    $("#pc-aviso").textContent = estado.aviso;

    const hayCofre = cofres.pendientes.length > 0;
    $("#pc-cofre").hidden = !hayCofre;
    $("#pc-cofre").textContent = hayCofre ? `🎁 Abrir cofre (${cofres.pendientes.length})` : "";
  }

  function proximaRecompensa(nivel) {
    const siguiente = Object.keys(RECOMPENSAS_NIVEL).map(Number).find((n) => n > nivel);
    if (!siguiente) return "🌈 Ya alcanzaste las recompensas principales.";
    return `🌈 Próxima recompensa: nivel ${siguiente} — ${RECOMPENSAS_NIVEL[siguiente]}.`;
  }

  // Actividad: publicaciones válidas (Supabase) y registros de ánimo (este navegador)
  async function calcular() {
    const social = window.AmigoSocial;
    const usuario = social?.usuario();
    const animo = leer("amigoucv:mood", []);

    let validas = [];
    let aviso = "";
    if (!social) {
      aviso = "Para guardar tus publicaciones, configura Supabase en supabase-config.js.";
    } else if (!usuario) {
      aviso = "Inicia sesión en el muro para sumar experiencia con tus publicaciones.";
    } else {
      const { data, error } = await social.sb().from("posts").select("text, created_at").eq("user_id", usuario.id);
      if (error) {
        aviso = "No pude cargar tus publicaciones. Intenta más tarde.";
      } else {
        validas = data.filter((p) => p.text.trim().length >= CARACTERES_MINIMOS);
      }
    }

    const dias = new Set([
      ...validas.map((p) => new Date(p.created_at).toDateString()),
      ...animo.map((m) => new Date(m.date).toDateString()),
    ]);
    const xp = validas.length * XP_PUBLICACION + animo.length * XP_ANIMO;
    const racha = rachaDias(dias);

    estado = { xp, racha, aviso };
    revisarCofres(nivelDe(xp), racha);
    pintar();
    const nivel = nivelDe(xp);
    window.AmigoNivel = { nivel };
    window.dispatchEvent(new CustomEvent("amigo:nivel", { detail: { nivel } }));
  }

  // ---------- Cofre ----------
  $("#pc-cofre").addEventListener("click", () => {
    const extras = leer(CLAVE_EXTRAS, []);
    const disponibles = Object.keys(PREMIOS).filter((k) => !extras.includes(k));
    cofres.abiertos.push(cofres.pendientes.shift());
    guardarCofres();

    if (disponibles.length === 0) {
      $("#pc-cofre-estado").textContent = "¡Ya tienes todos los premios del cofre! 🎉";
    } else {
      const premio = disponibles[Math.floor(Math.random() * disponibles.length)];
      extras.push(premio);
      localStorage.setItem(CLAVE_EXTRAS, JSON.stringify(extras));
      $("#pc-cofre-estado").textContent = `🎉 ¡Ganaste: ${PREMIOS[premio]}! Está disponible en Mi personaje.`;
      window.dispatchEvent(new Event("amigo:extras"));
    }
    pintar();
  });

  $("#pc-compartir").addEventListener("click", () => {
    showView("muro");
    $("#post-text").focus();
  });

  window.addEventListener("amigo:sesion", calcular);
  window.addEventListener("amigo:publicacion", calcular);
  window.addEventListener("amigo:animo", calcular);
  window.addEventListener("amigo:personaje-guardado", pintar);
  calcular();
})();
