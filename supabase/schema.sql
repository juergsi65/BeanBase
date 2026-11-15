-- BeanBase – Datenbankschema für Supabase (Postgres)
-- Im Supabase-Dashboard unter "SQL Editor" einfügen und ausführen.

create extension if not exists "pgcrypto";

-- Maschinen & Brühmethoden -------------------------------------------------
create table if not exists public.machines (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  name        text not null,
  type        text not null default 'espresso'
              check (type in ('espresso','pour_over','aeropress','french_press','moka','cold_brew','other')),
  preset_id   text,                    -- z. B. 'gaggia-classic-pro' (src/data/presets.js)
  notes       text,
  created_at  timestamptz not null default now()
);

-- Mühlen ---------------------------------------------------------------------
create table if not exists public.grinders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  name        text not null,
  scale_type  text not null default 'numbers'
              check (scale_type in ('stepless','clicks','numbers')),
  preset_id   text,                    -- z. B. 'niche-zero' → macht Mahlgrade nutzerübergreifend vergleichbar
  notes       text,
  created_at  timestamptz not null default now()
);

-- Bohnen ---------------------------------------------------------------------
create table if not exists public.beans (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  name          text not null,
  roaster       text,
  origin        text,
  variety       text,
  process       text check (process in ('washed','natural','honey','anaerobic','other')),
  roast_level   text check (roast_level in ('light','medium','dark')),
  roast_date    date,
  flavor_notes  text[] not null default '{}',
  image_url     text,                    -- Foto der Tüte (Storage-Bucket bean-images)
  barcode       text,                    -- EAN/UPC der Tüte (nur Ziffern)
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- Brew-Log -------------------------------------------------------------------
create table if not exists public.brews (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  bean_id       uuid references public.beans on delete set null,
  machine_id    uuid references public.machines on delete set null,
  grinder_id    uuid references public.grinders on delete set null,
  dose          numeric(5,1),            -- g Kaffeemehl
  yield         numeric(6,1),            -- g Getränk
  grind_setting text,                    -- Zahl / Klicks / frei
  temperature   numeric(4,1),            -- °C
  brew_time     integer,                 -- s
  preinfusion   integer,                 -- s
  rating        smallint check (rating between 1 and 5),
  extraction    smallint check (extraction between -5 and 5), -- -5 sauer · 0 perfekt · +5 bitter
  notes         text,
  created_at    timestamptz not null default now()
);

-- Migration für bestehende Installationen (idempotent) ------------------------
alter table public.machines add column if not exists preset_id text;
alter table public.grinders add column if not exists preset_id text;
alter table public.beans    add column if not exists image_url text;
alter table public.beans    add column if not exists barcode text;

create index if not exists brews_user_bean_idx on public.brews (user_id, bean_id, created_at desc);

-- Row Level Security: jeder Nutzer sieht nur seine eigenen Daten -------------
do $$
declare t text;
begin
  foreach t in array array['machines','grinders','beans','brews'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;

-- Storage: Bohnen-Fotos -------------------------------------------------------
-- Öffentlich lesbar (nur wer die zufällige URL kennt), schreiben/löschen nur im
-- eigenen Ordner <user_id>/...
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bean-images', 'bean-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "bean-images insert own" on storage.objects;
drop policy if exists "bean-images update own" on storage.objects;
drop policy if exists "bean-images delete own" on storage.objects;
create policy "bean-images insert own" on storage.objects for insert to authenticated
  with check (bucket_id = 'bean-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "bean-images update own" on storage.objects for update to authenticated
  using (bucket_id = 'bean-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "bean-images delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'bean-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- Community-Abgleich ----------------------------------------------------------
-- Normalisiert Namen für den Abgleich: "Bonanza Coffee " ≙ "bonanzacoffee"
create or replace function public.normalize_key(t text)
returns text language sql immutable
set search_path = ''
as $$
  select regexp_replace(lower(coalesce(t, '')), '[^a-z0-9äöüß]+', '', 'g')
$$;

create index if not exists beans_match_idx on public.beans (public.normalize_key(roaster), public.normalize_key(name));

-- Liefert anonymisierte Durchschnittswerte gut bewerteter Bezüge (≥ 4 Sterne)
-- ANDERER Nutzer für dieselbe Bohne (Rösterei + Name), plus die Werte des
-- bestbewerteten Bezugs (ohne Nutzerbezug).
--   scope 'all'     : über alle Mühlen (ohne Mahlgrad – nicht vergleichbar)
--   scope 'grinder' : nur Bezüge mit derselben Mühle (preset_id) inkl. Mahlgrad
--   scope 'setup'   : dieselbe Mühle UND dasselbe Maschinen-Modell
-- Optional nur Bezüge mit derselben Brühmethode (machines.type).
-- Datenschutz: nur Aggregate bzw. Messwerte, erst ab min_users verschiedenen
-- Nutzern pro Scope (k-Anonymität). Keine IDs, keine Notizen, keine Zeitstempel.
drop function if exists public.get_community_recipes(text, text, text);
drop function if exists public.get_community_recipes(text, text, text, text);
drop function if exists public.get_community_recipes(text, text, text, text, text);
-- Hinweis: Der Supabase-Linter warnt, dass diese SECURITY-DEFINER-Funktion für
-- eingeloggte Nutzer aufrufbar ist. Das ist gewollt: Nur so können Aggregate über
-- fremde Bezüge gebildet werden (RLS würde sie sonst ausblenden). Die Funktion
-- gibt ausschließlich Durchschnitts-/Messwerte ab 2 Nutzern zurück.
create or replace function public.get_community_recipes(
  p_roaster text,
  p_name text,
  p_grinder_preset text default null,
  p_machine_type text default null,   -- z. B. 'espresso' – Espresso & V60 nicht vermischen
  p_machine_preset text default null  -- z. B. 'lelit-bianca'
)
returns table (
  scope        text,
  user_count   int,
  brew_count   int,
  avg_rating   numeric,
  avg_dose     numeric,
  avg_yield    numeric,
  avg_time     numeric,
  avg_temp     numeric,
  avg_grind    numeric,
  min_grind    numeric,
  max_grind    numeric,
  best_rating  smallint,
  best_dose    numeric,
  best_yield   numeric,
  best_time    integer,
  best_temp    numeric,
  best_grind   numeric
)
language sql stable security definer
set search_path = public
as $$
  with params as (
    select 2 as min_users,
           public.normalize_key(p_roaster) as r,
           public.normalize_key(p_name) as n
  ),
  pool as (
    select b.user_id, b.rating, b.extraction, b.created_at, b.dose, b.yield, b.brew_time, b.temperature,
           g.preset_id as grinder_preset, m.preset_id as machine_preset,
           case when b.grind_setting ~ '^\s*-?\d+([.,]\d+)?\s*$'
                then replace(trim(b.grind_setting), ',', '.')::numeric end as grind
    from public.brews b
    join public.beans bn on bn.id = b.bean_id
    left join public.grinders g on g.id = b.grinder_id
    left join public.machines m on m.id = b.machine_id
    cross join params p
    where auth.uid() is not null
      and b.user_id <> auth.uid()
      and b.rating >= 4
      and (p_machine_type is null or m.type = p_machine_type)
      and length(p.r) > 0 and length(p.n) >= 3
      and public.normalize_key(bn.roaster) = p.r
      and public.normalize_key(bn.name) = p.n
  ),
  scoped as (
    select 'all'::text as scope, pool.* from pool
    union all
    select 'grinder', pool.* from pool
      where p_grinder_preset is not null and grinder_preset = p_grinder_preset
    union all
    select 'setup', pool.* from pool
      where p_grinder_preset is not null and p_machine_preset is not null
        and grinder_preset = p_grinder_preset and machine_preset = p_machine_preset
  ),
  agg as (
    select scope, count(distinct user_id)::int as user_count, count(*)::int as brew_count,
           round(avg(rating), 1) as avg_rating, round(avg(dose), 1) as avg_dose, round(avg(yield), 1) as avg_yield,
           round(avg(brew_time)) as avg_time, round(avg(temperature), 1) as avg_temp,
           round(avg(grind), 2) as avg_grind, min(grind) as min_grind, max(grind) as max_grind
    from scoped group by scope
  ),
  best as (
    select distinct on (scope) scope, rating, dose, yield, brew_time, temperature, grind
    from scoped
    order by scope, rating desc, abs(coalesce(extraction, 0)), created_at desc
  )
  select a.scope, a.user_count, a.brew_count, a.avg_rating, a.avg_dose, a.avg_yield, a.avg_time, a.avg_temp,
         case when a.scope = 'all' then null else a.avg_grind end,
         case when a.scope = 'all' then null else a.min_grind end,
         case when a.scope = 'all' then null else a.max_grind end,
         b.rating, b.dose, b.yield, b.brew_time, b.temperature,
         case when a.scope = 'all' then null else b.grind end
  from agg a
  join best b using (scope)
  cross join params
  where a.user_count >= params.min_users
$$;

revoke all on function public.get_community_recipes(text, text, text, text, text) from public, anon;
grant execute on function public.get_community_recipes(text, text, text, text, text) to authenticated;

-- Barcode-Erkennung -----------------------------------------------------------
create index if not exists beans_barcode_idx on public.beans (barcode) where barcode is not null;

-- Liefert die Produktdaten (keine Nutzerdaten) einer Bohne anhand des Barcodes,
-- ermittelt aus den Einträgen aller Nutzer: pro Feld der häufigste Wert.
-- Rösterei/Name/Herkunft sind Produktangaben der Tüte und keine persönlichen
-- Daten; Notizen, Röstdatum, Fotos und IDs werden nicht zurückgegeben.
create or replace function public.lookup_bean_by_barcode(p_barcode text)
returns table (
  name text, roaster text, origin text, variety text, process text, roast_level text,
  flavor_notes text[], user_count int
)
language sql stable security definer
set search_path = public
as $$
  with code as (select regexp_replace(coalesce(p_barcode, ''), '\D', '', 'g') as c),
  hits as (
    select b.* from public.beans b, code
    where auth.uid() is not null and length(code.c) between 8 and 14 and b.barcode = code.c
  ),
  tags as (
    select t, count(*) as n from hits, unnest(hits.flavor_notes) as t group by t order by n desc, t limit 6
  )
  select
    mode() within group (order by trim(name)) filter (where nullif(trim(name), '') is not null),
    mode() within group (order by trim(roaster)) filter (where nullif(trim(roaster), '') is not null),
    mode() within group (order by trim(origin)) filter (where nullif(trim(origin), '') is not null),
    mode() within group (order by trim(variety)) filter (where nullif(trim(variety), '') is not null),
    mode() within group (order by process)     filter (where process is not null),
    mode() within group (order by roast_level) filter (where roast_level is not null),
    coalesce((select array_agg(t order by n desc, t) from tags), '{}'),
    count(distinct user_id)::int
  from hits
  having count(*) > 0
$$;

revoke all on function public.lookup_bean_by_barcode(text) from public, anon;
grant execute on function public.lookup_bean_by_barcode(text) to authenticated;
