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
const MAX_PETICIONES_VENTANA = 20;
const VENTANA_MS = 60 * 1000;
const ultimasPeticiones = new Map();
const MAX_CHARS = 1000;

// Traduce el código de error del proveedor en un mensaje útil (no un texto genérico)
function mensajePorError(status, cuerpo) {
  if (status === 401 || status === 403) {
    return { estado: 502, mensaje: "La clave ANTHROPIC_API_KEY no es válida o no tiene permisos. Revísala en Vercel." };
  }
  if (status === 402) {
    return { estado: 502, mensaje: "Se agotó el saldo de la cuenta de IA. Revisa la facturación en Anthropic." };
  }
  if (status === 429) {
    return { estado: 429, mensaje: "La IA está recibiendo demasiadas solicitudes o se alcanzó el límite de uso. Intenta en unos minutos." };
  }
  if (status === 404 || (status === 400 && /model/i.test(cuerpo))) {
    return { estado: 502, mensaje: "El modelo configurado en ANTHROPIC_MODEL no existe o no está disponible." };
  }
  if (status === 400) {
    return { estado: 502, mensaje: "El proveedor de IA rechazó la solicitud. Revisa los logs de Vercel." };
  }
  if (status >= 500) {
    return { estado: 502, mensaje: "El servicio de IA está saturado o con fallas. Intenta de nuevo en unos minutos." };
  }
  return { estado: 502, mensaje: "El servicio de IA no respondió correctamente." };
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

  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || "desconocida";
  const ahora = Date.now();
  const historial = (ultimasPeticiones.get(ip) || []).filter((t) => ahora - t < VENTANA_MS);
  if (historial.length >= MAX_PETICIONES_VENTANA) {
    return res.status(429).json({ error: "Has enviado muchos mensajes seguidos. Espera un minuto e intenta de nuevo." });
  }
  ultimasPeticiones.set(ip, [...historial, ahora]);

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
      signal: AbortSignal.timeout(25000),
    });

    if (!upstream.ok) {
      const cuerpo = await upstream.text();
      console.error("Anthropic error", upstream.status, cuerpo);
      const { mensaje, estado } = mensajePorError(upstream.status, cuerpo);
      return res.status(estado).json({ error: mensaje });
    }

    const data = await upstream.json();
    const reply = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    if (!reply) {
      return res.status(502).json({ error: "La IA respondió vacío. Intenta con otra frase." });
    }
    return res.status(200).json({ reply });
  } catch (err) {
    console.error("Error al llamar a la IA", err);
    if (err?.name === "TimeoutError" || err?.name === "AbortError") {
      return res.status(504).json({ error: "La IA tardó demasiado en responder. Intenta de nuevo." });
    }
    return res.status(500).json({ error: "Error interno del servidor al contactar la IA." });
  }
};
