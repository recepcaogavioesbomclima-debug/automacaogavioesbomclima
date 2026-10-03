CREATE TABLE public.intent_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intent text NOT NULL UNIQUE,
  examples text NOT NULL DEFAULT '',
  response text NOT NULL DEFAULT '',
  alternatives text[] NOT NULL DEFAULT '{}',
  priority integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.intent_responses TO service_role;
ALTER TABLE public.intent_responses ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.business_info (
  id boolean PRIMARY KEY DEFAULT true,
  content text NOT NULL DEFAULT '',
  fallback_reply text NOT NULL DEFAULT 'Claro! 😊 Me conta o que você gostaria de saber sobre a Gaviões Bom Clima que eu te ajudo.',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.business_info TO service_role;
ALTER TABLE public.business_info ENABLE ROW LEVEL SECURITY;
INSERT INTO public.business_info (id) VALUES (true);

ALTER TABLE public.automation_executions ADD COLUMN pending_reply_at timestamptz;

INSERT INTO public.intent_responses (intent, examples, priority) VALUES
('Saudação','Oi; Olá; Bom dia; Boa tarde',10),
('Preço','Quanto custa?; Qual o valor?; Quanto fica?',9),
('Planos','Quais planos vocês têm?; E o mensal?',9),
('Horários','Vocês funcionam 24 horas?; Que horas abre?',8),
('Endereço','Onde fica?; Qual o endereço?',8),
('Aulas e modalidades','Tem aula de quê?; Tem funcional?',6),
('Estrutura','Como é a academia?; Tem vestiário?',5),
('Estacionamento','Tem estacionamento?',5),
('Wellhub / TotalPass','Aceita Gympass?; Aceita TotalPass?',6),
('Matrícula','Como faço matrícula?; Me manda o link',8),
('Visita / conhecer a unidade','Quero conhecer; Posso treinar hoje?',7),
('Personal trainer','Tem personal?',5),
('Formas de pagamento','Aceita cartão?; Tem pix?',5),
('Cancelamento','Como cancelo?',5),
('Agradecimento','Obrigado; Valeu; Tá bom',3),
('Não quer mais receber mensagens','Pare; Não quero mais; Sair',10);