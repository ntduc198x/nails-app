create table if not exists public.password_reset_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  reset_token text not null,
  temporary_password_ciphertext text not null,
  expires_at timestamptz not null,
  confirmed_at timestamptz,
  used_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists idx_password_reset_requests_token
  on public.password_reset_requests (reset_token);

create index if not exists idx_password_reset_requests_user_id
  on public.password_reset_requests (user_id);

create index if not exists idx_password_reset_requests_expires_at
  on public.password_reset_requests (expires_at);

comment on table public.password_reset_requests is
  'Pending password reset requests with one-time confirmation token and encrypted temporary password.';
