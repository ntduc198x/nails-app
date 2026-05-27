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
        'lookbook_tone', nullif(trim(lookbook_tone), ''),
        'duration_label', nullif(trim(duration_label), '')
      )
    ),
    'en',
    jsonb_strip_nulls(
      coalesce(translations -> 'en', '{}'::jsonb)
      || jsonb_build_object(
        'name',
        coalesce(
          translations -> 'en' ->> 'name',
          case
            when lower(name) like '%clean nude%' then 'Korean Clean Nude'
            when lower(name) like '%cat eye%' or lower(name) like '%mắt mèo%' or lower(name) like '%mat meo%' then 'Smoky Cat Eye'
            when lower(name) like '%french chrome%' then 'French Chrome'
            when lower(name) like '%cherry red%' then 'Cherry Red Gloss'
            when lower(name) like '%mocha glazed%' then 'Mocha Glazed'
            when lower(name) like '%charm%' then 'Korean Charm Luxury'
            else null
          end
        ),
        'short_description',
        coalesce(
          translations -> 'en' ->> 'short_description',
          case
            when lower(name) like '%clean nude%' then 'A sheer milk-nude tone for workdays and everyday outings.'
            when lower(name) like '%cat eye%' or lower(name) like '%mắt mèo%' or lower(name) like '%mat meo%' then 'A smoky cat-eye effect that looks polished and stands out under light.'
            when lower(name) like '%french chrome%' then 'Minimal chrome French tips with an elegant, modern finish.'
            when lower(name) like '%cherry red%' then 'Glossy cherry red that flatters the skin and fits festive looks.'
            when lower(name) like '%mocha glazed%' then 'Soft milk-brown glaze that feels refined without being loud.'
            when lower(name) like '%charm%' then 'Compact charm details made for photos and evening plans.'
            when nullif(trim(short_description), '') is not null then 'Service details coming soon.'
            else null
          end
        ),
        'lookbook_badge',
        coalesce(
          translations -> 'en' ->> 'lookbook_badge',
          case lower(coalesce(lookbook_badge, ''))
            when 'hot' then 'Hot'
            when 'trend' then 'Trend'
            when 'noi bat' then 'Featured'
            when 'lookbook' then 'Lookbook'
            else null
          end
        ),
        'lookbook_tone',
        coalesce(
          translations -> 'en' ->> 'lookbook_tone',
          case lower(coalesce(lookbook_tone, ''))
            when 'nhe nhang' then 'Soft'
            when 'don gian' then 'Minimal'
            when 'sang trong' then 'Luxury'
            when 'ca tinh' then 'Edgy'
            when 'noi bat' then 'Standout'
            when 'cham soc' then 'Care'
            else null
          end
        ),
        'duration_label',
        coalesce(
          translations -> 'en' ->> 'duration_label',
          case when duration_min is not null and duration_min > 0 then concat(duration_min::text, ' min') else null end
        )
      )
    )
  )
)
where featured_in_home = true or featured_in_explore = true or featured_in_lookbook = true;

