CREATE OR REPLACE FUNCTION public.stp_compute_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IS DISTINCT FROM 'needs_review' THEN
    NEW.status := CASE
      WHEN NEW.mastery_score = 0
           AND COALESCE(NEW.attempts_count, 0) = 0
           AND NEW.practice_score IS NULL
           AND NEW.diagnostic_score IS NULL
        THEN 'not_started'
      WHEN NEW.mastery_score BETWEEN 0 AND 49 THEN 'weak'
      WHEN NEW.mastery_score BETWEEN 50 AND 69 THEN 'learning'
      WHEN NEW.mastery_score BETWEEN 70 AND 84 THEN 'stable'
      WHEN NEW.mastery_score BETWEEN 85 AND 100 THEN 'mastered'
      ELSE NEW.status
    END;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS stp_status_auto ON public.student_topic_progress;
CREATE TRIGGER stp_status_auto
BEFORE INSERT OR UPDATE ON public.student_topic_progress
FOR EACH ROW EXECUTE FUNCTION public.stp_compute_status();