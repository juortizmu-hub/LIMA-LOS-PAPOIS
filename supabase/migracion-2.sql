-- Amigo UCV: migración 2 (perfiles, edición de publicaciones, administración y reportes de usuarios).
-- Ejecútala una vez en el SQL Editor de Supabase, DESPUÉS de haber ejecutado schema.sql.

-- ---------- Publicaciones: fecha de edición y autor con nombre de perfil ----------
alter table public.posts add column if not exists updated_at timestamptz;

alter table public.posts drop constraint if exists posts_identity_check;
alter table public.posts add constraint posts_identity_check
  check (identity in ('anonimo', 'ficticio', 'perfil'));

drop policy if exists "editar mis publicaciones" on public.posts;
create policy "editar mis publicaciones" on public.posts for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- Perfiles ----------
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null default 'Estudiante' check (char_length(nombre) between 1 and 40),
  bio text not null default '' check (char_length(bio) <= 300),
  avatar_path text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "ver perfiles" on public.profiles;
create policy "ver perfiles" on public.profiles for select using (true);

drop policy if exists "crear mi perfil" on public.profiles;
create policy "crear mi perfil" on public.profiles for insert with check (auth.uid() = user_id);

drop policy if exists "editar mi perfil" on public.profiles;
create policy "editar mi perfil" on public.profiles for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Foto de perfil: bucket público de solo lectura; cada persona sube solo a su carpeta
insert into storage.buckets (id, name, public)
values ('avatares', 'avatares', true)
on conflict (id) do nothing;

drop policy if exists "subir mi avatar" on storage.objects;
create policy "subir mi avatar" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "cambiar mi avatar" on storage.objects;
create policy "cambiar mi avatar" on storage.objects for update to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "borrar mi avatar" on storage.objects;
create policy "borrar mi avatar" on storage.objects for delete to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- Administración ----------
-- Para dar permisos de administración, inserta manualmente el user_id de la cuenta en esta tabla.
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.admins enable row level security;
-- Sin políticas: nadie puede leer la tabla desde la API; solo se consulta con es_admin().

create or replace function public.es_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

drop policy if exists "admin borra publicaciones" on public.posts;
create policy "admin borra publicaciones" on public.posts for delete using (public.es_admin());

drop policy if exists "admin borra comentarios" on public.comments;
create policy "admin borra comentarios" on public.comments for delete using (public.es_admin());

drop policy if exists "admin ve reportes" on public.reports;
create policy "admin ve reportes" on public.reports for select using (public.es_admin());

-- ---------- Reportes de usuarios ----------
alter table public.reports add column if not exists reported_user uuid references auth.users(id) on delete cascade;

alter table public.reports drop constraint if exists reports_check;
alter table public.reports add constraint reports_check check (
  (post_id is not null)::int + (comment_id is not null)::int + (reported_user is not null)::int = 1
);

create unique index if not exists reports_once_user on public.reports (user_id, reported_user)
  where reported_user is not null;
