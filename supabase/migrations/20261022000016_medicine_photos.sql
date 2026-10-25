-- Product photos use the same staff-only access boundary as inventory.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('medicine-photos', 'medicine-photos', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table public.medicine_photos (
  medicine_id uuid primary key references public.medicines(id) on delete cascade,
  storage_path text not null unique,
  updated_at timestamptz not null default now()
);

alter table public.medicine_photos enable row level security;
-- No browser policies: Express checks requireStaff and uses service_role.
