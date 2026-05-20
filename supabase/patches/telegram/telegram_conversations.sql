-- Split deploy for Telegram conversation-state storage.
-- Kept in sync with the Telegram sections inside deploy.sql.

CREATE TABLE IF NOT EXISTS public.telegram_conversations (
  telegram_user_id BIGINT PRIMARY KEY,
  step TEXT NOT NULL,
  data_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telegram_conversations_expires_at
  ON public.telegram_conversations (expires_at);

ALTER TABLE public.telegram_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role full access telegram conversations" ON public.telegram_conversations;
CREATE POLICY "service role full access telegram conversations" ON public.telegram_conversations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.touch_telegram_conversations_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_telegram_conversations_updated_at ON public.telegram_conversations;
CREATE TRIGGER trg_touch_telegram_conversations_updated_at
BEFORE UPDATE ON public.telegram_conversations
FOR EACH ROW
EXECUTE FUNCTION public.touch_telegram_conversations_updated_at();
