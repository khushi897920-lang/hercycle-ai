create table if not exists public.weight_entries (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,
  recorded_date date not null,
  weight_kg numeric(5, 2) not null
    check (weight_kg >= 20 and weight_kg <= 350),
  waist_cm numeric(5, 2)
    check (
      waist_cm is null
      or (waist_cm >= 30 and waist_cm <= 250)
    ),
  height_cm numeric(5, 2) not null
    check (height_cm >= 100 and height_cm <= 250),
  bmi numeric(5, 2) not null
    check (bmi >= 5 and bmi <= 100),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  constraint weight_entries_user_date_unique
    unique (user_id, recorded_date)
);

create index if not exists weight_entries_user_date_idx
  on public.weight_entries (user_id, recorded_date desc);

alter table public.weight_entries enable row level security;