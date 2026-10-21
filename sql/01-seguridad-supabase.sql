-- =====================================================================
-- NecoVende · Seguridad y stock en Supabase  (versión ajustada a tus políticas)
-- Cómo usarlo: Supabase > SQL Editor > pegar TODO > Run.
-- Se puede correr más de una vez sin problema.
--
-- Lo que YA tenías bien y NO se toca: comercios_* (select/insert/update/
-- delete), productos_* (select/insert/update/delete), favoritos, carritos,
-- visitas, perfiles_usuarios y todo lo de "ne_*" (envíos).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) Borrar las políticas viejas de PRODUCTOS que dejaban a cualquiera
--    crear, editar y borrar productos de cualquier comercio.
--    (Las nuevas productos_* ya existen y siguen funcionando.)
-- ---------------------------------------------------------------------
drop policy if exists "Inserción pública de productos" on public.productos;
drop policy if exists "Permitir actualizar productos"  on public.productos;
drop policy if exists "Permitir eliminar productos"    on public.productos;
drop policy if exists "Lectura pública de productos"   on public.productos;
-- (La última dejaba ver los productos de comercios inactivos; productos_select
--  ya cubre la lectura pública de los comercios activos.)


-- ---------------------------------------------------------------------
-- 2) COMERCIOS: un usuario común no puede activarse solo, cambiarse el
--    plan ni el vencimiento, inflar likes, ni superar su límite de comercios.
--    (Admin, el SQL Editor y las funciones internas quedan exentos.)
-- ---------------------------------------------------------------------
create or replace function public.comercios_proteger() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_max int; v_cant int;
begin
  -- Solo se restringe a quien llega con el rol de la app (authenticated/anon).
  -- Funciones internas y el SQL Editor corren con otro rol y pasan sin cambios.
  if current_user not in ('authenticated', 'anon') or public.es_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    select coalesce(max_comercios, 1) into v_max
      from public.perfiles_usuarios where user_id = auth.uid();
    v_max := coalesce(v_max, 1);
    select count(*) into v_cant from public.comercios where user_id = auth.uid();
    if v_cant >= v_max then
      raise exception 'Alcanzaste el límite de comercios de tu cuenta';
    end if;
    new.user_id     := auth.uid();
    new.activo      := false;   -- lo activa el admin
    new.plan_vence  := null;    -- lo fija el admin al activar
    new.likes_count := 0;
    -- new.plan queda como lo eligió: el comercio nace inactivo y el admin ve
    -- qué plan pidió antes de activarlo (así funciona tu flujo actual).
  else
    new.user_id     := old.user_id;
    new.activo      := old.activo;
    new.plan        := old.plan;
    new.plan_vence  := old.plan_vence;
    new.likes_count := old.likes_count;
  end if;
  return new;
end $$;

drop trigger if exists trg_comercios_proteger on public.comercios;
create trigger trg_comercios_proteger before insert or update on public.comercios
  for each row execute function public.comercios_proteger();


-- ---------------------------------------------------------------------
-- 3) PRODUCTOS: límite por plan y promos solo Ultra, también en el servidor.
--    Gratis: 5 productos · Pro: 10 · Ultra: sin límite.
-- ---------------------------------------------------------------------
create or replace function public.productos_limites() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_plan text; v_vence timestamptz; v_efectivo text; v_cant int; v_limite int;
begin
  if current_user not in ('authenticated', 'anon') or public.es_admin() then
    return new;
  end if;

  select plan, plan_vence into v_plan, v_vence from public.comercios where id = new.comercio_id;
  v_plan := coalesce(v_plan, 'gratis');
  v_efectivo := case when v_plan <> 'gratis' and v_vence is not null and v_vence < now()
                     then 'gratis' else v_plan end;

  if coalesce(new.es_combo, false) then
    if v_efectivo <> 'ultra' then
      raise exception 'Las promociones son exclusivas del plan Ultra';
    end if;
    return new;
  end if;

  v_limite := case v_efectivo when 'gratis' then 5 when 'pro' then 10 else null end;
  if v_limite is not null then
    select count(*) into v_cant from public.productos
      where comercio_id = new.comercio_id and coalesce(es_combo, false) = false;
    if v_cant >= v_limite then
      raise exception 'Alcanzaste el límite de % productos de tu plan', v_limite;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_productos_limites on public.productos;
