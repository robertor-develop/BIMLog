-- Explicit additive release migration; never run implicitly during login.
BEGIN;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS retired_into_company_id integer;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS retired_at timestamptz;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='companies_retired_into_fk' AND conrelid='companies'::regclass) THEN
    ALTER TABLE companies ADD CONSTRAINT companies_retired_into_fk FOREIGN KEY(retired_into_company_id) REFERENCES companies(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='companies_retirement_chk' AND conrelid='companies'::regclass) THEN
    ALTER TABLE companies ADD CONSTRAINT companies_retirement_chk CHECK
      ((retired_into_company_id IS NULL AND retired_at IS NULL) OR
       (retired_into_company_id IS NOT NULL AND retired_at IS NOT NULL AND retired_into_company_id<>id));
  END IF;
END $$;
COMMIT;
