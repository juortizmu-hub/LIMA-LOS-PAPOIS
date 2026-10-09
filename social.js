// Muro social de Amigo UCV: publicaciones, imágenes, edición, comentarios, respuestas, likes, reportes,
// perfiles con foto, búsqueda, notificaciones y compartir. Los datos viven en Supabase (ver supabase/).
// Usa las funciones globales de app.js: escapeHtml, contieneContenidoBloqueado, AVISO_FILTRO, getActiveProfile, showView.
(() => {
  const $ = (sel) => document.querySelector(sel);
  const cfg = window.AMIGO_SUPABASE || {};
  const CONFIGURADO = Boolean(window.supabase && cfg.url && cfg.anonKey && !cfg.url.includes("TU-PROYECTO"));
  const UMBRAL_REPORTES = 3;
  const MAX_IMAGEN_BYTES = 2 * 1024 * 1024;
  const BUCKET = "publicaciones";
  const BUCKET_AVATAR = "avatares";
  const CLAVE_NOTIF = "amigoucv:notifVistas";

  const abiertos = new Set();
  let respondiendo = null;
  let editando = null;
  const borradores = {};
  const perfiles = new Map(); // user_id -> { nombre, avatar_path }
  let usuario = null;
  let esAdmin = false;
  let sb = null;

  const fecha = (iso) => new Date(iso).toLocaleString("es");
  const mensajeError = (err) => escapeHtml(err?.message || "Algo salió mal. Intenta de nuevo.");
  const escaparLike = (q) => q.replace(/[%_\\]/g, (c) => `\\${c}`).slice(0, 50);

  // ---------- Arranque ----------
  if (!CONFIGURADO) {
    $("#social-status").textContent =
      "El muro necesita configurar Supabase: completa supabase-config.js y ejecuta supabase/schema.sql y supabase/migracion-2.sql.";
    document.querySelectorAll("#auth-form input, #auth-form button, #post-form textarea, #post-form button, #buscar-form input, #buscar-form button")
      .forEach((el) => (el.disabled = true));
    return;
  }

  sb = window.supabase.createClient(cfg.url, cfg.anonKey);
  // Puente con progreso.js (tarjeta de nivel de inicio)
  window.AmigoSocial = { sb: () => sb, usuario: () => usuario };

  // ---------- Perfiles ----------
  function urlAvatar(path) {
    return path ? sb.storage.from(BUCKET_AVATAR).getPublicUrl(path).data.publicUrl : null;
  }

  async function cargarPerfiles(ids) {
    const pendientes = [...new Set(ids)].filter((id) => id && !perfiles.has(id));
    if (!pendientes.length) return;
    const { data } = await sb.from("profiles").select("user_id, nombre, avatar_path").in("user_id", pendientes);
    (data || []).forEach((p) => perfiles.set(p.user_id, p));
  }

  async function asegurarPerfil() {
    const { data } = await sb.from("profiles").select("user_id").eq("user_id", usuario.id).maybeSingle();
    if (!data) {
      const nombre = (usuario.email || "").split("@")[0].slice(0, 40) || "Estudiante";
      await sb.from("profiles").insert({ user_id: usuario.id, nombre });
    }
  }

  const avatarHtml = (perfil, clase = "avatar") => {
    const url = urlAvatar(perfil?.avatar_path);
    return url
      ? `<img class="${clase}" src="${url}" alt="" loading="lazy" />`
      : `<span class="${clase} avatar-inicial" aria-hidden="true">${escapeHtml((perfil?.nombre || "E")[0].toUpperCase())}</span>`;
  };

  // Nombre que se muestra del autor. Las publicaciones anónimas no enlazan a ningún perfil.
  function autorHtml(p) {
    if (p.identity === "anonimo") return `<span>Anónimo</span>`;
    if (p.identity === "ficticio") return `<span>${escapeHtml(p.alias || "Estudiante")}</span>`;
    const perfil = perfiles.get(p.user_id);
    const nombre = escapeHtml(perfil?.nombre || "Estudiante");
    return `<button type="button" class="autor-link" data-perfil="${p.user_id}">${avatarHtml(perfil, "avatar-mini")}${nombre}</button>`;
  }

  function nombreDeActor(userId) {
    return escapeHtml(perfiles.get(userId)?.nombre || "Un estudiante");
  }

  // ---------- Cuenta ----------
  function pintarCuenta() {
    const formulario = $("#auth-form");
    const sesion = $("#auth-sesion");
    if (usuario) {
      formulario.hidden = true;
      sesion.hidden = false;
      $("#auth-usuario").textContent = `Sesión iniciada como ${usuario.email}${esAdmin ? " · 🛡️ Administrador" : ""}`;
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
    const { error } = await sb.auth.signOut();
    if (error) alert(`No pude cerrar sesión: ${error.message}`);
  });

  sb.auth.onAuthStateChange(async (_evento, sesion) => {
    usuario = sesion?.user || null;
    esAdmin = false;
    if (usuario) {
      await asegurarPerfil();
      const { data } = await sb.rpc("es_admin");
      esAdmin = data === true;
    }
    pintarCuenta();
    cargarMuro();
    actualizarBadge();
    window.dispatchEvent(new Event("amigo:sesion"));
  });

  // ---------- Datos de publicaciones ----------
  async function cargarDatos(posts) {
    const ids = posts.map((p) => p.id);
    if (!ids.length) return { likes: [], comentarios: [] };
    const [{ data: likes }, { data: comentarios }] = await Promise.all([
      sb.from("likes").select("post_id, user_id").in("post_id", ids),
      sb.from("comments").select("*").in("post_id", ids).order("created_at", { ascending: true }),
    ]);
    const datos = { likes: likes || [], comentarios: comentarios || [] };
    await cargarPerfiles([
      ...posts.map((p) => p.user_id),
      ...datos.comentarios.map((c) => c.user_id),
    ]);
    return datos;
  }

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
    const datos = await cargarDatos(posts);
    $("#feed").innerHTML = posts.map((p) => tarjetaPublicacion(p, datos)).join("");
    if (location.hash.startsWith("#post-")) {
      document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  // ---------- Dibujo ----------
  function tarjetaPublicacion(p, datos) {
    const propia = usuario && p.user_id === usuario.id;
    const tag = p.visibility === "privado" ? " · Privado (solo tú lo ves)" : "";
    const editado = p.updated_at ? " · editado" : "";
    const likesPost = datos.likes.filter((l) => l.post_id === p.id);
    const yaLeGuste = usuario && likesPost.some((l) => l.user_id === usuario.id);
    const comentariosPost = datos.comentarios.filter((c) => c.post_id === p.id);
    const imagen = p.image_path
      ? `<img class="post-img" src="${sb.storage.from(BUCKET).getPublicUrl(p.image_path).data.publicUrl}" alt="Imagen de la publicación" loading="lazy" />`
      : "";
    const estaAbierta = abiertos.has(p.id);
    const puedeBorrar = propia || esAdmin;

    const cuerpo = editando === p.id
      ? `<form class="edit-form" data-post="${p.id}">
           <textarea maxlength="500" required>${escapeHtml(p.text)}</textarea>
           <div class="row">
             <button type="submit">Guardar cambios</button>
             <button type="button" class="danger" data-cancel-edit="1">Cancelar</button>
           </div>
         </form>`
      : `<p>${escapeHtml(p.text)}</p>${imagen}`;

    return `<article class="post" id="post-${p.id}" data-post="${p.id}">
      <div class="post-meta">${autorHtml(p)} · ${escapeHtml(p.emotion)} · ${fecha(p.created_at)}${editado}${tag}</div>
      ${cuerpo}
      <div class="post-actions">
        <button type="button" class="social-btn${yaLeGuste ? " liked" : ""}" data-like="${p.id}" aria-pressed="${Boolean(yaLeGuste)}">💛 ${likesPost.length}</button>
        <button type="button" class="social-btn" data-toggle-comments="${p.id}" aria-expanded="${estaAbierta}">💬 ${comentariosPost.length}</button>
        <button type="button" class="social-btn" data-share="${p.id}">🔗 Compartir</button>
        ${usuario ? `<button type="button" class="social-btn report" data-report-post="${p.id}">🚩 Reportar</button>` : ""}
        ${propia ? `<button type="button" class="social-btn" data-edit-post="${p.id}">✏️ Editar</button>` : ""}
        ${puedeBorrar ? `<button type="button" class="social-btn danger" data-delete-post="${p.id}">${propia ? "Eliminar" : "Eliminar (admin)"}</button>` : ""}
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
    const perfil = perfiles.get(c.user_id);
    return `<li class="comment${esRespuesta ? " reply" : ""}">
      <div class="post-meta"><button type="button" class="autor-link" data-perfil="${c.user_id}">${avatarHtml(perfil, "avatar-mini")}${escapeHtml(perfil?.nombre || "Estudiante")}</button> · ${fecha(c.created_at)}</div>
      <p>${escapeHtml(c.text)}</p>
      <div class="post-actions">
        ${usuario && !esRespuesta ? `<button type="button" class="social-btn" data-reply="${c.id}">↩ Responder</button>` : ""}
        ${usuario ? `<button type="button" class="social-btn report" data-report-comment="${c.id}">🚩 Reportar</button>` : ""}
        ${propio || esAdmin ? `<button type="button" class="social-btn danger" data-delete-comment="${c.id}">${propio ? "Eliminar" : "Eliminar (admin)"}</button>` : ""}
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

  // ---------- Búsqueda ----------
  $("#buscar-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = $("#buscar-input").value.trim();
    if (!q) return;
    const patron = `%${escaparLike(q)}%`;
    const [{ data: personas }, { data: publicaciones }] = await Promise.all([
      sb.from("profiles").select("user_id, nombre, avatar_path").ilike("nombre", patron).limit(8),
      sb.from("posts").select("id, user_id, text, identity, alias, created_at").ilike("text", patron)
        .order("created_at", { ascending: false }).limit(20),
    ]);
    await cargarPerfiles((publicaciones || []).map((p) => p.user_id));
    (personas || []).forEach((p) => perfiles.set(p.user_id, p));

    const listaPersonas = (personas || []).length
      ? personas.map((p) => `<li><button type="button" class="autor-link" data-perfil="${p.user_id}">${avatarHtml(p, "avatar-mini")}${escapeHtml(p.nombre)}</button></li>`).join("")
      : `<li class="hint">Ninguna persona coincide.</li>`;
    const listaPosts = (publicaciones || []).length
      ? publicaciones.map((p) => `<li>
          <div class="post-meta">${autorHtml(p)} · ${fecha(p.created_at)}</div>
          <p>${escapeHtml(p.text.slice(0, 160))}${p.text.length > 160 ? "…" : ""}</p>
          <button type="button" class="social-btn" data-ir-post="${p.id}">Ver en el muro</button>
        </li>`).join("")
      : `<li class="hint">Ninguna publicación coincide.</li>`;

    $("#buscar-resultados").innerHTML = `
      <h3>Personas</h3><ul class="list">${listaPersonas}</ul>
      <h3>Publicaciones</h3><ul class="list">${listaPosts}</ul>`;
  });

  // ---------- Perfil ----------
  // Perfil en modo lectura por defecto; el botón "Editar perfil" cambia a modo edición
  let perfilEditando = false;

  async function renderPerfil(uid) {
    const { data: perfil } = await sb.from("profiles").select("*").eq("user_id", uid).maybeSingle();
    if (!perfil) {
      $("#perfil-contenido").innerHTML = `<p class="hint">Este perfil no está disponible.</p>`;
      return;
    }
    perfiles.set(uid, perfil);
    const { data: posts } = await sb.from("posts").select("*").eq("user_id", uid)
      .order("created_at", { ascending: false }).limit(50);
    const datos = await cargarDatos(posts || []);
    const propio = usuario && usuario.id === uid;
    if (!propio) perfilEditando = false;

    const detalles = [perfil.universidad, perfil.carrera].filter(Boolean).map(escapeHtml).join(" · ");
    const lectura = `
      <div class="card perfil-cabecera">
        ${avatarHtml(perfil, "avatar-grande")}
        <div class="perfil-datos">
          <h2>${escapeHtml(perfil.nombre)}</h2>
          ${detalles ? `<p class="perfil-detalles">🎓 ${detalles}</p>` : ""}
          <p>${escapeHtml(perfil.bio || (propio ? "Cuéntanos algo sobre ti." : "Sin descripción."))}</p>
          <p class="hint">${(posts || []).length} publicaciones</p>
          ${propio
            ? `<button type="button" class="social-btn" data-toggle-edit="1">✏️ Editar perfil</button>`
            : usuario ? `<button type="button" class="social-btn report" data-report-user="${uid}">🚩 Reportar a esta persona</button>` : ""}
        </div>
      </div>`;

    const edicion = propio && perfilEditando
      ? `<form id="perfil-form" class="card perfil-form">
           <h2>Editar perfil</h2>
           <label>Nombre<input id="perfil-nombre" type="text" maxlength="40" required value="${escapeHtml(perfil.nombre)}" /></label>
           <label>Universidad<input id="perfil-universidad" type="text" maxlength="80" value="${escapeHtml(perfil.universidad || "")}" /></label>
           <label>Carrera<input id="perfil-carrera" type="text" maxlength="80" value="${escapeHtml(perfil.carrera || "")}" /></label>
           <label>Biografía / descripción<textarea id="perfil-bio" rows="3" maxlength="300">${escapeHtml(perfil.bio || "")}</textarea></label>
           <label>Foto de perfil (máx. 2 MB)<input id="perfil-foto" type="file" accept="image/*" /></label>
           <div class="row">
             <button type="submit">Guardar cambios</button>
             <button type="button" class="danger" data-cancel-edit-perfil="1">Cancelar</button>
             <span id="perfil-status" class="hint" role="status"></span>
           </div>
         </form>`
      : "";

    $("#perfil-contenido").innerHTML = `
      ${lectura}
      ${edicion}
      <h2>Publicaciones</h2>
      <div id="perfil-posts">${(posts || []).length
        ? posts.map((p) => tarjetaPublicacion(p, datos)).join("")
        : `<p class="hint">Aún no hay publicaciones.</p>`}</div>`;
  }

  // ---------- Notificaciones (actividad real sobre tus publicaciones) ----------
  async function obtenerActividad() {
    const { data: mias } = await sb.from("posts").select("id, text").eq("user_id", usuario.id);
    const ids = (mias || []).map((p) => p.id);
    if (!ids.length) return [];
    const [{ data: comentarios }, { data: likes }] = await Promise.all([
      sb.from("comments").select("post_id, user_id, text, created_at").in("post_id", ids)
        .neq("user_id", usuario.id).order("created_at", { ascending: false }).limit(30),
      sb.from("likes").select("post_id, user_id, created_at").in("post_id", ids)
        .neq("user_id", usuario.id).order("created_at", { ascending: false }).limit(30),
    ]);
    await cargarPerfiles([...(comentarios || []), ...(likes || [])].map((a) => a.user_id));
    const items = [
      ...(comentarios || []).map((c) => ({
        fecha: c.created_at, postId: c.post_id, userId: c.user_id,
        texto: `${nombreDeActor(c.user_id)} comentó tu publicación: “${escapeHtml(c.text)}”`,
      })),
      ...(likes || []).map((l) => ({
        fecha: l.created_at, postId: l.post_id, userId: l.user_id,
        texto: `${nombreDeActor(l.user_id)} le dio me gusta a tu publicación`,
      })),
    ];
    return items.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  }

  async function actualizarBadge() {
    const badge = $("#nav-badge");
    if (!usuario) {
      badge.hidden = true;
      return;
    }
    const vistas = Number(localStorage.getItem(CLAVE_NOTIF) || 0);
    const nuevas = (await obtenerActividad()).filter((i) => new Date(i.fecha).getTime() > vistas).length;
    badge.hidden = nuevas === 0;
    badge.textContent = String(nuevas);
  }

  async function renderNotificaciones() {
    if (!usuario) {
      $("#notificaciones-lista").innerHTML = `<li class="hint">Inicia sesión para ver tu actividad.</li>`;
      return;
    }
    const items = await obtenerActividad();
    const vistas = Number(localStorage.getItem(CLAVE_NOTIF) || 0);
    $("#notificaciones-lista").innerHTML = items.length
      ? items.map((i) => `<li class="notif${new Date(i.fecha).getTime() > vistas ? " nueva" : ""}">
          <p>${i.texto}</p>
          <div class="post-actions">
            <span class="hint">${fecha(i.fecha)}</span>
            <button type="button" class="social-btn" data-ir-post="${i.postId}">Ver publicación</button>
          </div>
        </li>`).join("")
      : `<li class="hint">Aún no tienes actividad. Cuando comenten o den me gusta a tus publicaciones, aparecerá aquí.</li>`;
    localStorage.setItem(CLAVE_NOTIF, String(Date.now()));
    $("#nav-badge").hidden = true;
  }

  // ---------- Interacciones (delegadas) ----------
  async function reaccionar(t) {
    const d = t.dataset;
    if (d.toggleComments) {
      abiertos.has(d.toggleComments) ? abiertos.delete(d.toggleComments) : abiertos.add(d.toggleComments);
      return cargarMuro();
    }
    if (d.reply) {
      respondiendo = respondiendo === d.reply ? null : d.reply;
      return cargarMuro();
    }
    if (d.editPost) {
      editando = d.editPost;
      return cargarMuro();
    }
    if (d.cancelEdit !== undefined) {
      editando = null;
      return cargarMuro();
    }
    if (d.share) {
      const url = `${location.origin}${location.pathname}#post-${d.share}`;
      if (navigator.share) {
        await navigator.share({ title: "Amigo UCV", text: "Mira esta publicación en Amigo UCV", url }).catch(() => {});
      } else {
        await navigator.clipboard.writeText(url);
        alert("Enlace copiado. Pégalo para compartir la publicación.");
      }
      return;
    }
    if (d.toggleEdit !== undefined) {
      perfilEditando = !perfilEditando;
      return renderPerfil(usuario.id);
    }
    if (d.cancelEditPerfil !== undefined) {
      perfilEditando = false;
      return renderPerfil(usuario.id);
    }
    if (d.perfil) {
      showView("perfil");
      return renderPerfil(d.perfil);
    }
    if (d.irPost) {
      showView("muro");
      location.hash = `post-${d.irPost}`;
      return cargarMuro();
    }
    if (!usuario && (d.like || d.reportPost || d.reportComment || d.reportUser)) {
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
    if (d.reportPost || d.reportComment || d.reportUser) {
      const fila = d.reportPost ? { post_id: d.reportPost }
        : d.reportComment ? { comment_id: d.reportComment }
        : { reported_user: d.reportUser };
      const { error } = await sb.from("reports").insert({ user_id: usuario.id, ...fila });
      alert(error?.code === "23505"
        ? "Ya habías reportado este contenido. Gracias por avisar."
        : error ? mensajeError(error) : "Gracias por avisar. Revisaremos este contenido.");
      return;
    }
    if (d.deletePost) {
      if (!confirm("¿Eliminar esta publicación? También se borrarán sus comentarios.")) return;
      const { data: fila } = await sb.from("posts").select("image_path").eq("id", d.deletePost).maybeSingle();
      const { error } = await sb.from("posts").delete().eq("id", d.deletePost);
      if (error) return alert(mensajeError(error));
      if (fila?.image_path) await sb.storage.from(BUCKET).remove([fila.image_path]);
      abiertos.delete(d.deletePost);
      window.dispatchEvent(new Event("amigo:publicacion"));
      return cargarMuro();
    }
    if (d.deleteComment) {
      if (!confirm("¿Eliminar este comentario?")) return;
      const { error } = await sb.from("comments").delete().eq("id", d.deleteComment);
      if (error) return alert(mensajeError(error));
      return cargarMuro();
    }
  }

  document.addEventListener("click", (e) => {
    const t = e.target.closest("button[data-like], button[data-toggle-comments], button[data-reply], button[data-edit-post], button[data-cancel-edit], button[data-share], button[data-perfil], button[data-ir-post], button[data-report-post], button[data-report-comment], button[data-report-user], button[data-delete-post], button[data-delete-comment], button[data-toggle-edit], button[data-cancel-edit-perfil]");
    if (!t) return;
    reaccionar(t).catch((err) => alert(mensajeError(err)));
  });

  // Enlace de "Notificaciones" y "Mi perfil" del menú
  document.addEventListener("click", (e) => {
    const nav = e.target.closest(".nav-item[data-view]");
    if (!nav || !usuario) return;
    if (nav.dataset.view === "perfil") renderPerfil(usuario.id);
    if (nav.dataset.view === "notificaciones") renderNotificaciones();
  });

  // Edición de publicaciones y comentarios
  document.addEventListener("submit", async (e) => {
    const form = e.target;

    if (form.matches(".edit-form")) {
      e.preventDefault();
      const texto = form.querySelector("textarea").value.trim();
      if (!texto) return;
      if (contieneContenidoBloqueado(texto)) return alert(AVISO_FILTRO);
      const { error } = await sb.from("posts")
        .update({ text: texto, updated_at: new Date().toISOString() })
        .eq("id", form.dataset.post);
      if (error) return alert(mensajeError(error));
      editando = null;
      return cargarMuro();
    }

    if (form.matches(".comment-form")) {
      e.preventDefault();
      if (!usuario) return;
      const texto = form.querySelector(".comment-input").value.trim();
      if (!texto) return;
      if (contieneContenidoBloqueado(texto)) return alert(AVISO_FILTRO);
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
      return;
    }

    if (form.id === "perfil-form") {
      e.preventDefault();
      const nombre = $("#perfil-nombre").value.trim();
      const universidad = $("#perfil-universidad").value.trim();
      const carrera = $("#perfil-carrera").value.trim();
      const bio = $("#perfil-bio").value.trim();
      const foto = $("#perfil-foto").files[0];
      if (!nombre) return;
      if ([nombre, universidad, carrera, bio].some(contieneContenidoBloqueado)) return alert(AVISO_FILTRO);
      if (foto && (!foto.type.startsWith("image/") || foto.size > MAX_IMAGEN_BYTES)) {
        return alert("Elige una imagen de hasta 2 MB.");
      }
      $("#perfil-status").textContent = "Guardando…";
      const cambios = { nombre, universidad, carrera, bio };
      if (foto) {
        const ruta = `${usuario.id}/${Date.now()}-${foto.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error: errorFoto } = await sb.storage.from(BUCKET_AVATAR).upload(ruta, foto);
        if (errorFoto) {
          $("#perfil-status").textContent = "";
          return alert(`No pude subir la foto: ${errorFoto.message}`);
        }
        cambios.avatar_path = ruta;
      }
      const { error } = await sb.from("profiles").update(cambios).eq("user_id", usuario.id);
      $("#perfil-status").textContent = "";
      if (error) return alert(mensajeError(error));
      perfiles.delete(usuario.id);
      perfilEditando = false;
      renderPerfil(usuario.id);
      cargarMuro();
    }
  });

  // Texto de los comentarios: se guarda para no perderlo al redibujar
  document.addEventListener("input", (e) => {
    const form = e.target.closest(".comment-form");
    if (form) borradores[form.dataset.key] = e.target.value;
  });

  // Arranque: onAuthStateChange avisa con la sesión guardada (o sin ella) y carga el muro
  pintarCuenta();
})();
