CREATE UNIQUE INDEX IF NOT EXISTS automation_executions_automation_lead_key
ON public.automation_executions (automation_id, lead_id)
WHERE lead_id IS NOT NULL;

DO $$
DECLARE
  target_automation_id uuid;
BEGIN
  SELECT id INTO target_automation_id
  FROM public.automations
  WHERE name = 'TESTE — LEAD FOLLOW-UP'
  ORDER BY created_at
  LIMIT 1;

  IF target_automation_id IS NULL THEN
    INSERT INTO public.automations (name, status, trigger)
    VALUES ('TESTE — LEAD FOLLOW-UP', 'ACTIVE', 'LEAD_CREATED')
    RETURNING id INTO target_automation_id;
  ELSE
    UPDATE public.automations
    SET status = 'ACTIVE', trigger = 'LEAD_CREATED', updated_at = now()
    WHERE id = target_automation_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.automation_steps WHERE automation_id = target_automation_id
  ) THEN
    INSERT INTO public.automation_steps (automation_id, order_index, type, config)
    VALUES
      (target_automation_id, 0, 'SEND_MESSAGE', jsonb_build_object('message', '🦅 Olá! Tudo bem? Aqui é da Academia Gaviões 24h - Bom Clima. Como podemos te ajudar?')),
      (target_automation_id, 1, 'WAIT', jsonb_build_object('seconds', 10)),
      (target_automation_id, 2, 'CHECK_CONDITION', jsonb_build_object('replied', true, 'ifTrue', 'END', 'ifFalse', 'CONTINUE')),
      (target_automation_id, 3, 'SEND_MESSAGE', jsonb_build_object('message', '🦅 Oi! Passando para saber se ainda podemos ajudar você.')),
      (target_automation_id, 4, 'END_AUTOMATION', '{}'::jsonb);
  END IF;
END
$$;