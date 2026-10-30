-- Run in Supabase SQL Editor.
-- This schema gives each authenticated user their own songs and playlists.

create table if not exists public.songs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  artist text not null default 'Unknown artist',
  storage_path text not null unique,
  file_size bigint not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now()
);

create table if not exists public.playlist_songs (
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (playlist_id, song_id)
);

alter table public.songs enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_songs enable row level security;

drop policy if exists "Users manage their own songs" on public.songs;
create policy "Users manage their own songs"
on public.songs for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Users manage their own playlists" on public.playlists;
create policy "Users manage their own playlists"
on public.playlists for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Users manage playlist songs in their own playlists and songs" on public.playlist_songs;
create policy "Users manage playlist songs in their own playlists and songs"
on public.playlist_songs for all to authenticated
using (
  exists (
    select 1 from public.playlists p
    where p.id = playlist_id and p.user_id = (select auth.uid())
  )
  and exists (
    select 1 from public.songs s
    where s.id = song_id and s.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.playlists p
    where p.id = playlist_id and p.user_id = (select auth.uid())
  )
  and exists (
    select 1 from public.songs s
    where s.id = song_id and s.user_id = (select auth.uid())
  )
);

create index if not exists songs_user_id_created_at_idx
on public.songs (user_id, created_at desc);
create index if not exists playlists_user_id_created_at_idx
on public.playlists (user_id, created_at desc);
