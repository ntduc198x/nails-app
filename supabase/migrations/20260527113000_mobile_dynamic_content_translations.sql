alter table if exists public.services
  add column if not exists translations jsonb;

alter table if exists public.branches
  add column if not exists translations jsonb;

alter table if exists public.storefront_profile
  add column if not exists translations jsonb;

alter table if exists public.storefront_team_members
  add column if not exists translations jsonb;

alter table if exists public.storefront_products
  add column if not exists translations jsonb;

alter table if exists public.storefront_gallery
  add column if not exists translations jsonb;

alter table if exists public.marketing_offers
  add column if not exists translations jsonb;

alter table if exists public.customer_content_posts
  add column if not exists translations jsonb;

update public.services
set translations = jsonb_strip_nulls(
  coalesce(translations, '{}'::jsonb)
  || jsonb_build_object(
    'vi',
    jsonb_strip_nulls(
      coalesce(translations -> 'vi', '{}'::jsonb)
      || jsonb_build_object(
        'name', nullif(trim(name), ''),
        'short_description', nullif(trim(short_description), ''),
        'lookbook_badge', nullif(trim(lookbook_badge), ''),
        'duration_label', nullif(trim(duration_label), ''),
        'lookbook_tone', nullif(trim(lookbook_tone), '')
      )
    ),
    'en',
    jsonb_strip_nulls(
      coalesce(translations -> 'en', '{}'::jsonb)
      || jsonb_build_object(
        'lookbook_badge',
        case lower(coalesce(lookbook_badge, ''))
          when 'hot' then 'Hot'
          when 'trend' then 'Trend'
          when 'noi bat' then 'Featured'
          when 'lookbook' then 'Lookbook'
          else null
        end,
        'lookbook_tone',
        case lower(coalesce(lookbook_tone, ''))
          when 'nhe nhang' then 'Soft'
          when 'don gian' then 'Minimal'
          when 'sang trong' then 'Luxury'
          when 'ca tinh' then 'Edgy'
          when 'noi bat' then 'Standout'
          when 'cham soc' then 'Care'
          else null
        end,
        'duration_label',
        case
          when duration_min is not null and duration_min > 0 then concat(duration_min::text, ' min')
          else null
        end
      )
    )
  )
)
where true;

update public.branches
set translations = jsonb_strip_nulls(
  coalesce(translations, '{}'::jsonb)
  || jsonb_build_object(
    'vi',
    jsonb_strip_nulls(
      coalesce(translations -> 'vi', '{}'::jsonb)
      || jsonb_build_object('name', nullif(trim(name), ''))
    )
  )
)
where true;

update public.storefront_profile
set translations = jsonb_strip_nulls(
  coalesce(translations, '{}'::jsonb)
  || jsonb_build_object(
    'vi',
    jsonb_strip_nulls(
      coalesce(translations -> 'vi', '{}'::jsonb)
      || jsonb_build_object(
        'name', nullif(trim(name), ''),
        'description', nullif(trim(description), ''),
        'reviews_label', nullif(trim(reviews_label), ''),
        'opening_hours', nullif(trim(opening_hours), ''),
        'highlights', case when highlights is null then null else to_jsonb(highlights) end
      )
    )
  )
)
where true;

update public.storefront_team_members
set translations = jsonb_strip_nulls(
  coalesce(translations, '{}'::jsonb)
  || jsonb_build_object(
    'vi',
    jsonb_strip_nulls(
      coalesce(translations -> 'vi', '{}'::jsonb)
      || jsonb_build_object(
        'display_name', nullif(trim(display_name), ''),
        'role_label', nullif(trim(role_label), ''),
        'bio', nullif(trim(bio), '')
      )
    )
  )
)
where true;

update public.storefront_products
set translations = jsonb_strip_nulls(
  coalesce(translations, '{}'::jsonb)
  || jsonb_build_object(
    'vi',
    jsonb_strip_nulls(
      coalesce(translations -> 'vi', '{}'::jsonb)
      || jsonb_build_object(
        'name', nullif(trim(name), ''),
        'subtitle', nullif(trim(subtitle), ''),
        'price_label', nullif(trim(price_label), ''),
        'product_type', nullif(trim(product_type), '')
      )
    )
  )
)
where true;

update public.storefront_gallery
set translations = jsonb_strip_nulls(
  coalesce(translations, '{}'::jsonb)
  || jsonb_build_object(
    'vi',
    jsonb_strip_nulls(
      coalesce(translations -> 'vi', '{}'::jsonb)
      || jsonb_build_object('title', nullif(trim(title), ''))
    )
  )
)
where true;

update public.marketing_offers
set translations = jsonb_strip_nulls(
  coalesce(translations, '{}'::jsonb)
  || jsonb_build_object(
    'vi',
    jsonb_strip_nulls(
      coalesce(translations -> 'vi', '{}'::jsonb)
      || jsonb_build_object(
        'title', nullif(trim(title), ''),
        'description', nullif(trim(description), ''),
        'badge', nullif(trim(badge), '')
      )
    ),
    'en',
    coalesce(offer_metadata -> 'translations' -> 'en', translations -> 'en')
  )
)
where true;

update public.customer_content_posts
set translations = jsonb_strip_nulls(
  coalesce(translations, '{}'::jsonb)
  || jsonb_build_object(
    'vi',
    jsonb_strip_nulls(
      coalesce(translations -> 'vi', '{}'::jsonb)
      || jsonb_build_object(
        'title', nullif(trim(title), ''),
        'summary', nullif(trim(summary), ''),
        'body', nullif(trim(body), ''),
        'source_platform', nullif(trim(source_platform), '')
      )
    ),
    'en',
    coalesce(metadata -> 'translations' -> 'en', translations -> 'en')
  )
)
where true;