update public.storefront_profile
set translations = jsonb_strip_nulls(
  coalesce(translations, '{}'::jsonb)
  || jsonb_build_object(
    'vi',
    jsonb_strip_nulls(
      coalesce(translations -> 'vi', '{}'::jsonb)
      || jsonb_build_object(
        'name', nullif(trim(name), ''),
        'category', nullif(trim(category), ''),
        'description', nullif(trim(description), ''),
        'reviews_label', nullif(trim(reviews_label), ''),
        'address_line', nullif(trim(address_line), ''),
        'opening_hours', nullif(trim(opening_hours), ''),
        'highlights', case when highlights is null then null else to_jsonb(highlights) end
      )
    ),
    'en',
    jsonb_strip_nulls(
      coalesce(translations -> 'en', '{}'::jsonb)
      || jsonb_build_object(
        'name', coalesce(translations -> 'en' ->> 'name', nullif(trim(name), '')),
        'category', coalesce(translations -> 'en' ->> 'category', 'Nail & Beauty'),
        'description',
        coalesce(
          case
            when translations -> 'en' ->> 'description' ~* '[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]' then null
            when lower(coalesce(translations -> 'en' ->> 'description', '')) like '%khong gian%' then null
            else translations -> 'en' ->> 'description'
          end,
          'A mobile Explore storefront with lookbook styles, team, products, and store details.'
        ),
        'reviews_label',
        coalesce(
          translations -> 'en' ->> 'reviews_label',
          case when nullif(trim(reviews_label), '') is not null then regexp_replace(reviews_label, 'danh gia', 'reviews', 'gi') else null end
        ),
        'address_line',
        coalesce(
          translations -> 'en' ->> 'address_line',
          case
            when nullif(trim(address_line), '') is not null then '38A, Alley 358/40 Bui Xuong Trach, Khuong Dinh, Thanh Xuan, Hanoi'
            else null
          end
        ),
        'opening_hours',
        coalesce(
          translations -> 'en' ->> 'opening_hours',
          case when nullif(trim(opening_hours), '') is not null then 'Open: 09:00 - 21:00 (Every day)' else null end
        ),
        'highlights',
        coalesce(
          translations -> 'en' -> 'highlights',
          jsonb_build_array('Trusted studio', 'Quality service', 'Attentive care')
        )
      )
    )
  )
)
where is_active = true;

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
    ),
    'en',
    jsonb_strip_nulls(
      coalesce(translations -> 'en', '{}'::jsonb)
      || jsonb_build_object(
        'name',
        coalesce(
          translations -> 'en' ->> 'name',
          case
            when lower(name) like '%dầu dưỡng%' or lower(name) like '%dau duong%' then 'Cham Nail Care Oil'
            when lower(name) like '%sơn gel%' or lower(name) like '%son gel%' then 'Premium Gel Polish'
            when lower(name) like '%base gel%' then 'Cham Base Gel'
            when lower(name) like '%top gel%' then 'Cham No-Wipe Top Gel'
            when lower(name) like '%cọ nail%' or lower(name) like '%co nail%' then 'Nail Art Brush Set'
            when lower(name) like '%dũa móng%' or lower(name) like '%dua mong%' then 'Premium Nail File'
            when lower(name) like '%kem dưỡng%' or lower(name) like '%kem duong%' then 'Hand Cream'
            when lower(name) like '%đẩy da%' or lower(name) like '%day da%' then 'Cuticle Pusher'
            when lower(name) like '%charm%' then 'Silver Nail Charms'
            else null
          end
        ),
        'subtitle',
        coalesce(
          case
            when translations -> 'en' ->> 'subtitle' ~* '[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]' then null
            when lower(coalesce(translations -> 'en' ->> 'subtitle', '')) like '%phu kien%' then null
            else translations -> 'en' ->> 'subtitle'
          end,
          case
            when lower(coalesce(subtitle, '')) like '%phụ kiện%' or lower(coalesce(subtitle, '')) like '%phu kien%' then 'In-store accessories'
            when nullif(trim(subtitle), '') is not null then 'Product details coming soon.'
            else null
          end
        ),
        'price_label',
        coalesce(
          translations -> 'en' ->> 'price_label',
          case
            when nullif(trim(price_label), '') is not null then
              nullif(
                regexp_replace(
                  replace(replace(trim(price_label), '.', ','), 'đ', ' VND'),
                  '\s*d\s*$',
                  ' VND',
                  'i'
                ),
                ''
              )
            else null
          end
        ),
        'product_type',
        coalesce(
          translations -> 'en' ->> 'product_type',
          case lower(coalesce(product_type, ''))
            when 'care' then 'Care'
            when 'gel' then 'Gel'
            when 'polish' then 'Polish'
            when 'tool' then 'Tool'
            when 'accessory' then 'Accessory'
            else null
          end
        )
      )
    )
  )
)
where is_active = true;

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
    ),
    'en',
    jsonb_strip_nulls(
      coalesce(translations -> 'en', '{}'::jsonb)
      || jsonb_build_object(
        'display_name', coalesce(translations -> 'en' ->> 'display_name', nullif(trim(display_name), '')),
        'role_label',
        coalesce(
          translations -> 'en' ->> 'role_label',
          case lower(coalesce(role_label, ''))
            when 'chu cua hang' then 'Owner'
            when 'quan ly' then 'Manager'
            else 'Nail Artist'
          end
        ),
        'bio', coalesce(translations -> 'en' ->> 'bio', case when nullif(trim(bio), '') is not null then 'Team member displayed on customer Explore.' else null end)
      )
    )
  )
)
where is_visible = true;

