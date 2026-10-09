// Muro social de Amigo UCV: publicaciones, imágenes, comentarios, respuestas, likes y reportes.
// Los datos viven en Supabase (ver supabase/schema.sql). Usa las funciones globales de app.js:
// escapeHtml, contieneContenidoBloqueado, AVISO_FILTRO, getActiveProfile y showView.
(() => {
  const $ = (sel) => document.querySelector(sel);
  const cfg = window.AMIGO_SUPABASE || {};
  const CONFIGURADO = Boolean(window.supabase && cfg.url && cfg.anonKey && !cfg.url.includes("TU-PROYECTO"));
  const UMBRAL_REPORTES = 3;
  const MAX_IMAGEN_BYTES = 2 * 1024 * 1024;
  const BUCKET = "publicaciones";

  // Qué comentarios están abiertos, a quién se responde y lo que la gente escribe (para no perderlo al redibujar)
  const abiertos = new Set();
  let respondiendo = null;
  const borradores = {};
  let usuario = null;
  let sb = null;

  const fecha = (iso) => new Date(iso).toLocaleString("es");
  const mensajeError = (err) => escapeHtml(err?.message || "Algo salió mal. Intenta de nuevo.");

  // ---------- Arranque ----------
  if (!CONFIGURADO) {
    $("#social-status").textContent =
      "El muro necesita configurar Supabase: completa supabase-config.js y ejecuta supabase/schema.sql.";
    document.querySelectorAll("#auth-form input, #auth-form button, #post-form textarea, #post-form button")
      .forEach((el) => (el.disabled = true));
    return;
  }

  sb = window.supabase.createClient(cfg.url, cfg.anonKey);
  // Puente con progreso.js (tarjeta de nivel de inicio)
  window.AmigoSocial = { sb: () => sb, usuario: () => usuario };

  // ---------- Cuenta ----------
  function pintarCuenta() {
    const formulario = $("#auth-form");
    const sesion = $("#auth-sesion");
    if (usuario) {
      formulario.hidden = true;
      sesion.hidden = false;
      $("#auth-usuario").textContent = `Sesión iniciada como ${usuario.email}`;
    } else {
      formulario.hidden = false;
      sesion.hidden = true;
    }
    const puedePublicar = Boolean(usuario);
    $("#post-form").querySelectorAll("textarea, select, input, button").forEach((el) => (el.disabled = !puedePublicar));
    $("#post-login-aviso").hidden = puedePublicar;
  }

  async function iniciarSesion(crear) {
    const email = $("#auth-email").value.trim();
    const password = $("#auth-password").value;
    if (!email || password.length < 6) {
      $("#auth-status").textContent = "Escribe tu correo y una contraseña de al menos 6 caracteres.";
      return;
    }
    const { data, error } = crear
      ? await sb.auth.signUp({ email, password })
      : await sb.auth.signInWithPassword({ email, password });
    if (error) {
      $("#auth-status").textContent = error.message;
      return;
    }
    $("#auth-status").textContent = crear && !data.session
      ? "Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión."
      : "";
    $("#auth-password").value = "";
  }

  $("#auth-login").addEventListener("click", () => iniciarSesion(false));
  $("#auth-register").addEventListener("click", () => iniciarSesion(true));
  $("#auth-logout").addEventListener("click", async () => {
    await sb.auth.signOut();
  });

  sb.auth.onAuthStateChange((_evento, sesion) => {
    usuario = sesion?.user || null;
    pintarCuenta();
    cargarMuro();
    window.dispatchEvent(new Event("amigo:sesion"));
  });

  // ---------- Carga del muro ----------
  async function cargarMuro() {
    const { data: posts, error } = await sb
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      $("#feed").innerHTML = `<p class="hint">No pude cargar las publicaciones. ${mensajeError(error)}</p>`;
      return;
    }
    if (!posts.length) {
      $("#feed").innerHTML = `<p class="hint">Aún no hay publicaciones. ¡Sé la primera persona en compartir algo!</p>`;
      return;
    }

    const ids = posts.map((p) => p.id);
    const [{ data: likes }, { data: comentarios }] = await Promise.all([
      sb.from("likes").select("post_id, user_id").in("post_id", ids),
      sb.from("comments").select("*").in("post_id", ids).order("created_at", { ascending: true }),
    ]);

    const datos = {
      posts,
      likes: likes || [],
      comentarios: comentarios || [],
    };
    $("#feed").innerHTML = posts.map((p) => tarjetaPublicacion(p, datos)).join("");
  }

  // ---------- Dibujo ----------
  function tarjetaPublicacion(p, datos) {
    const propia = usuario && p.user_id === usuario.id;
    const autor = p.identity === "anonimo" ? "Anónimo" : escapeHtml(p.alias || "Estudiante");
    const tag = p.visibility === "privado" ? " · Privado (solo tú lo ves)" : "";
    const likesPost = datos.likes.filter((l) => l.post_id === p.id);
    const yaLeGuste = usuario && likesPost.some((l) => l.user_id === usuario.id);
    const comentariosPost = datos.comentarios.filter((c) => c.post_id === p.id);
    const imagen = p.image_path
      ? `<img class="post-img" src="${sb.storage.from(BUCKET).getPublicUrl(p.image_path).data.publicUrl}" alt="Imagen de la publicación" loading="lazy" />`
      : "";
    const estaAbierta = abiertos.has(p.id);

    return `<article class="post" data-post="${p.id}">
      <div class="post-meta">${autor} · ${escapeHtml(p.emotion)} · ${fecha(p.created_at)}${tag}</div>
      <p>${escapeHtml(p.text)}</p>
      ${imagen}
      <div class="post-actions">
        <button type="button" class="social-btn${yaLeGuste ? " liked" : ""}" data-like="${p.id}" aria-pressed="${Boolean(yaLeGuste)}">💛 ${likesPost.length}</button>
        <button type="button" class="social-btn" data-toggle-comments="${p.id}" aria-expanded="${estaAbierta}">💬 ${comentariosPost.length}</button>
        ${usuario ? `<button type="button" class="social-btn report" data-report-post="${p.id}">🚩 Reportar</button>` : ""}
        ${propia ? `<button type="button" class="social-btn danger" data-delete-post="${p.id}">Eliminar</button>` : ""}
      </div>
      ${estaAbierta ? seccionComentarios(p.id, comentariosPost) : ""}
    </article>`;
  }

  function seccionComentarios(postId, comentarios) {
    const raices = comentarios.filter((c) => !c.parent_id);
    const respuestas = (id) => comentarios.filter((c) => c.parent_id === id);
    const lista = raices.length
      ? raices.map((c) => comentarioHtml(c, false) + respuestas(c.id).map((r) => comentarioHtml(r, true)).join("")).join("")
      : `<li class="hint">Aún no hay comentarios.</li>`;
    return `<section class="comments">
      <ul class="list comment-list">${lista}</ul>
      ${usuario ? formularioComentario(postId, null) : `<p class="hint">Inicia sesión para comentar.</p>`}
    </section>`;
  }

  function comentarioHtml(c, esRespuesta) {
    const propio = usuario && c.user_id === usuario.id;
    const formRespuesta = respondiendo === c.id ? formularioComentario(c.post_id, c.id) : "";
    return `<li class="comment${esRespuesta ? " reply" : ""}">
      <div class="post-meta">Estudiante · ${fecha(c.created_at)}</div>
      <p>${escapeHtml(c.text)}</p>
      <div class="post-actions">
        ${usuario && !esRespuesta ? `<button type="button" class="social-btn" data-reply="${c.id}">↩ Responder</button>` : ""}
        ${usuario ? `<button type="button" class="social-btn report" data-report-comment="${c.id}">🚩 Reportar</button>` : ""}
        ${propio ? `<button type="button" class="social-btn danger" data-delete-comment="${c.id}">Eliminar</button>` : ""}
      </div>
      ${formRespuesta}
    </li>`;
  }

  function formularioComentario(postId, padreId) {
    const clave = padreId ? `${postId}-${padreId}` : postId;
    return `<form class="comment-form" data-post="${postId}" data-parent="${padreId || ""}" data-key="${clave}">
      <input type="text" class="comment-input" maxlength="300" placeholder="${padreId ? "Escribe una respuesta…" : "Escribe un comentario…"}" value="${escapeHtml(borradores[clave] || "")}" required />
      <button type="submit">${padreId ? "Responder" : "Comentar"}</button>
    </form>`;
  }

  // ---------- Publicar ----------
  $("#post-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!usuario) return;
    const texto = $("#post-text").value.trim();
    const identity = $("#post-identity").value;
    const alias = getActiveProfile()?.apodo || "";
    const archivo = $("#post-image").files[0];

    if (contieneContenidoBloqueado(texto) || contieneContenidoBloqueado(alias)) {
      alert(AVISO_FILTRO);
      return;
    }
    if (identity === "ficticio" && !alias) {
      alert("Crea un perfil y márcalo como activo en Configuración antes de publicar con tu apodo.");
      showView("config");
      return;
    }
    if (archivo && (!archivo.type.startsWith("image/") || archivo.size > MAX_IMAGEN_BYTES)) {
      alert("Elige una imagen de hasta 2 MB.");
      return;
    }

    $("#post-status").textContent = "Publicando…";
    let rutaImagen = null;
    if (archivo) {
      const nombre = archivo.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      rutaImagen = `${usuario.id}/${Date.now()}-${nombre}`;
      const { error: errorSubida } = await sb.storage.from(BUCKET).upload(rutaImagen, archivo);
      if (errorSubida) {
        $("#post-status").textContent = "";
        alert(`No pude subir la imagen: ${errorSubida.message}`);
        return;
      }
    }

    const { error } = await sb.from("posts").insert({
      user_id: usuario.id,
      text: texto,
      emotion: $("#post-emotion").value,
      visibility: $("#post-visibility").value,
      identity,
      alias: identity === "ficticio" ? alias : null,
      image_path: rutaImagen,
    });
    if (error) {
      if (rutaImagen) await sb.storage.from(BUCKET).remove([rutaImagen]);
      $("#post-status").textContent = "";
      alert(`No pude publicar: ${error.message}`);
      return;
    }
    $("#post-status").textContent = "";
    e.target.reset();
    cargarMuro();
    window.dispatchEvent(new Event("amigo:publicacion"));
  });

  // ---------- Interacciones (un solo delegado para todo el muro) ----------
  $("#feed").addEventListener("click", async (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    const d = t.dataset;

    if (d.toggleComments) {
      abiertos.has(d.toggleComments) ? abiertos.delete(d.toggleComments) : abiertos.add(d.toggleComments);
      return cargarMuro();
    }
    if (d.reply) {
      respondiendo = respondiendo === d.reply ? null : d.reply;
      return cargarMuro();
    }
    if (!usuario && (d.like || d.reportPost || d.reportComment)) {
      alert("Inicia sesión para hacer esto.");
      return;
    }
    if (d.like) {
      const { data: ya } = await sb.from("likes").select("post_id").eq("post_id", d.like).eq("user_id", usuario.id);
      const { error } = ya?.length
        ? await sb.from("likes").delete().eq("post_id", d.like).eq("user_id", usuario.id)
        : await sb.from("likes").insert({ post_id: d.like, user_id: usuario.id });
      if (error) alert(mensajeError(error));
      return cargarMuro();
    }
    if (d.reportPost || d.reportComment) {
      const fila = d.reportPost ? { post_id: d.reportPost } : { comment_id: d.reportComment };
      const { error } = await sb.from("reports").insert({ user_id: usuario.id, ...fila });
      alert(error?.code === "23505"
        ? "Ya habías reportado este contenido. Gracias por avisar."
        : error ? mensajeError(error) : "Gracias por avisar. Revisaremos este contenido.");
      return;
    }
    if (d.deletePost) {
      if (!confirm("¿Eliminar tu publicación? También se borrarán sus comentarios.")) return;
      const { data: fila } = await sb.from("posts").select("image_path").eq("id", d.deletePost).single();
      const { error } = await sb.from("posts").delete().eq("id", d.deletePost);
      if (error) return alert(mensajeError(error));
      if (fila?.image_path) await sb.storage.from(BUCKET).remove([fila.image_path]);
      abiertos.delete(d.deletePost);
      window.dispatchEvent(new Event("amigo:publicacion"));
      return cargarMuro();
    }
    if (d.deleteComment) {
      if (!confirm("¿Eliminar tu comentario?")) return;
      const { error } = await sb.from("comments").delete().eq("id", d.deleteComment);
      if (error) return alert(mensajeError(error));
      return cargarMuro();
    }
  });

  // Guarda lo que se escribe en comentarios para no perderlo al redibujar
  $("#feed").addEventListener("input", (e) => {
    const form = e.target.closest(".comment-form");
    if (form) borradores[form.dataset.key] = e.target.value;
  });

  $("#feed").addEventListener("submit", async (e) => {
    const form = e.target.closest(".comment-form");
    if (!form || !usuario) return;
    e.preventDefault();
    const texto = form.querySelector(".comment-input").value.trim();
    if (!texto) return;
    if (contieneContenidoBloqueado(texto)) {
      alert(AVISO_FILTRO);
      return;
    }
    const { error } = await sb.from("comments").insert({
      post_id: form.dataset.post,
      user_id: usuario.id,
      parent_id: form.dataset.parent || null,
      text: texto,
    });
    if (error) return alert(mensajeError(error));
    delete borradores[form.dataset.key];
    respondiendo = null;
    abiertos.add(form.dataset.post);
    cargarMuro();
  });

  // Arranque: onAuthStateChange avisa con la sesión guardada (o sin ella) y carga el muro
  pintarCuenta();
})();
