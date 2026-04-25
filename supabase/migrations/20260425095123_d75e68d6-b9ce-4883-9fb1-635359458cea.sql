
-- Conversations
CREATE TABLE public.assistant_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Новый диалог',
  last_message_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.assistant_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own conversations" ON public.assistant_conversations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own conversations" ON public.assistant_conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own conversations" ON public.assistant_conversations FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own conversations" ON public.assistant_conversations FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_assistant_conversations_updated BEFORE UPDATE ON public.assistant_conversations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_assistant_conversations_user ON public.assistant_conversations(user_id, last_message_at DESC);

-- Messages
CREATE TABLE public.assistant_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.assistant_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.assistant_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own messages" ON public.assistant_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own messages" ON public.assistant_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own messages" ON public.assistant_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_assistant_messages_conv ON public.assistant_messages(conversation_id, created_at);

-- Plan suggestions from AI
CREATE TABLE public.assistant_plan_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  conversation_id UUID REFERENCES public.assistant_conversations(id) ON DELETE SET NULL,
  message_id UUID REFERENCES public.assistant_messages(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('add_lesson','move_lesson','remove_lesson','change_topic','reorder')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  rationale TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','applied','rejected')),
  applied_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.assistant_plan_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own suggestions" ON public.assistant_plan_suggestions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own suggestions" ON public.assistant_plan_suggestions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own suggestions" ON public.assistant_plan_suggestions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own suggestions" ON public.assistant_plan_suggestions FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_assistant_suggestions_updated BEFORE UPDATE ON public.assistant_plan_suggestions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_assistant_suggestions_user ON public.assistant_plan_suggestions(user_id, status, created_at DESC);