update public.storefront_gallery
set translations = jsonb_strip_nulls(
  coalesce(translations, '{}'::jsonb)
  || jsonb_build_object(
    'vi',
    jsonb_strip_nulls(coalesce(translations -> 'vi', '{}'::jsonb) || jsonb_build_object('title', nullif(trim(title), ''))),
    'en',
    jsonb_strip_nulls(
      coalesce(translations -> 'en', '{}'::jsonb)
      || jsonb_build_object(
        'title',
        coalesce(
          translations -> 'en' ->> 'title',
          case lower(coalesce(title, ''))
            when 'khong gian storefront' then 'Storefront space'
            when 'khong gian cua tiem' then 'Storefront space'
            when 'không gian cửa tiệm' then 'Storefront space'
            when 'ban tiep don' then 'Reception desk'
            when 'mau french chic' then 'French chic look'
            when 'mau milky glow' then 'Milky glow look'
            when 'team tai cua hang' then 'In-store team'
            when 'nhan su cua tiem' then 'In-store team'
            when 'nhân sự của tiệm' then 'In-store team'
            when 'goc decor anh kim' then 'Metallic decor corner'
            else 'Gallery image'
          end
        )
      )
    )
  )
)
where is_active = true;

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
    jsonb_strip_nulls(
      coalesce(translations -> 'en', '{}'::jsonb)
      || jsonb_build_object(
        'title',
        coalesce(
          case
            when translations -> 'en' ->> 'title' ~* '[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]' then null
            when lower(coalesce(translations -> 'en' ->> 'title', '')) like '%uu dai%' then null
            else translations -> 'en' ->> 'title'
          end,
          offer_metadata -> 'translations' -> 'en' ->> 'title',
          case
            when lower(title) like '%sinh nhật%' or lower(title) like '%sinh nhat%' then 'Birthday offer'
            when lower(title) like '%30.000%' or lower(title) like '%30000%' then '30,000 VND off'
            when lower(title) like '%giảm%' or lower(title) like '%giam%' then 'Discount offer'
            else 'Offer'
          end
        ),
        'description',
        coalesce(
          case
            when translations -> 'en' ->> 'description' ~* '[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]' then null
            when lower(coalesce(translations -> 'en' ->> 'description', '')) like '%dich vu%' then null
            else translations -> 'en' ->> 'description'
          end,
          offer_metadata -> 'translations' -> 'en' ->> 'description',
          case when nullif(trim(description), '') is not null then 'Offer details coming soon.' else null end
        ),
        'badge',
        coalesce(
          translations -> 'en' ->> 'badge',
          offer_metadata -> 'translations' -> 'en' ->> 'badge',
          case when nullif(trim(badge), '') is not null then 'Offer' else null end
        )
      )
    )
  )
)
where is_active = true;

update public.marketing_offers
set offer_metadata = jsonb_strip_nulls(
  coalesce(offer_metadata, '{}'::jsonb)
  || jsonb_build_object(
    'translations',
    jsonb_strip_nulls(
      coalesce(offer_metadata -> 'translations', '{}'::jsonb)
      || jsonb_build_object(
        'en',
        jsonb_strip_nulls(
          coalesce(offer_metadata -> 'translations' -> 'en', '{}'::jsonb)
          || jsonb_build_object(
            'usageHint',
            coalesce(
              offer_metadata -> 'translations' -> 'en' ->> 'usageHint',
              case
                when nullif(trim(offer_metadata ->> 'usageHint'), '') is not null then 'Use this offer when booking or mention it before checkout so the store can confirm it.'
                else null
              end
            ),
            'bookingCtaLabel',
            coalesce(
              offer_metadata -> 'translations' -> 'en' ->> 'bookingCtaLabel',
              case
                when nullif(trim(offer_metadata ->> 'bookingCtaLabel'), '') is not null then 'Book with this offer'
                else null
              end
            ),
            'redeemLabel',
            coalesce(
              offer_metadata -> 'translations' -> 'en' ->> 'redeemLabel',
              case
                when nullif(trim(offer_metadata ->> 'redeemLabel'), '') is not null then 'Use this offer at checkout.'
                else null
              end
            )
          )
        )
      )
    )
  )
)
where is_active = true
  and offer_metadata is not null;

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
    jsonb_strip_nulls(
      coalesce(translations -> 'en', '{}'::jsonb)
      || jsonb_build_object(
        'title',
        coalesce(
          case
            when translations -> 'en' ->> 'title' ~* '[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]' then null
            else translations -> 'en' ->> 'title'
          end,
          metadata -> 'translations' -> 'en' ->> 'title',
          case
            when lower(title) like '%đầu tuần%' or lower(title) like '%dau tuan%' then '3 nail looks for the start of the week'
            when lower(title) like '%gel%' then 'How to keep gel color fresh longer'
            when lower(title) like '%ưu đãi%' or lower(title) like '%uu dai%' then 'Monthly member offers'
            else 'Update'
          end
        ),
        'summary',
        coalesce(
          case
            when translations -> 'en' ->> 'summary' ~* '[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]' then null
            else translations -> 'en' ->> 'summary'
          end,
          metadata -> 'translations' -> 'en' ->> 'summary',
          case
            when lower(summary) like '%đi làm%' or lower(summary) like '%di lam%' then 'Quick shade ideas for workdays and casual plans.'
            when lower(summary) like '%chăm sóc%' or lower(summary) like '%cham soc%' then 'Simple aftercare tips after your nail appointment.'
            when lower(summary) like '%hạng thành viên%' or lower(summary) like '%hang thanh vien%' then 'Check your membership tier for matching offers.'
            else 'Update details coming soon.'
          end
        ),
        'body',
        coalesce(
          case
            when translations -> 'en' ->> 'body' ~* '[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]' then null
            else translations -> 'en' ->> 'body'
          end,
          metadata -> 'translations' -> 'en' ->> 'body',
          'Update details coming soon.'
        ),
        'source_platform',
        coalesce(
          metadata -> 'translations' -> 'en' ->> 'source_platform',
          'Beauty feed'
        )
      )
    )
  )
)
where status = 'published';
