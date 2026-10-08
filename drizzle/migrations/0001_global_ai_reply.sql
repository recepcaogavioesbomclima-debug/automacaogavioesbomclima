CREATE TABLE public.global_reply_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  enabled boolean NOT NULL DEFAULT true,
  reply_new_leads boolean NOT NULL DEFAULT true,
  reply_existing boolean NOT NULL DEFAULT true,
  context_messages int NOT NULL DEFAULT 20,
  min_interval_seconds int NOT NULL DEFAULT 5,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.global_reply_settings TO service_role;
ALTER TABLE public.global_reply_settings ENABLE ROW LEVEL SECURITY;
INSERT INTO public.global_reply_settings (id) VALUES (true);

CREATE TABLE public.contact_ai (
  phone text PRIMARY KEY,
  paused boolean NOT NULL DEFAULT false,
  pending_reply_at timestamptz,
  last_reply_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.contact_ai TO service_role;
ALTER TABLE public.contact_ai ENABLE ROW LEVEL SECURITY;