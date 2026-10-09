// Mi compañero UCV: tarjeta de progreso en la pantalla de inicio.
// Cada publicación válida sobre cómo te sientes suma experiencia y sube el nivel del personaje.
// Usa window.AmigoSocial (social.js) para leer tus publicaciones y window.AmigoPersonaje (personaje.js) para dibujarlo.
(() => {
  const $ = (sel) => document.querySelector(sel);

  const PUBLICACIONES_POR_NIVEL = 3; // 3 publicaciones válidas = 1 nivel
  const CARACTERES_MINIMOS = 10; // una publicación "válida" tiene al menos 10 caracteres
  const NOMBRES_NIVEL = [
    "¡Bienvenido!",
    "Amigo en camino",
    "Compañero en crecimiento",
    "Compañero valiente",
    "Compañero brillante",
    "Compañero estrella",
    "Compañero leyenda",
  ];

  const nivelDe = (xp) => 1 + Math.floor(xp / PUBLICACIONES_POR_NIVEL);
  const nombreDe = (nivel) => NOMBRES_NIVEL[Math.min(nivel, NOMBRES_NIVEL.length) - 1];

  // Racha: días seguidos (hasta hoy, o hasta ayer si hoy aún no publicaste) con al menos una publicación válida
  function rachaDias(fechas) {
    const dias = new Set(fechas.map((f) => new Date(f).toDateString()));
    const d = new Date();
    if (!dias.has(d.toDateString())) d.setDate(d.getDate() - 1);
    let racha = 0;
    while (dias.has(d.toDateString())) {
      racha++;
      d.setDate(d.getDate() - 1);
    }
    return racha;
  }

  let estado = { xp: 0, racha: 0, mensaje: "" };

  function pintar() {
    const nivel = nivelDe(estado.xp);
    const enNivel = estado.xp % PUBLICACIONES_POR_NIVEL;
    const porcentaje = Math.round((enNivel / PUBLICACIONES_POR_NIVEL) * 100);

    $("#pc-personaje").innerHTML = window.AmigoPersonaje ? window.AmigoPersonaje.svgGuardado() : "";
    $("#pc-nivel").textContent = `Nivel ${nivel} — ${nombreDe(nivel)}`;
    $("#pc-xp").textContent = `⭐ Experiencia: ${enNivel}/${PUBLICACIONES_POR_NIVEL} publicaciones para el siguiente nivel.`;
    $("#pc-relleno").style.width = `${porcentaje}%`;
    $("#pc-barra").setAttribute("aria-valuenow", String(porcentaje));
    $("#pc-porcentaje").textContent = `${porcentaje} %`;
    $("#pc-racha").textContent = estado.racha > 0
      ? `🔥 Racha: ${estado.racha} ${estado.racha === 1 ? "día" : "días"} seguidos`
      : "🔥 Publica hoy para empezar tu racha";
    $("#pc-mensaje").textContent = estado.mensaje;
  }

  // Lee tus publicaciones desde Supabase y recalcula el progreso
  async function calcular() {
    const social = window.AmigoSocial;
    const usuario = social?.usuario();
    if (!social) {
      estado = { xp: 0, racha: 0, mensaje: "Para ver tu progreso, configura Supabase en supabase-config.js." };
    } else if (!usuario) {
      estado = { xp: 0, racha: 0, mensaje: "Inicia sesión en el muro para hacer crecer a tu personaje." };
    } else {
      const { data, error } = await social.sb()
        .from("posts")
        .select("text, created_at")
        .eq("user_id", usuario.id);
      if (error) {
        estado = { xp: 0, racha: 0, mensaje: "No pude cargar tu progreso. Intenta más tarde." };
      } else {
        const validas = data.filter((p) => p.text.trim().length >= CARACTERES_MINIMOS);
        estado = {
          xp: validas.length,
          racha: rachaDias(validas.map((p) => p.created_at)),
          mensaje: "",
        };
      }
    }
    pintar();
    const nivel = nivelDe(estado.xp);
    window.AmigoNivel = { nivel };
    window.dispatchEvent(new CustomEvent("amigo:nivel", { detail: { nivel } }));
  }

  $("#pc-compartir").addEventListener("click", () => {
    showView("muro");
    $("#post-text").focus();
  });

  window.addEventListener("amigo:sesion", calcular);
  window.addEventListener("amigo:publicacion", calcular);
  window.addEventListener("amigo:personaje-guardado", pintar);
  pintar();
})();
