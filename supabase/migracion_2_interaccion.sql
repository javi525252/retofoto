-- Retofoto — migración 2: reacciones, comentarios y lo necesario para racha/clasificación
-- Pega esto entero en el SQL Editor de tu proyecto de Supabase (el mismo proyecto de siempre)
-- y dale a "Run". No toca nada de lo que ya tienes, solo añade cosas nuevas.

-- ============= TABLAS NUEVAS =============

create table if not exists reacciones (
  id uuid primary key default gen_random_uuid(),
  envio_id uuid not null references envios(id) on delete cascade,
  grupo_id uuid not null references grupos(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  emoji text not null,
  creado_en timestamptz not null default now(),
  unique (envio_id, user_id)
);

create table if not exists comentarios (
  id uuid primary key default gen_random_uuid(),
  envio_id uuid not null references envios(id) on delete cascade,
  grupo_id uuid not null references grupos(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  texto text not null check (char_length(texto) <= 200),
  creado_en timestamptz not null default now()
);

-- ============= RLS =============
-- Mismo criterio que las fotos: solo se ven/crean reacciones y comentarios de un envío
-- si eres miembro del grupo y ya has subido tu foto de hoy (o si el envío es tuyo).

alter table reacciones enable row level security;
alter table comentarios enable row level security;

drop policy if exists "ver reacciones" on reacciones;
create policy "ver reacciones" on reacciones for select using (
  exists (
    select 1 from envios e
    where e.id = reacciones.envio_id
      and (e.user_id = auth.uid() or (soy_miembro(e.grupo_id) and ya_envie(e.reto_id, e.grupo_id)))
  )
);

drop policy if exists "reaccionar" on reacciones;
create policy "reaccionar" on reacciones for insert with check (
  user_id = auth.uid()
  and exists (
    select 1 from envios e
    where e.id = reacciones.envio_id
      and soy_miembro(e.grupo_id) and ya_envie(e.reto_id, e.grupo_id)
  )
);

drop policy if exists "cambiar mi reaccion" on reacciones;
create policy "cambiar mi reaccion" on reacciones for update using (user_id = auth.uid());

drop policy if exists "quitar mi reaccion" on reacciones;
create policy "quitar mi reaccion" on reacciones for delete using (user_id = auth.uid());

drop policy if exists "ver comentarios" on comentarios;
create policy "ver comentarios" on comentarios for select using (
  exists (
    select 1 from envios e
    where e.id = comentarios.envio_id
      and (e.user_id = auth.uid() or (soy_miembro(e.grupo_id) and ya_envie(e.reto_id, e.grupo_id)))
  )
);

drop policy if exists "comentar" on comentarios;
create policy "comentar" on comentarios for insert with check (
  user_id = auth.uid()
  and exists (
    select 1 from envios e
    where e.id = comentarios.envio_id
      and soy_miembro(e.grupo_id) and ya_envie(e.reto_id, e.grupo_id)
  )
);

drop policy if exists "borrar mi comentario" on comentarios;
create policy "borrar mi comentario" on comentarios for delete using (user_id = auth.uid());

-- ============= FIN =============
-- La racha y la clasificación semanal se calculan en la propia app a partir de la tabla
-- "envios" que ya existía, así que no hace falta ninguna tabla nueva para eso.
