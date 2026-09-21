
CREATE TABLE public.whatsapp_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'whapi',
  channel_id text,
  connected_number text,
  status text NOT NULL DEFAULT 'DISCONNECTED',
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.whatsapp_sessions TO service_role;
ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  phone text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_message_id text,
  phone text NOT NULL,
  direction text NOT NULL,
  content text,
  type text NOT NULL DEFAULT 'text',
  status text NOT NULL DEFAULT 'PENDING',
  error text,
  idempotency_key text,
  chat_id text,
  execution_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX messages_provider_message_id_key ON public.messages (provider_message_id) WHERE provider_message_id IS NOT NULL;
CREATE UNIQUE INDEX messages_idempotency_key_key ON public.messages (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX messages_phone_idx ON public.messages (phone);
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'INACTIVE',
  trigger text NOT NULL DEFAULT 'LEAD_CREATED',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.automations TO service_role;
ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.automation_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  order_index integer NOT NULL,
  type text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX automation_steps_automation_idx ON public.automation_steps (automation_id, order_index);
GRANT ALL ON public.automation_steps TO service_role;
ALTER TABLE public.automation_steps ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.automation_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  phone text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  current_step integer NOT NULL DEFAULT 0,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0,
  replied boolean NOT NULL DEFAULT false,
  last_error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX automation_executions_due_idx ON public.automation_executions (status, next_run_at);
CREATE INDEX automation_executions_phone_idx ON public.automation_executions (phone);
GRANT ALL ON public.automation_executions TO service_role;
ALTER TABLE public.automation_executions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.automation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id uuid REFERENCES public.automation_executions(id) ON DELETE CASCADE,
  step_id uuid,
  event text NOT NULL,
  status text,
  data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX automation_logs_execution_idx ON public.automation_logs (execution_id, created_at DESC);
CREATE INDEX automation_logs_created_idx ON public.automation_logs (created_at DESC);
GRANT ALL ON public.automation_logs TO service_role;
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_event_id text NOT NULL UNIQUE,
  event_type text,
  payload jsonb,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.webhook_events TO service_role;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.send_window (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  start_hour integer NOT NULL DEFAULT 8,
  end_hour integer NOT NULL DEFAULT 20,
  days integer[] NOT NULL DEFAULT ARRAY[1,2,3,4,5,6],
  tz_offset_minutes integer NOT NULL DEFAULT -180,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.send_window TO service_role;
ALTER TABLE public.send_window ENABLE ROW LEVEL SECURITY;
INSERT INTO public.send_window (id) VALUES (true);
