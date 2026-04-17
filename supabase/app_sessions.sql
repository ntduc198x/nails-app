CREATE TABLE IF NOT EXISTS public.app_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,
  device_fingerprint TEXT,
  device_info JSONB DEFAULT '{}',
  expires_at TIMESTAMPTZ DEFAULT now() + interval '7 days',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_sessions_token ON public.app_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_app_sessions_user ON public.app_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_app_sessions_expires ON public.app_sessions(expires_at);

ALTER TABLE public.app_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role full access" ON public.app_sessions;
CREATE POLICY "service role full access" ON public.app_sessions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "users can view own session" ON public.app_sessions;
CREATE POLICY "users can view own session" ON public.app_sessions
  FOR SELECT USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.online_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  device_fingerprint TEXT,
  device_info JSONB DEFAULT '{}',
  last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_online_users_user ON public.online_users(user_id);

ALTER TABLE public.online_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role full access online" ON public.online_users;
CREATE POLICY "service role full access online" ON public.online_users
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "users can view own online status" ON public.online_users;
CREATE POLICY "users can view own online status" ON public.online_users
  FOR SELECT USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.create_app_session(
  p_user_id UUID,
  p_device_fingerprint TEXT DEFAULT NULL,
  p_device_info JSONB DEFAULT '{}'
)
RETURNS JSONB AS $$
DECLARE
  v_token TEXT;
  v_old_session RECORD;
  v_device_owner_id UUID;
  v_device_owner_name TEXT;
  v_current_user_id UUID;
BEGIN
  v_current_user_id := auth.uid();

  IF v_current_user_id IS NULL OR v_current_user_id <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: Cannot create session for another user';
  END IF;

  DELETE FROM public.online_users WHERE true;

  IF p_device_fingerprint IS NOT NULL THEN
    SELECT ds.user_id, p.display_name
    INTO v_device_owner_id, v_device_owner_name
    FROM device_sessions ds
    LEFT JOIN profiles p ON p.user_id = ds.user_id
    WHERE ds.device_fingerprint = p_device_fingerprint
    LIMIT 1;

    IF v_device_owner_id IS NOT NULL AND v_device_owner_id <> p_user_id THEN
      DELETE FROM public.app_sessions
      WHERE user_id = v_device_owner_id;
    END IF;
  END IF;

  SELECT id, session_token INTO v_old_session
  FROM public.app_sessions
  WHERE user_id = p_user_id
  ORDER BY created_at DESC
  LIMIT 1;

  DELETE FROM public.app_sessions
  WHERE user_id = p_user_id;

  v_token := encode(gen_random_bytes(32), 'hex');

  INSERT INTO public.app_sessions (user_id, session_token, device_fingerprint, device_info)
  VALUES (p_user_id, v_token, p_device_fingerprint, COALESCE(p_device_info, '{}'::jsonb));

  INSERT INTO public.online_users (user_id, device_fingerprint, device_info)
  VALUES (p_user_id, p_device_fingerprint, COALESCE(p_device_info, '{}'::jsonb));

  RETURN jsonb_build_object(
    'success', true,
    'token', v_token,
    'old_session_exists', v_old_session.id IS NOT NULL,
    'device_replaced', v_device_owner_id IS NOT NULL AND v_device_owner_id <> p_user_id,
    'replaced_user_id', v_device_owner_id,
    'replaced_owner_name', v_device_owner_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.validate_app_session(p_token TEXT)
RETURNS JSONB AS $$
DECLARE
  v_session RECORD;
  v_device_owner_id UUID;
  v_device_owner_name TEXT;
  v_is_online BOOLEAN;
  v_current_user_id UUID;
BEGIN
  v_current_user_id := auth.uid();

  SELECT s.id, s.user_id, s.device_fingerprint, s.device_info, s.created_at,
         p.display_name as owner_name
  INTO v_session
  FROM public.app_sessions s
  LEFT JOIN public.profiles p ON p.user_id = s.user_id
  WHERE s.session_token = p_token
    AND s.expires_at > now();

  IF v_session.id IS NULL THEN
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'INVALID_TOKEN',
      'message', 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.'
    );
  END IF;

  IF v_current_user_id IS NOT NULL AND v_session.user_id <> v_current_user_id THEN
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'INVALID_TOKEN',
      'message', 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.'
    );
  END IF;

  SELECT EXISTS(SELECT 1 FROM online_users WHERE user_id = v_session.user_id)
  INTO v_is_online;

  IF NOT v_is_online THEN
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'SESSION_REPLACED',
      'message', 'Tài khoản đã được đăng nhập ở nơi khác. Bạn cần đăng nhập lại.'
    );
  END IF;

  IF v_session.device_fingerprint IS NOT NULL THEN
    SELECT ds.user_id, p.display_name
    INTO v_device_owner_id, v_device_owner_name
    FROM device_sessions ds
    LEFT JOIN profiles p ON p.user_id = ds.user_id
    WHERE ds.device_fingerprint = v_session.device_fingerprint
    LIMIT 1;

    IF v_device_owner_id IS NOT NULL AND v_device_owner_id <> v_session.user_id THEN
      RETURN jsonb_build_object(
        'valid', false,
        'reason', 'DEVICE_TAKEN',
        'message', 'Thiết bị này đã được đăng nhập bởi tài khoản khác.',
        'owner_name', v_device_owner_name
      );
    END IF;
  END IF;

  UPDATE public.app_sessions
  SET expires_at = now() + interval '7 days'
  WHERE id = v_session.id;

  UPDATE public.online_users
  SET last_heartbeat = now()
  WHERE user_id = v_session.user_id;

  RETURN jsonb_build_object(
    'valid', true,
    'user_id', v_session.user_id,
    'device_fingerprint', v_session.device_fingerprint,
    'device_info', v_session.device_info,
    'owner_name', v_session.owner_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.revoke_app_session(p_token TEXT)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT user_id INTO v_user_id FROM public.app_sessions WHERE session_token = p_token;
  DELETE FROM public.app_sessions WHERE session_token = p_token;
  IF v_user_id IS NOT NULL THEN
    DELETE FROM public.online_users WHERE user_id = v_user_id;
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.revoke_all_user_sessions(p_user_id UUID)
RETURNS JSONB AS $$
BEGIN
  DELETE FROM public.app_sessions WHERE user_id = p_user_id;
  DELETE FROM public.online_users WHERE user_id = p_user_id;
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.heartbeat_online_user(p_user_id UUID)
RETURNS JSONB AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM online_users WHERE user_id = p_user_id) THEN
    UPDATE online_users SET last_heartbeat = now() WHERE user_id = p_user_id;
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.create_app_session TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_app_session TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_app_session TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_all_user_sessions TO authenticated;
GRANT EXECUTE ON FUNCTION public.heartbeat_online_user TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.online_users TO authenticated;
