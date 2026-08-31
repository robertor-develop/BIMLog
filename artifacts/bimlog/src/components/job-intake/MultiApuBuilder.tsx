import { CopyPlus, Plus, Trash2 } from "lucide-react";
import React from "react";
type Props = {
  data: any;
  setData: (updater: (old: any) => any) => void;
  tt: (en: string, es: string) => string;
};
const templates: Record<string, any> = {
  drafting: {
    title: "Drafting",
    method: "hours_hourly_rate",
    hourlyRate: "35.47",
    rateProvenance: "portfolio_default",
  },
  bim_coordination: {
    title: "BIM coordination",
    method: "hours_hourly_rate",
    hourlyRate: "37.99",
    rateProvenance: "portfolio_default",
  },
  custom: {
    title: "Custom service",
    method: "hours_hourly_rate",
    hourlyRate: "0",
    rateProvenance: "user_entered",
  },
};
const blank = (contractId: string, templateKey = "custom") => ({
  id: `APU-${crypto.randomUUID()}`,
  contractId,
  templateKey,
  ...templates[templateKey],
  hours: "1",
  quantity: "1",
  unitCost: "0",
  fixedAmount: "0",
  currency: "USD",
  canonicalVersionId: null,
  authorityState: "draft",
});
const total = (apu: any) =>
  apu.method === "fixed_amount"
    ? Number(apu.fixedAmount || 0)
    : apu.method === "quantity_unit_cost"
      ? Number(apu.quantity || 0) * Number(apu.unitCost || 0)
      : Number(apu.hours || 0) * Number(apu.hourlyRate || 0);
