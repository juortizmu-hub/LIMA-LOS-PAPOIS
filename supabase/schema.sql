-- Amigo UCV: esquema de base de datos para Supabase.
-- Cómo usarlo: en el panel de Supabase abre "SQL Editor", pega este archivo completo y ejecútalo una vez.

-- ---------- Tablas ----------
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 500),
  emotion text not null,
  visibility text not null check (visibility in ('publico', 'privado')),
  identity text not null check (identity in ('anonimo', 'ficticio')),
  alias text,
  image_path text,
  reportes integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 300),
  reportes integer not null default 0,
  created_at timestamptz not null default now()
);

-- Un "me gusta" por cuenta y publicación: la clave primaria impide duplicados
create table if not exists public.likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((post_id is not null) <> (comment_id is not null))
);

-- Una cuenta solo puede reportar una vez cada publicación o comentario
create unique index if not exists reports_once_post on public.reports (user_id, post_id) where post_id is not null;
create unique index if not exists reports_once_comment on public.reports (user_id, comment_id) where comment_id is not null;

-- ---------- Reportes: suman al contador y ocultan a partir de 3 ----------
create or replace function public.sumar_reporte() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.post_id is not null then
    update public.posts set reportes = reportes + 1 where id = new.post_id;
  else
    update public.comments set reportes = reportes + 1 where id = new.comment_id;
  end if;
  return new;
end;
$$;

drop trigger if exists al_reportar on public.reports;
create trigger al_reportar after insert on public.reports
  for each row execute function public.sumar_reporte();

-- ---------- Seguridad (Row Level Security) ----------
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;
alter table public.reports enable row level security;

-- Publicaciones: públicas (si no tienen 3 reportes) o propias
drop policy if exists "ver publicaciones" on public.posts;
create policy "ver publicaciones" on public.posts for select
  using ((visibility = 'publico' and reportes < 3) or auth.uid() = user_id);

drop policy if exists "crear publicaciones" on public.posts;
create policy "crear publicaciones" on public.posts for insert
  with check (auth.uid() = user_id);

drop policy if exists "borrar mis publicaciones" on public.posts;
create policy "borrar mis publicaciones" on public.posts for delete
  using (auth.uid() = user_id);

-- Comentarios: visibles si la publicación lo es, y se ocultan con 3 reportes (el autor siempre los ve)
drop policy if exists "ver comentarios" on public.comments;
create policy "ver comentarios" on public.comments for select
  using ((reportes < 3 or auth.uid() = user_id) and exists (
    select 1 from public.posts p
    where p.id = post_id and ((p.visibility = 'publico' and p.reportes < 3) or p.user_id = auth.uid())
  ));

drop policy if exists "comentar" on public.comments;
create policy "comentar" on public.comments for insert
  with check (auth.uid() = user_id);

drop policy if exists "borrar mis comentarios" on public.comments;
create policy "borrar mis comentarios" on public.comments for delete
  using (auth.uid() = user_id);

-- Likes: cualquiera autenticado puede ver el conteo; cada uno solo gestiona los suyos
drop policy if exists "ver likes" on public.likes;
create policy "ver likes" on public.likes for select using (true);

drop policy if exists "dar like" on public.likes;
create policy "dar like" on public.likes for insert
  with check (auth.uid() = user_id);

drop policy if exists "quitar mi like" on public.likes;
create policy "quitar mi like" on public.likes for delete
  using (auth.uid() = user_id);

-- Reportes: cada cuenta solo inserta los suyos; nadie puede leer los reportes de otros
drop policy if exists "reportar" on public.reports;
create policy "reportar" on public.reports for insert
  with check (auth.uid() = user_id);

-- ---------- Imágenes de publicaciones ----------
-- Bucket público de solo lectura. Cada persona solo sube y borra dentro de su propia carpeta (su user id).
insert into storage.buckets (id, name, public)
values ('publicaciones', 'publicaciones', true)
on conflict (id) do nothing;

drop policy if exists "subir mis imagenes" on storage.objects;
create policy "subir mis imagenes" on storage.objects for insert to authenticated
  with check (bucket_id = 'publicaciones' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "borrar mis imagenes" on storage.objects;
create policy "borrar mis imagenes" on storage.objects for delete to authenticated
  using (bucket_id = 'publicaciones' and (storage.foldername(name))[1] = auth.uid()::text);
