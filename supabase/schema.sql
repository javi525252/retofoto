-- Retofoto — esquema completo para Supabase
-- Pega esto entero en el SQL Editor de tu proyecto de Supabase y dale a "Run".
-- Se puede ejecutar de una vez, de arriba a abajo.

-- ============= TABLAS =============

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  emoji_avatar text default '🙂',
  creado_en timestamptz default now()
);

create table if not exists retos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null unique,
  texto text not null,
  pista text,
  emoji text,
  categoria_interna text,
  creado_en timestamptz default now()
);

create table if not exists grupos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  codigo text not null unique,
  creado_por uuid references profiles(id),
  creado_en timestamptz default now()
);

create table if not exists miembros (
  grupo_id uuid references grupos(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  unido_en timestamptz default now(),
  primary key (grupo_id, user_id)
);

create table if not exists envios (
  id uuid primary key default gen_random_uuid(),
  reto_id uuid references retos(id) on delete cascade,
  grupo_id uuid references grupos(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  foto_path text not null,
  segundos_tardados int,
  creado_en timestamptz default now(),
  unique (reto_id, grupo_id, user_id)
);

-- ============= FUNCIONES AUXILIARES (security definer, evitan recursión en RLS) =============

create or replace function soy_miembro(g uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists(select 1 from miembros where grupo_id = g and user_id = auth.uid());
$$;

create or replace function ya_envie(r uuid, g uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists(select 1 from envios where reto_id = r and grupo_id = g and user_id = auth.uid());
$$;

-- ============= RLS =============

alter table profiles enable row level security;
alter table retos enable row level security;
alter table grupos enable row level security;
alter table miembros enable row level security;
alter table envios enable row level security;

drop policy if exists "perfiles visibles a autenticados" on profiles;
create policy "perfiles visibles a autenticados" on profiles for select using (auth.role() = 'authenticated');
drop policy if exists "crear mi perfil" on profiles;
create policy "crear mi perfil" on profiles for insert with check (id = auth.uid());
drop policy if exists "actualizar mi perfil" on profiles;
create policy "actualizar mi perfil" on profiles for update using (id = auth.uid());

-- Los retos los escribe solo la función de servidor (service role), que salta RLS.
-- Aquí solo se permite lectura.
drop policy if exists "retos visibles a autenticados" on retos;
create policy "retos visibles a autenticados" on retos for select using (auth.role() = 'authenticated');

drop policy if exists "grupos visibles a autenticados" on grupos;
create policy "grupos visibles a autenticados" on grupos for select using (auth.role() = 'authenticated');
drop policy if exists "crear grupo" on grupos;
create policy "crear grupo" on grupos for insert with check (creado_por = auth.uid());

drop policy if exists "ver miembros de mis grupos" on miembros;
create policy "ver miembros de mis grupos" on miembros for select using (soy_miembro(grupo_id));
drop policy if exists "unirme a un grupo" on miembros;
create policy "unirme a un grupo" on miembros for insert with check (user_id = auth.uid());
drop policy if exists "salir de un grupo" on miembros;
create policy "salir de un grupo" on miembros for delete using (user_id = auth.uid());

-- Solo ves los envíos de tu grupo si ya has subido el tuyo hoy (mecánica tipo BeReal).
-- Siempre ves los tuyos propios.
drop policy if exists "ver envios" on envios;
create policy "ver envios" on envios for select using (
  user_id = auth.uid()
  or (soy_miembro(grupo_id) and ya_envie(reto_id, grupo_id))
);
drop policy if exists "subir mi envio" on envios;
create policy "subir mi envio" on envios for insert with check (
  user_id = auth.uid() and soy_miembro(grupo_id)
);

-- ============= STORAGE (bucket "fotos") =============
-- Crea el bucket "fotos" desde el panel de Supabase (Storage → New bucket → nombre "fotos",
-- privado, NO marcar "Public bucket") antes de ejecutar esto.
-- Convención de ruta: {grupo_id}/{reto_id}/{user_id}/foto.jpg

drop policy if exists "ver fotos si soy miembro y ya envié" on storage.objects;
create policy "ver fotos si soy miembro y ya envié"
on storage.objects for select
using (
  bucket_id = 'fotos'
  and (
    (storage.foldername(name))[3] = auth.uid()::text
    or (
      soy_miembro(((storage.foldername(name))[1])::uuid)
      and ya_envie(((storage.foldername(name))[2])::uuid, ((storage.foldername(name))[1])::uuid)
    )
  )
);

drop policy if exists "subir mi foto" on storage.objects;
create policy "subir mi foto"
on storage.objects for insert
with check (
  bucket_id = 'fotos'
  and (storage.foldername(name))[3] = auth.uid()::text
);

-- ============= FIN =============
-- Después de ejecutar esto:
-- 1. Ve a Storage y crea el bucket "fotos" (privado) si no lo has hecho ya.
-- 2. Ve a Authentication → Providers → Email y asegúrate de que "Email" está activado
--    (con "Confirm email" desactivado es más cómodo para probar entre amigos, es opcional).
