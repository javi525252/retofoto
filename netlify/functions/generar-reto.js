// Función programada: genera el reto del día por adelantado (por defecto a las
// 08:00 hora de España). Es un respaldo/adelanto — reto-hoy.js genera igualmente
// el reto al vuelo si por lo que sea esta no ha corrido, así que no pasa nada
// si el cron falla algún día.
//
// Cambia el horario editando el cron de abajo (formato UTC). 08:00 UTC = 10:00 en
// España en horario de verano, 09:00 en horario de invierno.

const { schedule } = require("@netlify/functions");
const { createClient } = require("@supabase/supabase-js");
const { llamarIA } = require("./_reto.js");

function hoyISO() {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" });
  return fmt.format(new Date());
}

const handler = async () => {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY || !ANTHROPIC_API_KEY) {
    return { statusCode: 500, body: "Faltan variables de entorno." };
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const fecha = hoyISO();

  const { data: existente } = await supabase.from("retos").select("id").eq("fecha", fecha).maybeSingle();
  if (existente) return { statusCode: 200, body: "Ya existía reto para hoy." };

  const { data: anteriores } = await supabase.from("retos").select("texto").order("fecha", { ascending: false }).limit(60);
  const prohibidos = (anteriores || []).map((r) => r.texto);

  const generado = await llamarIA(ANTHROPIC_API_KEY, process.env.ANTHROPIC_MODEL, prohibidos);
  await supabase.from("retos").insert({ fecha, ...generado });

  return { statusCode: 200, body: "Reto generado." };
};

exports.handler = schedule("0 8 * * *", handler);
