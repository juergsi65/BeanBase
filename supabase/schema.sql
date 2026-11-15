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
