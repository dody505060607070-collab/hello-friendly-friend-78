CREATE OR REPLACE FUNCTION public.notify_task_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  IF NEW.status = 'submitted' THEN
    NEW.submitted_at := now();
    INSERT INTO public.notifications (user_id, title, body, link)
    SELECT DISTINCT u, 'مهمة بانتظار الاعتماد', 'أنجز الموظف المهمة: ' || NEW.title, '/tasks?review=' || NEW.id
    FROM (
      SELECT NEW.assigned_by AS u WHERE NEW.assigned_by IS NOT NULL
      UNION SELECT user_id FROM public.user_roles WHERE role::text IN ('super_admin','admin')
    ) s WHERE u IS NOT NULL AND u IS DISTINCT FROM auth.uid();
  ELSIF NEW.status IN ('approved','rejected') THEN
    IF NEW.status = 'approved' THEN NEW.approved_at := now(); NEW.approved_by := auth.uid(); END IF;
    INSERT INTO public.notifications (user_id, title, body, link)
    SELECT a.user_id,
      CASE WHEN NEW.status = 'approved' THEN 'تم اعتماد مهمتك' ELSE 'أُرجعت إليك مهمة للتعديل' END,
      NEW.title || CASE WHEN NEW.status = 'rejected' AND coalesce(NEW.rejection_note,'') <> '' THEN ' — ' || NEW.rejection_note ELSE '' END,
      '/tasks?review=' || NEW.id
    FROM public.task_assignees a WHERE a.task_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.notify_task_review() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_notify_task_review ON public.tasks;
CREATE TRIGGER trg_notify_task_review BEFORE UPDATE OF status ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.notify_task_review();