export function MultiApuBuilder({ data, setData, tt }: Props) {
  const apus = data.apuDrafts || [],
    contracts = data.commercial?.contracts || [];
  const setApus = (next: any[]) =>
    setData((old: any) => ({ ...old, apuDrafts: next }));
  const update = (id: string, patch: any) =>
    setApus(
      apus.map((apu: any) =>
        apu.id === id && !apu.canonicalVersionId ? { ...apu, ...patch } : apu,
      ),
    );
  const add = (contractId: string, templateKey: string) =>
    setApus([...apus, blank(contractId, templateKey)]);
  const remove = (id: string) =>
    setData((old: any) => ({
      ...old,
      apuDrafts: old.apuDrafts.filter((apu: any) => apu.id !== id),
      scopeItems: old.scopeItems.map((item: any) =>
        item.apuDraftId === id ? { ...item, apuDraftId: null } : item,
      ),
    }));
  return (
    <section className="apu-builder" aria-labelledby="apu-builder-title">
      <style>{css}</style>
      <header>
        <div>
          <span className="eyebrow">
            {tt("BUILD YOUR PRICE", "CONSTRUYA SU PRECIO")}
          </span>
          <h2 id="apu-builder-title">
            {tt(
              "Multiple APUs, one clear agreement map",
              "Múltiples APU, un mapa claro de acuerdos",
            )}
          </h2>
          <p>
            {tt(
              "Create a separate price analysis for every service or agreement. Drafts stay editable; linked approved versions are read-only and changes require a successor version.",
              "Cree un análisis de precio separado para cada servicio o acuerdo. Los borradores se pueden editar; las versiones aprobadas vinculadas son de solo lectura y los cambios requieren una versión sucesora.",
            )}
          </p>
        </div>
        <span className="count">{apus.length} APU</span>
      </header>
      {contracts.map((contract: any) => {
        const rows = apus.filter((apu: any) => apu.contractId === contract.id);
        return (
          <div className="agreement" key={contract.id}>
            <div className="agreement-head">
              <div>
                <strong>
                  {contract.title ||
                    contract.contractNumber ||
                    tt("Untitled agreement", "Acuerdo sin título")}
                </strong>
                <small>
                  {rows.length} {tt("price analyses", "análisis de precio")}
                </small>
              </div>
              <div className="template-actions">
                <button
                  type="button"
                  onClick={() => add(contract.id, "drafting")}
                >
                  <Plus size={15} />
                  {tt("Drafting APU", "APU de dibujo")}
                </button>
                <button
                  type="button"
                  onClick={() => add(contract.id, "bim_coordination")}
                >
                  <Plus size={15} />
                  {tt("Coordination APU", "APU de coordinación")}
                </button>
                <button
                  type="button"
                  onClick={() => add(contract.id, "custom")}
                >
                  <CopyPlus size={15} />
                  {tt("Custom", "Personalizado")}
                </button>
              </div>
            </div>
            {!rows.length && (
              <div className="empty">
                {tt(
                  "No APU yet. Choose a template above; every value can be adjusted before approval.",
                  "Aún no hay APU. Elija una plantilla arriba; cada valor puede ajustarse antes de aprobar.",
                )}
              </div>
            )}
            <div className="cards">
              {rows.map((apu: any) => {
                const locked = !!apu.canonicalVersionId;
                return (
                  <article className={locked ? "locked" : ""} key={apu.id}>
                    <div className="card-top">
                      <input
                        aria-label={tt("APU name", "Nombre del APU")}
                        value={apu.title}
                        disabled={locked}
                        onChange={(e) =>
                          update(apu.id, { title: e.target.value })
                        }
                      />
                      <span>
                        {locked
                          ? tt(
                              `Approved v${apu.canonicalVersionId}`,
                              `Aprobado v${apu.canonicalVersionId}`,
                            )
                          : tt("Editable draft", "Borrador editable")}
                      </span>
                    </div>
                    <div className="fields">
                      <label>
                        {tt("Method", "Método")}
                        <select
                          value={apu.method}
                          disabled={locked}
                          onChange={(e) =>
                            update(apu.id, { method: e.target.value })
                          }
                        >
                          <option value="hours_hourly_rate">
                            {tt("Hours × rate", "Horas × tarifa")}
                          </option>
                          <option value="quantity_unit_cost">
                            {tt(
                              "Quantity × unit cost",
                              "Cantidad × costo unitario",
                            )}
                          </option>
                          <option value="fixed_amount">
                            {tt("Fixed amount", "Monto fijo")}
                          </option>
                        </select>
                      </label>
                      {apu.method === "hours_hourly_rate" && (
                        <>
                          <label>
                            {tt("Hours", "Horas")}
                            <input
                              inputMode="decimal"
                              value={apu.hours}
                              disabled={locked}
                              onChange={(e) =>
                                update(apu.id, { hours: e.target.value })
                              }
                            />
                          </label>
                          <label>
                            {tt("Hourly rate", "Tarifa por hora")}
                            <input
                              inputMode="decimal"
                              value={apu.hourlyRate}
                              disabled={locked}
                              onChange={(e) =>
                                update(apu.id, {
                                  hourlyRate: e.target.value,
                                  rateProvenance: "user_entered",
                                })
                              }
                            />
                          </label>
                        </>
                      )}
                      {apu.method === "quantity_unit_cost" && (
                        <>
                          <label>
                            {tt("Quantity", "Cantidad")}
                            <input
                              inputMode="decimal"
                              value={apu.quantity}
                              disabled={locked}
                              onChange={(e) =>
                                update(apu.id, { quantity: e.target.value })
                              }
                            />
                          </label>
                          <label>
                            {tt("Unit cost", "Costo unitario")}
                            <input
                              inputMode="decimal"
                              value={apu.unitCost}
                              disabled={locked}
                              onChange={(e) =>
                                update(apu.id, { unitCost: e.target.value })
                              }
                            />
                          </label>
                        </>
                      )}
                      {apu.method === "fixed_amount" && (
                        <label>
                          {tt("Fixed amount", "Monto fijo")}
                          <input
                            inputMode="decimal"
                            value={apu.fixedAmount}
                            disabled={locked}
                            onChange={(e) =>
                              update(apu.id, { fixedAmount: e.target.value })
                            }
                          />
                        </label>
                      )}
                      <div className="total">
                        <small>
                          {tt("Calculated price", "Precio calculado")}
                        </small>
                        <strong>
                          {apu.currency} {total(apu).toFixed(2)}
                        </strong>
                      </div>
                    </div>
                    <footer>
                      <small>
                        {apu.rateProvenance === "portfolio_default"
                          ? tt(
                              "Suggested portfolio default — editable, not authority",
                              "Valor sugerido del portafolio — editable, no es autoridad",
                            )
                          : tt(
                              "User-entered value",
                              "Valor ingresado por usuario",
                            )}
                      </small>
                      {!locked && (
                        <button
                          aria-label={tt("Delete APU", "Eliminar APU")}
                          type="button"
                          onClick={() => remove(apu.id)}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </footer>
                  </article>
                );
              })}
            </div>
          </div>
        );
      })}
      <div className="authority-note">
        <strong>{tt("Version rule", "Regla de versión")}</strong>{" "}
        {tt(
          "Approval creates an immutable canonical Generic APU version. Editing never overwrites an approved version; it starts the next draft.",
          "La aprobación crea una versión canónica e inmutable de APU Genérico. Editar nunca sobrescribe una versión aprobada; inicia el siguiente borrador.",
        )}
      </div>
    </section>
  );
}
const css = `.apu-builder{margin:18px 0;padding:22px;border:1px solid #b8ddd5;border-radius:20px;background:#f7fcfa;color:#15342f}.apu-builder header,.agreement-head,.card-top,.apu-builder footer{display:flex;justify-content:space-between;gap:16px;align-items:center}.apu-builder h2{margin:4px 0 6px;font-size:24px}.apu-builder p{margin:0;max-width:760px;color:#49645f}.eyebrow{font-size:11px;font-weight:800;letter-spacing:.15em;color:#087d6e}.count{background:#dff5ef;padding:7px 12px;border-radius:999px;font-weight:800}.agreement{margin-top:18px;padding:16px;border:1px solid #d2e7e2;border-radius:16px;background:white}.agreement-head small{display:block;color:#607773}.template-actions{display:flex;gap:8px;flex-wrap:wrap}.template-actions button,.apu-builder footer button{display:inline-flex;align-items:center;gap:6px;border:1px solid #9bcfc4;background:#eef9f6;border-radius:9px;padding:8px 10px;font-weight:700}.empty{margin-top:12px;padding:18px;text-align:center;background:#f4f8f7;border-radius:10px;color:#607773}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:12px;margin-top:12px}.cards article{border:1px solid #cfe1dd;border-radius:12px;padding:14px;background:#fff}.cards article.locked{background:#f3f5f4}.card-top input{font-size:16px;font-weight:800;border:0;border-bottom:1px solid #d6e4e1;min-width:0;width:60%}.card-top span{font-size:11px;font-weight:800;color:#087d6e}.fields{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:14px}.fields label{font-size:12px;font-weight:700}.fields input,.fields select{display:block;width:100%;box-sizing:border-box;margin-top:5px;padding:9px;border:1px solid #bfd4cf;border-radius:8px;background:white}.total{grid-column:1/-1;background:#eaf7f3;border-radius:9px;padding:10px}.total small,.total strong{display:block}.total strong{font-size:20px}.apu-builder footer{margin-top:12px;color:#657873}.authority-note{margin-top:14px;padding:12px 14px;border-left:4px solid #079783;background:#e9f8f4;border-radius:8px}@media(max-width:620px){.apu-builder{padding:14px}.apu-builder header,.agreement-head{align-items:flex-start;flex-direction:column}.template-actions{width:100%}.template-actions button{flex:1;justify-content:center}.fields{grid-template-columns:1fr}.total{grid-column:1}.cards{grid-template-columns:1fr}}`;
