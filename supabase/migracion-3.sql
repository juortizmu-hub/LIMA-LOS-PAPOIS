-- Amigo UCV: migración 3 (universidad y carrera en el perfil).
-- Ejecútala en el SQL Editor de Supabase DESPUÉS de schema.sql y migracion-2.sql.

alter table public.profiles add column if not exists universidad text not null default ''
  check (char_length(universidad) <= 80);
alter table public.profiles add column if not exists carrera text not null default ''
  check (char_length(carrera) <= 80);
