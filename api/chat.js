// Función serverless de Vercel: reenvía la conversación a la API de Anthropic.
// La clave se lee de la variable de entorno ANTHROPIC_API_KEY (nunca en el código).

const SYSTEM_PROMPT = `Eres un acompañante de apoyo emocional para estudiantes de la Universidad César Vallejo.
- Escucha con empatía, responde en español y de forma breve.
- No diagnosticas ni recetas tratamientos.
- Si la persona menciona riesgo de hacerse daño o de quitarse la vida, indícale que llame al 911 de inmediato y que busque a alguien de confianza.
- Anímala a buscar apoyo profesional cuando sea apropiado.`;

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
