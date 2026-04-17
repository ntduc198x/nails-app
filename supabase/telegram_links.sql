CREATE TABLE IF NOT EXISTS public.telegram_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  telegram_user_id BIGINT NOT NULL,
  telegram_username TEXT,
  telegram_first_name TEXT,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_telegram_links_app_user ON public.telegram_links(app_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_telegram_links_telegram_user ON public.telegram_links(telegram_user_id);

ALTER TABLE public.telegram_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role full access telegram" ON public.telegram_links;
CREATE POLICY "service role full access telegram" ON public.telegram_links
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "users view own link" ON public.telegram_links;
CREATE POLICY "users view own link" ON public.telegram_links
  FOR SELECT USING (app_user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.telegram_link_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telegram_link_codes_code ON public.telegram_link_codes(code);

ALTER TABLE public.telegram_link_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role full access link codes" ON public.telegram_link_codes;
CREATE POLICY "service role full access link codes" ON public.telegram_link_codes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "users view own codes" ON public.telegram_link_codes;
CREATE POLICY "users view own codes" ON public.telegram_link_codes
  FOR SELECT USING (app_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.generate_telegram_link_code(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_code TEXT;
  v_current_user_id UUID;
BEGIN
  v_current_user_id := auth.uid();
  IF v_current_user_id IS NULL OR v_current_user_id <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  DELETE FROM public.telegram_link_codes
  WHERE app_user_id = p_user_id AND used_at IS NULL;

  v_code := lpad(floor(random() * 1000000)::text, 6, '0');

  INSERT INTO public.telegram_link_codes (app_user_id, code, expires_at)
  VALUES (p_user_id, v_code, now() + interval '5 minutes');

  RETURN jsonb_build_object('success', true, 'code', v_code);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.confirm_telegram_link(
  p_code TEXT,
  p_telegram_user_id BIGINT,
  p_telegram_username TEXT DEFAULT NULL,
  p_telegram_first_name TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_link_code RECORD;
  v_app_user_id UUID;
  v_role TEXT;
  v_display_name TEXT;
BEGIN
  SELECT id, app_user_id, expires_at, used_at
  INTO v_link_code
  FROM public.telegram_link_codes
  WHERE code = p_code
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_link_code.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_CODE');
  END IF;

  IF v_link_code.used_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'CODE_USED');
  END IF;

  IF v_link_code.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'CODE_EXPIRED');
  END IF;

  DELETE FROM public.telegram_links
  WHERE app_user_id = v_link_code.app_user_id;

  DELETE FROM public.telegram_links
  WHERE telegram_user_id = p_telegram_user_id;

  INSERT INTO public.telegram_links (app_user_id, telegram_user_id, telegram_username, telegram_first_name)
  VALUES (v_link_code.app_user_id, p_telegram_user_id, p_telegram_username, p_telegram_first_name);

  UPDATE public.telegram_link_codes
  SET used_at = now()
  WHERE id = v_link_code.id;

  SELECT r.role, p.display_name
  INTO v_role, v_display_name
  FROM public.user_roles r
  LEFT JOIN public.profiles p ON p.user_id = r.user_id
  WHERE r.user_id = v_link_code.app_user_id
  LIMIT 1;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_link_code.app_user_id,
    'role', v_role,
    'display_name', v_display_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_telegram_user_role(p_telegram_user_id BIGINT)
RETURNS JSONB AS $$
DECLARE
  v_app_user_id UUID;
  v_role TEXT;
  v_display_name TEXT;
  v_org_id UUID;
BEGIN
  SELECT tl.app_user_id
  INTO v_app_user_id
  FROM public.telegram_links tl
  WHERE tl.telegram_user_id = p_telegram_user_id
  LIMIT 1;

  IF v_app_user_id IS NULL THEN
    RETURN jsonb_build_object('linked', false);
  END IF;

  SELECT r.role, r.org_id
  INTO v_role, v_org_id
  FROM public.user_roles r
  WHERE r.user_id = v_app_user_id
  LIMIT 1;

  SELECT p.display_name
  INTO v_display_name
  FROM public.profiles p
  WHERE p.user_id = v_app_user_id;

  RETURN jsonb_build_object(
    'linked', true,
    'user_id', v_app_user_id,
    'role', v_role,
    'display_name', v_display_name,
    'org_id', v_org_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.unlink_telegram(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_current_user_id UUID;
BEGIN
  v_current_user_id := auth.uid();
  IF v_current_user_id IS NULL OR v_current_user_id <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  DELETE FROM public.telegram_links WHERE app_user_id = p_user_id;
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.generate_telegram_link_code TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_telegram_link TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_telegram_user_role TO authenticated;
GRANT EXECUTE ON FUNCTION public.unlink_telegram TO authenticated;
