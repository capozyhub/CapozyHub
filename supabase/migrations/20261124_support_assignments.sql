-- Who on the team is handling a support thread.
-- Kept in its own table, not a column on support_threads: customers can SELECT their own
-- threads, and an admin's user id has no business reaching them. RLS is on with no
-- policies, so only the service role (admin API routes) can read or write it.

CREATE TABLE IF NOT EXISTS public.support_thread_assignments (
  thread_id   uuid PRIMARY KEY REFERENCES public.support_threads(id) ON DELETE CASCADE,
  admin_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_thread_assignments_admin
  ON public.support_thread_assignments(admin_id);

ALTER TABLE public.support_thread_assignments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.support_thread_assignments FROM PUBLIC, anon, authenticated;
