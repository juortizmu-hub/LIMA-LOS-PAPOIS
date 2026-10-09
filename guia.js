// Guía académica: organizador con IA.
// 1) Sube la ficha de matrícula y detecta tus cursos.
// 2) Sube el sílabo de cada curso: la IA extrae unidades y evaluaciones (Grupal / Individual).
// 3) El cronograma reparte las unidades a lo largo del ciclo y el gestor de tareas lista las entregas.
// Los análisis se guardan en el navegador. El procesamiento de texto lo hace /api/guia (api/guia.js).
(() => {
  const $ = (sel) => document.querySelector(sel);
  const CLAVE = "amigoucv:guia";
  const SEMANAS_CICLO = 16;
  const TAMANO_MAX = 10 * 1024 * 1024; // 10 MB

  // ---------- Estado ----------
  // cursos: [{ nombre, silabo: { curso, unidades, evaluaciones } | null }]
  // hechos: { "curso|evaluación": true } para el gestor de tareas
  let estado = { cursos: [], hechos: {} };

  function cargarEstado() {
    try {
      const raw = localStorage.getItem(CLAVE);
      if (raw) estado = { ...estado, ...JSON.parse(raw) };
    } catch {
      /* si el dato guardado está dañado, empezamos de cero */
    }
  }
  const guardarEstado = () => localStorage.setItem(CLAVE, JSON.stringify(estado));

  // ---------- Lectura de archivos ----------
  async function leerTexto(archivo) {
    if (archivo.size > TAMANO_MAX) throw new Error("El archivo supera los 10 MB.");
    if (archivo.type === "application/pdf" || archivo.name.toLowerCase().endsWith(".pdf")) {
      if (!window.pdfjsLib) throw new Error("No se pudo cargar el lector de PDF. Revisa tu conexión.");
      const pdf = await window.pdfjsLib.getDocument({ data: await archivo.arrayBuffer() }).promise;
      const partes = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const pagina = await pdf.getPage(i);
        const contenido = await pagina.getTextContent();
        partes.push(contenido.items.map((item) => item.str).join(" "));
      }
      return partes.join("\n");
    }
    return archivo.text();
  }

  async function analizar(tipo, texto) {
    const res = await fetch("/api/guia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo, texto }),
    });
    const datos = await res.json();
    if (!res.ok) throw new Error(datos.error || "Error del servidor");
    return datos.data;
  }

  const mostrarEstado = (texto) => {
    $("#guia-status").textContent = texto;
  };

  // ---------- Paneles ----------
  function mostrarPanel(nombre) {
    document.querySelectorAll(".guia-link").forEach((b) => b.classList.toggle("active", b.dataset.panel === nombre));
    document.querySelectorAll(".guia-panel").forEach((p) => p.classList.toggle("active", p.id === `panel-${nombre}`));
  }
  document.querySelectorAll(".guia-link").forEach((b) => b.addEventListener("click", () => mostrarPanel(b.dataset.panel)));

  // ---------- Zona de carga ----------
  function pintarCursosDetectados() {
    $("#guia-cursos-detectados").innerHTML = estado.cursos.length
      ? estado.cursos.map((c) => `<li><strong>${escapeHtml(c.nombre)}</strong>${c.silabo ? " · ✅ sílabo analizado" : " · falta sílabo"}</li>`).join("")
      : `<li class="hint">Aún no hay cursos detectados.</li>`;
  }

  function pintarZonaSilabos() {
    $("#guia-silabos").innerHTML = estado.cursos.length
      ? estado.cursos
          .map(
            (c, i) => `<div class="guia-silabo-row">
              <span class="guia-silabo-nombre">${escapeHtml(c.nombre)}</span>
              <input type="file" accept=".pdf,.txt,text/plain,application/pdf" data-silabo="${i}" aria-label="Sílabo de ${escapeHtml(c.nombre)}" />
              <span class="hint">${c.silabo ? "✅ Analizado" : "Pendiente"}</span>
            </div>`
          )
          .join("")
      : `<p class="hint">Sube tu ficha de matrícula para ver tus cursos aquí.</p>`;
  }

  $("#guia-matricula").addEventListener("change", async (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;
    try {
      mostrarEstado("Analizando tu ficha de matrícula…");
      const texto = await leerTexto(archivo);
      const { cursos } = await analizar("matricula", texto);
      // Conserva los sílabos que ya estaban analizados si el curso se repite
      estado.cursos = cursos.map((c) => {
        const previo = estado.cursos.find((x) => x.nombre === c.nombre);
        return { nombre: c.nombre, silabo: previo?.silabo || null };
      });
      guardarEstado();
      pintarCursosDetectados();
      pintarZonaSilabos();
      mostrarEstado(`Se detectaron ${cursos.length} cursos. Ahora sube el sílabo de cada uno.`);
    } catch (err) {
      mostrarEstado(`No pude analizar la ficha: ${err.message}`);
    }
  });

  $("#guia-silabos").addEventListener("change", async (e) => {
    const indice = e.target.dataset.silabo;
    const archivo = e.target.files[0];
    if (indice === undefined || !archivo) return;
    const curso = estado.cursos[Number(indice)];
    try {
      mostrarEstado(`Analizando el sílabo de ${curso.nombre}…`);
      const texto = await leerTexto(archivo);
      const silabo = await analizar("silabo", texto);
      curso.silabo = silabo;
      guardarEstado();
      pintarCursosDetectados();
      pintarZonaSilabos();
      pintarCronograma();
      pintarTareas();
      mostrarEstado(`Listo: el sílabo de ${curso.nombre} está analizado.`);
    } catch (err) {
      mostrarEstado(`No pude analizar el sílabo: ${err.message}`);
      e.target.value = "";
    }
  });

  // ---------- Cronograma: reparte las unidades a lo largo del ciclo ----------
  function planPorUnidades(unidades) {
    const n = unidades.length;
    if (!n) return [];
    const base = Math.floor(SEMANAS_CICLO / n);
    const extra = SEMANAS_CICLO % n;
    let semana = 1;
    return unidades.map((u, i) => {
      const duracion = base + (i < extra ? 1 : 0);
      const plan = { unidad: u, desde: semana, hasta: semana + duracion - 1 };
      semana += duracion;
      return plan;
    });
  }

  function pintarCronograma() {
    const conSilabo = estado.cursos.filter((c) => c.silabo);
    $("#guia-cronograma").innerHTML = conSilabo.length
      ? conSilabo
          .map((c) => {
            const plan = planPorUnidades(c.silabo.unidades || []);
            const filas = plan.length
              ? plan
                  .map(
                    (p) => `<li class="guia-semana">
                      <strong>Semanas ${p.desde}–${p.hasta} · ${escapeHtml(p.unidad.nombre)}</strong>
                      <ul>${(p.unidad.temas || []).map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>
                    </li>`
                  )
                  .join("")
              : `<li class="hint">Este sílabo no tiene unidades detectadas.</li>`;
            return `<article class="card guia-curso">
              <h3>${escapeHtml(c.nombre)}</h3>
              <ol class="guia-plan">${filas}</ol>
            </article>`;
          })
          .join("")
      : `<p class="hint">Cuando analices un sílabo, aquí verás qué estudiar en cada etapa del ciclo.</p>`;
  }

  // ---------- Gestor de tareas ----------
  function pintarTareas() {
    const tareas = [];
    estado.cursos.forEach((c) => {
      (c.silabo?.evaluaciones || []).forEach((ev) => tareas.push({ curso: c.nombre, ...ev }));
    });
    tareas.sort((a, b) => (a.semana ?? 99) - (b.semana ?? 99));

    $("#guia-tareas").innerHTML = tareas.length
      ? `<ul class="list guia-tareas">${tareas
          .map((t) => {
            const clave = `${t.curso}|${t.nombre}`;
            const hecho = Boolean(estado.hechos[clave]);
            const etiqueta = t.tipo === "Grupal" ? "guia-tag grupal" : "guia-tag individual";
            return `<li class="guia-tarea${hecho ? " hecha" : ""}">
              <label>
                <input type="checkbox" data-hecho="${escapeHtml(clave)}" ${hecho ? "checked" : ""} />
                <span class="guia-tarea-nombre">${escapeHtml(t.nombre)}</span>
              </label>
              <span class="${etiqueta}">${escapeHtml(t.tipo)}</span>
              <span class="hint">${escapeHtml(t.curso)}${t.semana ? ` · Semana ${t.semana}` : ""}</span>
              ${t.descripcion ? `<p class="hint">${escapeHtml(t.descripcion)}</p>` : ""}
            </li>`;
          })
          .join("")}</ul>`
      : `<p class="hint">Aún no hay evaluaciones. Analiza un sílabo para verlas aquí.</p>`;
  }

  $("#guia-tareas").addEventListener("change", (e) => {
    const clave = e.target.dataset.hecho;
    if (!clave) return;
    estado.hechos[clave] = e.target.checked;
    guardarEstado();
    pintarTareas();
  });

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  // ---------- Inicio ----------
  cargarEstado();
  pintarCursosDetectados();
  pintarZonaSilabos();
  pintarCronograma();
  pintarTareas();
})();
