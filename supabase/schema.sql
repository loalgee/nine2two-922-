-- nine2two (922) — Supabase schema, MVP v1.0
-- Paste this whole file into the Supabase SQL Editor and click Run.
-- Safe to re-run: it drops and recreates everything it owns.

-- ---------- Cleanup (idempotent re-runs) ----------
drop view if exists public.restrooms_with_stats;
drop trigger if exists trg_verify_on_review on public.reviews;
drop function if exists public.verify_on_review();
drop function if exists public.is_admin();
drop table if exists public.reports;
drop table if exists public.reviews;
drop table if exists public.restrooms;
drop table if exists public.admins;

-- ---------- Tables (PRD §5) ----------
create table public.restrooms (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 60),
  lat        double precision not null check (lat between -90 and 90),
  lng        double precision not null check (lng between -180 and 180),
  tags       text[] not null default '{}',
  verified   boolean not null default false,
  source     text not null default 'user' check (source in ('user','osm','refuge')),
  created_at timestamptz not null default now()
);

create table public.reviews (
  id          uuid primary key default gen_random_uuid(),
  restroom_id uuid not null references public.restrooms(id) on delete cascade,
  stars       int not null check (stars between 1 and 5),
  note        text not null default '' check (char_length(note) <= 200),
  created_at  timestamptz not null default now()
);

create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  restroom_id uuid not null references public.restrooms(id) on delete cascade,
  reason      text not null check (reason in ('Doesn''t exist','Closed permanently','Inappropriate content')),
  created_at  timestamptz not null default now(),
  resolved    boolean not null default false
);

-- Owner/moderator allowlist. Add yourself after your first admin sign-in
-- (see SETUP.md step 6).
create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create index reviews_restroom_idx on public.reviews (restroom_id, created_at desc);
create index reports_open_idx on public.reports (resolved, created_at);

-- ---------- Helper ----------
create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.admins where user_id = auth.uid()) $$;

-- ---------- Row Level Security ----------
alter table public.restrooms enable row level security;
alter table public.reviews  enable row level security;
alter table public.reports  enable row level security;
alter table public.admins   enable row level security;

-- Restrooms: anyone can read; anonymous users can add verified 'user'
-- listings (PRD §4.5); only admins can import unverified seed data or
-- edit/delete listings (PRD §4.7).
create policy "restrooms are public"      on public.restrooms for select using (true);
create policy "anyone adds user listing"  on public.restrooms for insert
  with check ((source = 'user' and verified = true)
              or (public.is_admin() and source in ('osm','refuge') and verified = false));
create policy "admin edits listings"      on public.restrooms for update
  using (public.is_admin()) with check (public.is_admin());
create policy "admin deletes listings"    on public.restrooms for delete using (public.is_admin());

-- Reviews: public read, anonymous write (PRD §4.6 — no sign-in to rate).
create policy "reviews are public"  on public.reviews for select using (true);
create policy "anyone adds review"  on public.reviews for insert with check (true);
create policy "admin deletes review" on public.reviews for delete using (public.is_admin());

-- Reports: anyone can file one; only admins see or resolve them.
create policy "anyone files report"  on public.reports for insert with check (true);
create policy "admin reads reports"  on public.reports for select using (public.is_admin());
create policy "admin updates reports" on public.reports for update
  using (public.is_admin()) with check (public.is_admin());
create policy "admin deletes reports" on public.reports for delete using (public.is_admin());

-- Admins: you can only see whether *you* are an admin.
create policy "read own admin row" on public.admins for select using (user_id = auth.uid());

-- ---------- Verified flip (PRD §4.5) ----------
-- A community rating on an imported listing verifies it. SECURITY DEFINER
-- lets the trigger update the restroom even though anonymous users can't.
create function public.verify_on_review() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.restrooms set verified = true
    where id = new.restroom_id and verified = false;
  return new;
end $$;

create trigger trg_verify_on_review
  after insert on public.reviews
  for each row execute function public.verify_on_review();

-- ---------- Derived stats (PRD §5 — never stored) ----------
create view public.restrooms_with_stats
with (security_invoker = true) as
select r.*,
       coalesce(s.avg_stars, 0)    as avg_stars,
       coalesce(s.rating_count, 0) as rating_count,
       s.last_rated_at
from public.restrooms r
left join (
  select restroom_id,
         avg(stars)::double precision as avg_stars,
         count(*)::int                as rating_count,
         max(created_at)              as last_rated_at
  from public.reviews
  group by restroom_id
) s on s.restroom_id = r.id;
