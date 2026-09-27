import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Se avisa en consola y en pantalla (ver App.jsx) en vez de romper el build.
  console.warn("Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.");
}

export const supabase = createClient(url || "https://placeholder.supabase.co", anonKey || "placeholder");
export const supabaseConfigurado = Boolean(url && anonKey);
