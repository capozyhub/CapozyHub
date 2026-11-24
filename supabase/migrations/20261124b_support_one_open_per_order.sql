-- One open complaint per order, enforced by the database so a double submit,
-- two shop staff, or a reopen of an older complaint cannot split the conversation.
CREATE UNIQUE INDEX IF NOT EXISTS support_threads_one_open_per_order
    ON public.support_threads (order_id)
    WHERE status = 'open' AND order_id IS NOT NULL;
