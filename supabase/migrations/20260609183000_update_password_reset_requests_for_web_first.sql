alter table if exists public.password_reset_requests
  alter column temporary_password_ciphertext drop not null;

comment on table public.password_reset_requests is
  'Pending password reset requests with one-time confirmation token for web-first password updates.';
