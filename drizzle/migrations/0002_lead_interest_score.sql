CREATE TABLE public.lead_interest (
  phone text PRIMARY KEY,
  score int NOT NULL DEFAULT 0,
  level text NOT NULL DEFAULT 'MUITO BAIXO',
  intent text NOT NULL DEFAULT 'INDEFINIDO',
  objection text,
  trend text NOT NULL DEFAULT 'ESTAVEL',
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  hot boolean NOT NULL DEFAULT false,
  pending_at timestamptz,
  analyzed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.lead_interest TO service_role;
ALTER TABLE public.lead_interest ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.lead_interest_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  score int NOT NULL,
  level text NOT NULL,
  intent text NOT NULL,
  objection text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lead_interest_history_phone_idx ON public.lead_interest_history (phone, created_at DESC);
GRANT ALL ON public.lead_interest_history TO service_role;
ALTER TABLE public.lead_interest_history ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.interest_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  hot_threshold int NOT NULL DEFAULT 80,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.interest_settings TO service_role;
ALTER TABLE public.interest_settings ENABLE ROW LEVEL SECURITY;
INSERT INTO public.interest_settings (id) VALUES (true);