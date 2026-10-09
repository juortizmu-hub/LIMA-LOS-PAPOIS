// Función serverless de Vercel: analiza la ficha de matrícula o el sílabo con IA y devuelve JSON.
// La clave se lee de ANTHROPIC_API_KEY (nunca en el código). El modelo se puede cambiar con GUIA_MODEL.

const MAX_CARACTERES = 40000;
const MODELO = process.env.GUIA_MODEL || "claude-sonnet-5-5";

const REGLAS_COMUNES = `Responde SOLO con JSON válido. Sin texto antes ni después, sin markdown.
No incluyas datos personales del estudiante (código, DNI, correo, dirección, teléfono).`;

const PROMPTS = {
  matricula: `Eres un asistente académico. Recibes el texto de una ficha de matrícula universitaria.
Extrae solo los cursos matriculados en este ciclo.
${REGLAS_COMUNES}
Formato:
{"cursos":[{"nombre":"Nombre del curso"}]}`,

  silabo: `Eres un asistente académico. Recibes el texto de un sílabo universitario.
Extrae el temario por unidades y todas las evaluaciones, proyectos y entregables.
Reglas:
- "unidades": en el orden del documento. Si el sílabo no separa unidades, crea una sola con el nombre "Temario general".
- "tipo" de cada evaluación: exactamente "Grupal" o "Individual". Es "Grupal" si el texto menciona grupo, equipo, pareja o trabajo colaborativo; en otro caso es "Individual".
- "semana": número de semana si el documento lo indica, si no null.
${REGLAS_COMUNES}
Formato:
{"curso":"Nombre del curso","unidades":[{"numero":1,"nombre":"Nombre de la unidad","temas":["Tema 1","Tema 2"]}],"evaluaciones":[{"nombre":"Nombre","tipo":"Grupal","semana":null,"descripcion":"Breve descripción"}]}`,
};

function validarRespuesta(tipo, data) {
  if (tipo === "matricula") {
    return Array.isArray(data.cursos) && data.cursos.every((c) => typeof c.nombre === "string");
  }
  return (
    typeof data.curso === "string" &&
    Array.isArray(data.unidades) &&
    Array.isArray(data.evaluaciones) &&
    data.evaluaciones.every((e) => ["Grupal", "Individual"].includes(e.tipo))
  );
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Falta configurar ANTHROPIC_API_KEY en Vercel" });
  }

  const { tipo, texto } = req.body || {};
  if (!PROMPTS[tipo] || typeof texto !== "string" || texto.trim().length < 20) {
    return res.status(400).json({ error: "Datos inválidos" });
  }

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: 3000,
        system: PROMPTS[tipo],
        messages: [{ role: "user", content: texto.slice(0, MAX_CARACTERES) }],
      }),
    });

    if (!upstream.ok) {
      console.error("Anthropic error", upstream.status, await upstream.text());
      return res.status(502).json({ error: "El servicio de IA no respondió correctamente" });
    }

    const payload = await upstream.json();
    const texto_respuesta = (payload.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim()
      .replace(/^```(?:json)?\s*|\s*```$/g, "");

    let data;
    try {
      data = JSON.parse(texto_respuesta);
    } catch {
      return res.status(502).json({ error: "La IA no devolvió un formato válido. Intenta de nuevo." });
    }
    if (!validarRespuesta(tipo, data)) {
      return res.status(502).json({ error: "La IA devolvió datos incompletos. Intenta de nuevo." });
    }
    return res.status(200).json({ data });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error interno" });
  }
};
