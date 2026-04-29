-- AI request logs
CREATE TABLE public.ai_request_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  ip_address TEXT,
  prompt TEXT NOT NULL,
  subject TEXT,
  topic TEXT,
  source TEXT NOT NULL CHECK (source IN ('cache', 'api')),
  tokens_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_logs_user_date ON public.ai_request_logs (user_id, created_at);
CREATE INDEX idx_ai_logs_ip_date ON public.ai_request_logs (ip_address, created_at);
CREATE INDEX idx_ai_logs_source_date ON public.ai_request_logs (source, created_at);

ALTER TABLE public.ai_request_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own ai logs"
ON public.ai_request_logs FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- AI response cache (general topics only, no user context)
CREATE TABLE public.ai_response_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prompt_hash TEXT NOT NULL UNIQUE,
  normalized_prompt TEXT NOT NULL,
  response_text TEXT NOT NULL,
  subject TEXT,
  topic TEXT,
  usage_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_cache_hash ON public.ai_response_cache (prompt_hash);

ALTER TABLE public.ai_response_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cache readable by authenticated"
ON public.ai_response_cache FOR SELECT TO authenticated
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_ai_cache_updated_at
BEFORE UPDATE ON public.ai_response_cache
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Helper function: count user requests today
CREATE OR REPLACE FUNCTION public.count_ai_requests_today(_user_id UUID, _ip TEXT)
RETURNS TABLE(user_count BIGINT, global_api_count BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(*) FROM public.ai_request_logs
      WHERE created_at >= CURRENT_DATE
        AND ((_user_id IS NOT NULL AND user_id = _user_id)
          OR (_user_id IS NULL AND ip_address = _ip))) AS user_count,
    (SELECT COUNT(*) FROM public.ai_request_logs
      WHERE created_at >= CURRENT_DATE AND source = 'api') AS global_api_count
$$;