import { pool } from "@workspace/db";
import { INITIAL_FEATURE_CATALOG } from "./initial-feature-catalog";
import { validateCatalogFeature } from "./entitlement-contract";

export async function ensureFeatureCatalogSchema(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TABLE IF NOT EXISTS feature_catalog_versions (
        id text PRIMARY KEY, feature_key text NOT NULL, version integer NOT NULL CHECK(version>0),
        name_en text NOT NULL, name_es text NOT NULL, description_en text NOT NULL, description_es text NOT NULL,
        product_family text NOT NULL, module text NOT NULL, capability_status text NOT NULL,
        tier_availability jsonb NOT NULL DEFAULT '[]'::jsonb, bundle_dependencies jsonb NOT NULL DEFAULT '[]'::jsonb,
        eligible_seat_classes jsonb NOT NULL DEFAULT '[]'::jsonb, required_scoped_authorities jsonb NOT NULL DEFAULT '[]'::jsonb,
        supports_company_policy boolean NOT NULL DEFAULT false, supports_project_policy boolean NOT NULL DEFAULT false,
        supports_user_preference boolean NOT NULL DEFAULT false, policy_configuration_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
        ai_classification text NOT NULL, supported_credit_payers jsonb NOT NULL DEFAULT '[]'::jsonb,
        metering_policy_key text, confirmation_requirements jsonb NOT NULL DEFAULT '[]'::jsonb,
        file_reading boolean NOT NULL DEFAULT false, external_delivery boolean NOT NULL DEFAULT false,
        audit_requirements jsonb NOT NULL DEFAULT '[]'::jsonb, authorized_data_scope jsonb NOT NULL DEFAULT '[]'::jsonb,
        preview_upgrade_explanation_en text NOT NULL, preview_upgrade_explanation_es text NOT NULL,
        effective_from timestamptz NOT NULL, effective_to timestamptz, deprecated_at timestamptz,
        replacement_feature_key text, deprecation_explanation_en text, deprecation_explanation_es text,
        contract_override_mode text NOT NULL DEFAULT 'restrict_only', capability_dependencies jsonb NOT NULL DEFAULT '[]'::jsonb,
        commercial_authority text NOT NULL DEFAULT 'none', preference_key text,
        created_by_id integer REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT feature_catalog_versions_status_chk CHECK(capability_status IN ('available','preview','coming_later','suspended','deprecated')),
        CONSTRAINT feature_catalog_versions_ai_chk CHECK(ai_classification IN ('non_ai','deterministic_automation','text_ai','file_reading_ai','proactive_ai')),
        CONSTRAINT feature_catalog_versions_contract_chk CHECK(contract_override_mode IN ('none','restrict_only','grant_and_restrict')),
        CONSTRAINT feature_catalog_versions_commercial_chk CHECK(commercial_authority IN ('none','tier','addon','tier_or_addon')),
        UNIQUE(feature_key,version)
      );
      CREATE INDEX IF NOT EXISTS feature_catalog_versions_effective_idx ON feature_catalog_versions(feature_key,effective_from,effective_to);
      ALTER TABLE feature_catalog_versions ADD COLUMN IF NOT EXISTS supports_user_preference boolean NOT NULL DEFAULT false;
      ALTER TABLE feature_catalog_versions ADD COLUMN IF NOT EXISTS policy_configuration_keys jsonb NOT NULL DEFAULT '[]'::jsonb;

      CREATE TABLE IF NOT EXISTS feature_catalog_activations (
        id text PRIMARY KEY, catalog_version_id text NOT NULL UNIQUE REFERENCES feature_catalog_versions(id),
        activated_by_id integer REFERENCES users(id), activated_at timestamptz NOT NULL DEFAULT now(), evidence jsonb NOT NULL DEFAULT '{}'::jsonb
      );
      CREATE TABLE IF NOT EXISTS platform_capability_versions (
        id text PRIMARY KEY, feature_key text NOT NULL, version integer NOT NULL CHECK(version>0), capability_status text NOT NULL,
        reason_code text NOT NULL, explanation_en text NOT NULL, explanation_es text NOT NULL,
        effective_from timestamptz NOT NULL, effective_to timestamptz, created_by_id integer NOT NULL REFERENCES users(id),
        created_at timestamptz NOT NULL DEFAULT now(), audit_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
        CONSTRAINT platform_capability_versions_status_chk CHECK(capability_status IN ('available','preview','coming_later','suspended','deprecated')),
        UNIQUE(feature_key,version)
      );
      CREATE INDEX IF NOT EXISTS platform_capability_versions_effective_idx ON platform_capability_versions(feature_key,effective_from,effective_to);
      CREATE TABLE IF NOT EXISTS feature_catalog_audit (
        id text PRIMARY KEY, event_type text NOT NULL, feature_key text NOT NULL, version integer NOT NULL,
        actor_user_id integer REFERENCES users(id), evidence jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS feature_catalog_audit_feature_created_idx ON feature_catalog_audit(feature_key,created_at);

      CREATE OR REPLACE FUNCTION bimlog_catalog_version_immutable_after_activation() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF EXISTS(SELECT 1 FROM feature_catalog_activations WHERE catalog_version_id=OLD.id) THEN
          RAISE EXCEPTION 'activated catalog versions are immutable';
        END IF;
        RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
      END $$;
      CREATE OR REPLACE FUNCTION bimlog_append_only_journal() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'catalog journals are append-only'; END $$;
      CREATE OR REPLACE FUNCTION bimlog_catalog_activation_audit() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        INSERT INTO feature_catalog_audit(id,event_type,feature_key,version,actor_user_id,evidence,created_at)
        SELECT 'audit:'||NEW.id,'catalog_activated',v.feature_key,v.version,NEW.activated_by_id,
          jsonb_build_object('source',COALESCE(NEW.evidence->>'source','catalog_activation'),'catalog_version_id',v.id),NEW.activated_at
        FROM feature_catalog_versions v WHERE v.id=NEW.catalog_version_id;
        RETURN NEW;
      END $$;
      CREATE OR REPLACE FUNCTION bimlog_platform_capability_audit() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        INSERT INTO feature_catalog_audit(id,event_type,feature_key,version,actor_user_id,evidence,created_at)
        VALUES('audit:'||NEW.id,'platform_capability_changed',NEW.feature_key,NEW.version,NEW.created_by_id,
          jsonb_build_object('reason_code',NEW.reason_code,'status',NEW.capability_status),NEW.created_at);
        RETURN NEW;
      END $$;
      DO $catalog_triggers$ BEGIN
        IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='feature_catalog_versions_immutable_trigger') THEN
          CREATE TRIGGER feature_catalog_versions_immutable_trigger BEFORE UPDATE OR DELETE ON feature_catalog_versions FOR EACH ROW EXECUTE FUNCTION bimlog_catalog_version_immutable_after_activation();
        END IF;
        IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='feature_catalog_activations_append_only_trigger') THEN
          CREATE TRIGGER feature_catalog_activations_append_only_trigger BEFORE UPDATE OR DELETE ON feature_catalog_activations FOR EACH ROW EXECUTE FUNCTION bimlog_append_only_journal();
        END IF;
        IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='platform_capability_versions_append_only_trigger') THEN
          CREATE TRIGGER platform_capability_versions_append_only_trigger BEFORE UPDATE OR DELETE ON platform_capability_versions FOR EACH ROW EXECUTE FUNCTION bimlog_append_only_journal();
        END IF;
        IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='feature_catalog_audit_append_only_trigger') THEN
          CREATE TRIGGER feature_catalog_audit_append_only_trigger BEFORE UPDATE OR DELETE ON feature_catalog_audit FOR EACH ROW EXECUTE FUNCTION bimlog_append_only_journal();
        END IF;
        IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='feature_catalog_activation_audit_trigger') THEN
          CREATE TRIGGER feature_catalog_activation_audit_trigger AFTER INSERT ON feature_catalog_activations FOR EACH ROW EXECUTE FUNCTION bimlog_catalog_activation_audit();
        END IF;
        IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='platform_capability_audit_trigger') THEN
          CREATE TRIGGER platform_capability_audit_trigger AFTER INSERT ON platform_capability_versions FOR EACH ROW EXECUTE FUNCTION bimlog_platform_capability_audit();
        END IF;
      END $catalog_triggers$;
    `);

    for (const item of INITIAL_FEATURE_CATALOG) {
      if (!validateCatalogFeature(item)) throw new Error("Initial feature catalog contains an invalid bounded field.");
      await client.query(`INSERT INTO feature_catalog_versions(
        id,feature_key,version,name_en,name_es,description_en,description_es,product_family,module,capability_status,
        tier_availability,bundle_dependencies,eligible_seat_classes,required_scoped_authorities,supports_company_policy,supports_project_policy,
        supports_user_preference,policy_configuration_keys,ai_classification,supported_credit_payers,metering_policy_key,confirmation_requirements,file_reading,external_delivery,audit_requirements,
        authorized_data_scope,preview_upgrade_explanation_en,preview_upgrade_explanation_es,effective_from,effective_to,replacement_feature_key,
        deprecation_explanation_en,deprecation_explanation_es,contract_override_mode,capability_dependencies,commercial_authority,preference_key
      ) VALUES(
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13::jsonb,$14::jsonb,$15,$16,$17,$18::jsonb,$19,$20::jsonb,$21,$22::jsonb,$23,$24,$25::jsonb,
        $26::jsonb,$27,$28,$29,$30,$31,$32,$33,$34,$35::jsonb,$36,$37
      ) ON CONFLICT(feature_key,version) DO NOTHING`, [
        item.id,item.featureKey,item.version,item.name.en,item.name.es,item.description.en,item.description.es,item.productFamily,item.module,item.capabilityStatus,
        JSON.stringify(item.tierAvailability),JSON.stringify(item.bundleDependencies),JSON.stringify(item.eligibleSeatClasses),JSON.stringify(item.requiredScopedAuthorities),
        item.supportsCompanyPolicy,item.supportsProjectPolicy,item.supportsUserPreference,JSON.stringify(item.policyConfigurationKeys),item.aiClassification,JSON.stringify(item.supportedCreditPayers),item.meteringPolicyKey,
        JSON.stringify(item.confirmationRequirements),item.fileReading,item.externalDelivery,JSON.stringify(item.auditRequirements),JSON.stringify(item.authorizedDataScope),
        item.previewUpgradeExplanation.en,item.previewUpgradeExplanation.es,item.effectiveFrom,item.effectiveTo,item.replacementFeatureKey,
        item.deprecationExplanation?.en ?? null,item.deprecationExplanation?.es ?? null,item.contractOverrideMode,JSON.stringify(item.capabilityDependencies),
        item.commercialAuthority,item.preferenceKey,
      ]);
      await client.query(`INSERT INTO feature_catalog_activations(id,catalog_version_id,evidence)
        VALUES($1,$2,$3::jsonb) ON CONFLICT(catalog_version_id) DO NOTHING`, [
        `activation:${item.id}`, item.id, JSON.stringify({ source: "step2_policy_catalog", baseline: "034ddc268d6d1fad00fd917f3d17e34915300d5f" }),
      ]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

let startupMigration: Promise<void> | null = null;

export function startFeatureCatalogMigration(): Promise<void> {
  startupMigration ??= ensureFeatureCatalogSchema();
  return startupMigration;
}

export async function waitForFeatureCatalogMigration(): Promise<void> {
  if (!startupMigration) throw new Error("Feature catalog startup migration has not started.");
  await startupMigration;
}