create trigger trg_productos_limites before insert on public.productos
  for each row execute function public.productos_limites();


-- ---------------------------------------------------------------------
-- 4) STOCK: verificar y descontar todo el carrito en una sola operación
--    (con bloqueo de filas: dos clientes no pueden comprar la última unidad
--    a la vez). Todo o nada.
-- ---------------------------------------------------------------------
create or replace function public.reservar_stock_carrito(p_items jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare it jsonb; r record; falt jsonb := '[]'::jsonb; need int;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 100 then
    return jsonb_build_object('ok', false, 'error', 'items');
  end if;

  for it in select value from jsonb_array_elements(p_items) loop
    need := coalesce((it ->> 'cant')::int, 0);
    if need < 1 or need > 1000 then
      return jsonb_build_object('ok', false, 'error', 'cantidad');
    end if;
    select p.id, p.titulo, p.stock, p.disponible into r
      from public.productos p where p.id::text = it ->> 'id' for update;
    if not found then
      falt := falt || jsonb_build_array(jsonb_build_object('id', it ->> 'id', 'titulo', 'Producto', 'stock', 0));
    elsif r.disponible is false or (r.stock is not null and r.stock < need) then
      falt := falt || jsonb_build_array(jsonb_build_object(
        'id', r.id, 'titulo', r.titulo, 'stock', case when r.disponible is false then 0 else coalesce(r.stock, 0) end));
    end if;
  end loop;

  if jsonb_array_length(falt) > 0 then
    return jsonb_build_object('ok', false, 'faltantes', falt);
  end if;

  for it in select value from jsonb_array_elements(p_items) loop
    update public.productos set stock = stock - (it ->> 'cant')::int
      where id::text = it ->> 'id' and stock is not null;
  end loop;
  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.reservar_stock_carrito(jsonb) to anon, authenticated;

-- Las funciones que ya usabas pasan a "security definer" para seguir
-- funcionando ahora que los productos y comercios ya no se pueden editar
-- por cualquiera (cualquier cliente puede dar like o sumar una solicitud).
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as f
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('dar_like', 'sumar_solicitud', 'descontar_stock')
  loop
    execute format('alter function %s security definer set search_path = public', r.f);
  end loop;
end $$;


-- ---------------------------------------------------------------------
-- 5) IMÁGENES (bucket "imagenes"): subir solo con sesión iniciada.
--    La lectura pública que ya tenías ("Permitir lectura pública de
--    imágenes") se mantiene.
-- ---------------------------------------------------------------------
drop policy if exists "Permitir subida pública de imágenes" on storage.objects;
drop policy if exists imagenes_subir_autenticados on storage.objects;
create policy imagenes_subir_autenticados on storage.objects for insert to authenticated
  with check (bucket_id = 'imagenes');
-- Recomendado además: Storage > bucket "imagenes" > Edit: límite de tamaño
-- (ej. 2 MB) y tipos permitidos (image/webp, image/jpeg, image/png).


-- =====================================================================
-- Si algo sale mal y necesitás volver atrás rápido:
--   drop trigger if exists trg_comercios_proteger on public.comercios;
--   drop trigger if exists trg_productos_limites  on public.productos;
--   create policy "Permitir subida pública de imágenes" on storage.objects
--     for insert with check (bucket_id = 'imagenes');
--
-- NO tocadas pero a revisar más adelante (son de otras partes, no de NecoVende):
--   chat_mensajes      -> insert y select con "true" (cualquiera lee/escribe chats)
--   push_subscriptions -> "ALL true" (cualquiera ve/borra suscripciones push)
-- =====================================================================
