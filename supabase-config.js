// Configuración de Supabase para Amigo UCV.
// 1. Crea un proyecto en https://supabase.com
// 2. En "Project Settings > API" copia la URL y la clave "anon public" y pégalas abajo.
// 3. Ejecuta supabase/schema.sql en el SQL Editor.
// La clave "anon" es pública por diseño: la seguridad la dan las reglas RLS del esquema.
window.AMIGO_SUPABASE = {
  url: "https://TU-PROYECTO.supabase.co",
  anonKey: "TU_CLAVE_ANON_PUBLICA",
};
