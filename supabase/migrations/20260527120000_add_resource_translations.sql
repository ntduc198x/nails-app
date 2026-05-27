alter table public.resources
  add column if not exists translations jsonb;

comment on column public.resources.translations is
  'Localized resource fields keyed by locale, for example {"en":{"name":"Chair A"}}';
