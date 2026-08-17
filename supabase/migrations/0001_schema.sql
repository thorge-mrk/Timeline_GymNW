create table public.entries (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  description text check (char_length(description) <= 3000),
  category text not null check (category in ('schule','schueler','lehrer','ehemalige','sonstiges')),
  class_name text check (char_length(class_name) <= 30),
  author_name text check (char_length(author_name) <= 80),
  year int not null check (year between 1900 and 2100),
  month int check (month between 1 and 12),
  day int check (day between 1 and 31),
  check (day is null or month is not null),
  sort_date date generated always as (make_date(year, coalesce(month,1), coalesce(day,1))) stored,
  is_milestone boolean not null default false,
  image_path text,
  audio_path text,
  video_url text check (video_url is null or video_url ~* '^https://'),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index entries_sort_date_idx on public.entries (sort_date);
create index entries_category_idx on public.entries (category);

create schema if not exists private;

create or replace function private.set_updated_at() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;
create trigger entries_set_updated_at before update on public.entries
  for each row execute function private.set_updated_at();

alter table public.entries enable row level security;
