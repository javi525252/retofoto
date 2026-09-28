// Lógica compartida para generar el reto del día.
// La usan reto-hoy.js (bajo demanda, con caché) y generar-reto.js (programada).

const CATEGORIAS = [
  "un objeto por su forma o textura (redondo, rugoso, transparente, metálico...)",
  "un color dominante en tu entorno ahora mismo",
  "una emoción representada sin caras (solo objetos o luz)",
  "algo que normalmente no miras (el suelo, un rincón, un cable)",
  "una prueba de los sentidos (algo que huele fuerte, algo ruidoso, algo suave)",
  "un contraste (viejo vs nuevo, ordenado vs caos, luz vs sombra)",
  "algo relacionado con la hora del día en que se lanza el reto",
  "un objeto que dice algo de ti sin que aparezcas tú",
  "una escena en miniatura (un detalle diminuto de algo grande)",
  "algo compartido con alguien más en ese momento (aunque no salga en la foto)",
  "un reflejo o una sombra",
  "algo que llevas encima ahora mismo",
  "una imperfección que normalmente se esconde",
  "algo que se repite (un patrón, varias copias de lo mismo)",
  "un lugar de paso (pasillo, escalera, puerta, ventana)",
  "algo que hace ruido si lo tocas",
  "el objeto más cercano a tu mano ahora mismo",
  "algo que cambiaría si giraras 90 grados la cámara",
  "una textura que te gustaría tocar",
  "algo que solo tiene sentido para ti y para nadie más",
];

const FORMATOS = [
  "una palabra suelta y evocadora, sin explicación (ej: 'Redondo')",
  "una instrucción corta en segunda persona (ej: 'Enséñanos tu suelo ahora mismo')",
  "una pregunta directa (ej: '¿Qué es lo más ruidoso que ves?')",
  "dos palabras en tensión (ej: 'Orden / Caos')",
  "una frase incompleta que la foto termina (ej: 'Lo último que toqué antes de esto: ___')",
  "una comparación (ej: 'Más viejo que tú')",
];

const TONOS = [
  "curioso e inocente, como un juego de niños",
  "un poco filosófico, invita a pararse a pensar un segundo",
  "gamberro y directo, con humor",
  "íntimo, casi confesional",
  "absurdo, con un toque surrealista",
  "nostálgico, mira hacia atrás",
  "urgente y con energía, como un desafío",
];

const RESTRICCIONES = [
  "no debe poder resolverse solo con una selfie",
  "debe poder hacerse en cualquier casa, calle u oficina sin salir corriendo a buscar algo especial",
  "no debe depender de tener mascota, pareja o hijos para funcionar",
  "debe funcionar tanto si estás en pijama en casa como si estás en la oficina",
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildSystemPrompt(prohibidos) {
  const lista = prohibidos.length ? prohibidos.join(", ") : "(ninguno todavía)";
  return `Eres el editor creativo de una app de foto-reto diario para grupos cerrados (amigos, familia, oficina). Cada día el grupo recibe UN reto. Todos tienen unos minutos para subir una foto que responda a ese reto. Solo se ven las fotos de tu propio grupo, nunca las de desconocidos, y solo después de haber subido la tuya.

Tu trabajo es inventar el reto de hoy. Debe ser:
- Corto: máximo 6-8 palabras.
- Ambiguo lo justo: cada persona lo interpreta a su manera, así las fotos del grupo son todas distintas aunque respondan a lo mismo.
- Realizable en pocos minutos, sin salir de donde estás ni comprar nada.
- Nunca genérico de Instagram (nada de "atardecer", "comida bonita", "outfit del día", "buenos días").
- Debe sonar fresco y distinto a los retos ya usados. NUNCA repitas, ni de cerca ni con sinónimos obvios, ninguno de estos: ${lista}.

Devuelve SOLO este JSON, sin texto adicional ni markdown:
{
  "texto": "el reto tal cual se muestra a los usuarios",
  "categoria_interna": "de qué trata en el fondo, en pocas palabras (uso interno, no se muestra)",
  "pista": "una frase de una línea que se muestra si alguien pulsa 'necesito una pista', da una idea sin resolver el reto del todo",
  "emoji": "un único emoji que representa el reto"
}`;
}

function buildUserPrompt() {
  const categoria = pick(CATEGORIAS);
  const formato = pick(FORMATOS);
  const tono = pick(TONOS);
  const restriccion = pick(RESTRICCIONES);
  return `Genera el reto de hoy.
Debe girar en torno a: ${categoria}.
Formato de la frase: ${formato}.
Tono: ${tono}.
Restricción: ${restriccion}.
Sé muy específico y original: evita cualquier fórmula que suene a un reto anterior típico.`;
}

function clip(s, max) {
  if (typeof s !== "string") return "";
  const t = s.trim();
  return t.length > max ? t.slice(0, max).trim() : t;
}

async function llamarIA(apiKey, model, prohibidos) {
  const body = {
    model: model || "claude-haiku-4-5-20251001",
    max_tokens: 400,
    temperature: 1,
    system: buildSystemPrompt(prohibidos),
    messages: [{ role: "user", content: buildUserPrompt() }],
  };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Anthropic API ${res.status}: ${t.slice(0, 300)}`);
  }

  const data = await res.json();
  const raw = data?.content?.[0]?.text || "";
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Respuesta sin JSON: " + raw.slice(0, 200));
  const parsed = JSON.parse(match[0]);

  return {
    texto: clip(parsed.texto, 80) || "Algo que te sorprenda de tu entorno ahora mismo",
    categoria_interna: clip(parsed.categoria_interna, 120),
    pista: clip(parsed.pista, 160),
    emoji: clip(parsed.emoji, 8) || "📸",
  };
}

// Aviso push (OneSignal) de que ya hay reto nuevo. Si no está configurado
// (faltan VITE_ONESIGNAL_APP_ID / ONESIGNAL_REST_API_KEY) simplemente no hace nada:
// la app funciona igual sin notificaciones, esto es un extra.
async function enviarPush(appId, restApiKey, reto) {
  if (!appId || !restApiKey || !reto) return;
  try {
    await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "content-type": "application/json; charset=utf-8",
        authorization: `Basic ${restApiKey}`,
      },
      body: JSON.stringify({
        app_id: appId,
        included_segments: ["Subscribed Users"],
        headings: { es: `${reto.emoji || "📸"} Ya está el reto de hoy` },
        contents: { es: reto.texto || "Entra a ver el reto de hoy." },
        url: "/",
      }),
    });
  } catch {
    // un fallo enviando el push no debe romper la generación del reto
  }
}

module.exports = { llamarIA, pick, enviarPush };
