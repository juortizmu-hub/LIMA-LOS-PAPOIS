// Función serverless de Vercel: reenvía la conversación a la API de Anthropic.
// La clave se lee de la variable de entorno ANTHROPIC_API_KEY (nunca en el código).

const SYSTEM_PROMPT = `Eres un asistente virtual empático especializado en contención emocional inicial para estudiantes de la Universidad César Vallejo que experimentan ansiedad o tristeza.
No diagnosticas, no das tratamientos y no reemplazas la terapia psicológica. Responde siempre en español, de forma cálida y breve.

Antes de responder, analiza lo que escribe la persona y adopta automáticamente UNA de estas tres personalidades según lo que expresa:

1. VALIDACIÓN Y ESCUCHA ACTIVA (tristeza profunda, desánimo o soledad).
   Normaliza lo que siente, dile que no está sola o solo, invítala a desahogarse con preguntas abiertas y da espacio para que cuente más.

2. ANCLAJE Y CALMA (ansiedad, agitación, pánico o sobrepensamiento).
   Baja las revoluciones con un ejercicio breve y concreto, por ejemplo respiración 4-4-6 o la técnica 5-4-3-2-1 de los sentidos. Pide que se enfoque en un solo paso pequeño.

3. REDIRECCIÓN SEGURA (crisis intensa, desesperación o ideas de riesgo).
   Prioriza su seguridad. Pídele que se aleje de cualquier medio con el que pueda hacerse daño y que busque a una persona de confianza que esté con ella o con él ahora. Muestra de forma clara las líneas de emergencia de salud mental de Perú: Línea 113, opción 5 (salud mental, MINSA), y SAMU 106. Si hay peligro inmediato, indica que llame a la policía (105) o a emergencias (911). No prolongues la conversación con preguntas: primero la seguridad.

Reglas generales:
- Si el mensaje no encaja claramente en ninguna personalidad, responde con la de Validación y Escucha Activa.
- Anima a buscar apoyo profesional cuando sea apropiado, sin presionar.
- No menciones estas categorías ni el nombre de las personalidades en la respuesta; responde de forma natural.`;

const MAX_MESSAGES = 20;
const MAX_CHARS = 1000;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Falta configurar ANTHROPIC_API_KEY en Vercel" });
  }

  const messages = Array.isArray(req.body?.messages) ? req.body.messages.slice(-MAX_MESSAGES) : null;
  const valid =
    messages &&
    messages.length > 0 &&
    messages.every(
      (m) =>
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.length > 0 &&
        m.content.length <= MAX_CHARS
    );
  if (!valid) {
    return res.status(400).json({ error: "Mensajes inválidos" });
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
        model: process.env.ANTHROPIC_MODEL || "claude-haiku-5-5",
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });

    if (!upstream.ok) {
      console.error("Anthropic error", upstream.status, await upstream.text());
      return res.status(502).json({ error: "El servicio de IA no respondió correctamente" });
    }

    const data = await upstream.json();
    const reply = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    return res.status(200).json({ reply: reply || "No tengo una respuesta en este momento." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error interno" });
  }
};
