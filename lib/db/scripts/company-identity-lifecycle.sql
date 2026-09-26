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
-- Protect every company-creation/rename path, not just public registration.
-- Existing similar names are reviewed separately; this does not rewrite them.
CREATE OR REPLACE FUNCTION bimlog_company_collision_key(value text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT lower(regexp_replace(normalize(value,NFKC),'[[:punct:][:space:]]','','g'))
$$;
CREATE OR REPLACE FUNCTION bimlog_company_name_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='UPDATE' AND NEW.name IS NOT DISTINCT FROM OLD.name THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('bimlog:company-identity'));
  IF length(bimlog_company_collision_key(NEW.name))=0 THEN
    RAISE EXCEPTION 'COMPANY_NAME_INVALID' USING ERRCODE='23514';
  END IF;
  IF EXISTS(SELECT 1 FROM companies c WHERE c.id<>NEW.id AND
    bimlog_company_collision_key(c.name)=bimlog_company_collision_key(NEW.name)) THEN
    RAISE EXCEPTION 'COMPANY_JOIN_REQUIRED' USING ERRCODE='23505',CONSTRAINT='company_normalized_name_guard';
  END IF;
  RETURN NEW;
END $$;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='companies_normalized_name_guard' AND tgrelid='companies'::regclass) THEN
    CREATE TRIGGER companies_normalized_name_guard BEFORE INSERT OR UPDATE OF name ON companies
      FOR EACH ROW EXECUTE FUNCTION bimlog_company_name_guard();
  END IF;
END $$;
COMMIT;
