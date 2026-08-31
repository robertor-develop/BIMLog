-- BIMLog Lens Next binding-scope repair.
-- Production applied and verified on 2026-08-31 against public.lens_next_model_bindings.
-- The transaction fails closed if the expected legacy index is absent or any DDL fails.
BEGIN;

LOCK TABLE public.lens_next_model_bindings IN SHARE ROW EXCLUSIVE MODE;

DROP INDEX public.lens_next_model_bindings_active_key_uidx;

CREATE UNIQUE INDEX lens_next_model_bindings_active_project_key_uidx
  ON public.lens_next_model_bindings USING btree (project_id, model_binding_key)
  WHERE status = 'active';

CREATE INDEX lens_next_model_bindings_key_idx
  ON public.lens_next_model_bindings USING btree (model_binding_key);

COMMIT;
