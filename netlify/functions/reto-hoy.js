// GET /api/reto-hoy
// Devuelve el reto de hoy. Si no existe todavía (p. ej. la función programada
// no ha corrido aún, o es la primera vez que alguien abre la app hoy), lo genera
// en el momento y lo guarda, así siempre hay un reto disponible sin depender
// de que el cron sea perfecto.

const { createClient } = require("@supabase/supabase-js");
const { llamarIA } = require("./_reto.js");

function hoyISO() {
  // Fecha "de hoy" en referencia a España (Europe/Madrid), no en UTC del servidor,
  // para que el reto cambie cuando toca en la zona horaria de los usuarios.
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" });
  return fmt.format(new Date()); // YYYY-MM-DD
}

exports.handler = async () => {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return { statusCode: 500, body: JSON.stringify({ error: "Faltan variables de entorno de Supabase." }) };
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const fecha = hoyISO();

    const { data: existente, error: errSelect } = await supabase
      .from("retos")
      .select("*")
      .eq("fecha", fecha)
      .maybeSingle();

    if (errSelect) throw errSelect;
    if (existente) {
      return { statusCode: 200, headers: { "content-type": "application/json" }, body: JSON.stringify(existente) };
    }

    if (!ANTHROPIC_API_KEY) {
      return { statusCode: 500, body: JSON.stringify({ error: "Falta ANTHROPIC_API_KEY." }) };
    }

    // Últimos retos para no repetir texto ni de cerca.
    const { data: anteriores } = await supabase
      .from("retos")
      .select("texto")
      .order("fecha", { ascending: false })
      .limit(60);
    const prohibidos = (anteriores || []).map((r) => r.texto);

    let generado;
    try {
      generado = await llamarIA(ANTHROPIC_API_KEY, process.env.ANTHROPIC_MODEL, prohibidos);
    } catch {
      // reintento único
      generado = await llamarIA(ANTHROPIC_API_KEY, process.env.ANTHROPIC_MODEL, prohibidos);
    }

    const { data: insertado, error: errInsert } = await supabase
      .from("retos")
      .insert({ fecha, ...generado })
      .select()
      .single();

    // Si otra petición simultánea ya lo insertó (choque de fecha única), léelo en vez de fallar.
    if (errInsert) {
      const { data: yaExiste } = await supabase.from("retos").select("*").eq("fecha", fecha).maybeSingle();
      if (yaExiste) {
        return { statusCode: 200, headers: { "content-type": "application/json" }, body: JSON.stringify(yaExiste) };
      }
      throw errInsert;
    }

    return { statusCode: 200, headers: { "content-type": "application/json" }, body: JSON.stringify(insertado) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message || "Error generando el reto." }) };
  }
};
