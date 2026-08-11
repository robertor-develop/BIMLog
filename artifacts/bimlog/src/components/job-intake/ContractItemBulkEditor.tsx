import { useState } from "react";
import { ClipboardPaste, Plus, Trash2 } from "lucide-react";

type Translate = (en: string, es: string) => string;

type Props = {
  items: any[];
  setItems: (updater: (items: any[]) => any[]) => void;
  currency: string;
  defaultRate: string;
  defaultApuVersion: number | null;
  defaultWorkflow: string;
  capabilities: { costValuePlanner: boolean; budget: boolean };
  contracts: any[];
  defaultContractId: string;
  budgetSnapshotId: string;
  budgetLines: any[];
  onBudgetSnapshotChange: (id: string) => void;
  snapshots: any[];
  tt: Translate;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
};

const MAX_ITEMS = 500;

function newItem(
  props: Pick<
    Props,
    | "defaultRate"
    | "defaultApuVersion"
    | "defaultWorkflow"
    | "defaultContractId"
  >,
) {
  return {
    id: `CI-${crypto.randomUUID()}`,
    name: "",
    description: "",
    plannedHours: "1",
    billingHourlyRate: props.defaultRate || "0",
    unit: "Hours",
    apuPlanVersion: props.defaultApuVersion,
    workflowTemplate: props.defaultWorkflow,
    contractId: props.defaultContractId,
    budgetSnapshotLineId: "",
    projectCostNodeId: "",
    scheduleItemPlacementId: null,
    assumptions: "",
    exclusions: "",
    provenance: null,
  };
}

function scaled(value: unknown) {
  const text = String(value ?? "0").trim();
  if (!/^\d+(?:\.\d{1,6})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
}

function exactProduct(quantity: unknown, rate: unknown) {
  const q = scaled(quantity),
    r = scaled(rate);
  if (q == null || r == null) return "—";
  const product = (q * r + 500_000n) / 1_000_000n;
  const whole = product / 1_000_000n;
  const fraction = String(product % 1_000_000n)
    .padStart(6, "0")
    .replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : String(whole);
}

function validQuantity(value: string) {
  const parsed = scaled(value);
  return parsed != null && parsed > 0n;
}

export function parseContractItemPaste(source: string) {
  return source
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line, index) => {
      const cells = line.split("\t");
      return {
        sourceRow: index + 1,
        name: String(cells[0] ?? "").trim(),
        quantity: String(cells[1] ?? "").trim(),
      };
    })
    .filter((row) => row.name || row.quantity);
}

export function ContractItemBulkEditor(props: Props) {
  const [bulkQuantity, setBulkQuantity] = useState("");
  const update = (index: number, patch: Record<string, unknown>) =>
    props.setItems((items) =>
      items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  const add = () => {
    if (props.items.length >= MAX_ITEMS) {
      props.onError(
        props.tt(
          "The Intake accepts up to 500 Contract Items.",
          "El Ingreso acepta hasta 500 Partidas de Contrato.",
        ),
      );
      return;
    }
    props.setItems((items) => [...items, newItem(props)]);
  };
  const paste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    event.preventDefault();
    const source = event.clipboardData.getData("text/plain");
    const parsed = parseContractItemPaste(source);
    const invalid = parsed.filter(
      (row) => !row.name || !validQuantity(row.quantity),
    );
    if (!parsed.length || invalid.length) {
      const invalidRows = invalid
        .slice(0, 10)
        .map((row) => row.sourceRow)
        .join(", ");
      const rowDetail = invalidRows
        ? props.tt(
            ` Check row(s): ${invalidRows}.`,
            ` Revise la(s) fila(s): ${invalidRows}.`,
          )
        : "";
      props.onError(
        props.tt(
          `Paste two Excel columns: Contract Item Name and a positive Quantity. ${invalid.length || 1} row(s) need correction.`,
          `Pegue dos columnas de Excel: Nombre de la Partida y una Cantidad positiva. ${invalid.length || 1} fila(s) requieren corrección.`,
        ) + rowDetail,
      );
      return;
    }
    if (props.items.length + parsed.length > MAX_ITEMS) {
      props.onError(
        props.tt(
          "Pasting these rows would exceed the 500-item Intake limit.",
          "Pegar estas filas superaría el límite de 500 partidas del Ingreso.",
        ),
      );
      return;
    }
    props.setItems((items) => [
      ...items,
      ...parsed.map((row) => ({
        ...newItem(props),
        name: row.name,
        plannedHours: row.quantity,
        provenance: { source: "clipboard", sourceRow: row.sourceRow },
      })),
    ]);
    props.onNotice(
      props.tt(
        `${parsed.length} pasted Contract Items added.`,
        `Se agregaron ${parsed.length} Partidas de Contrato pegadas.`,
      ),
    );
  };
  const applyBulkQuantity = () => {
    if (!validQuantity(bulkQuantity)) {
      props.onError(
        props.tt(
          "Enter a positive bulk Quantity.",
          "Ingrese una Cantidad masiva positiva.",
        ),
      );
      return;
    }
    props.setItems((items) =>
      items.map((item) => ({ ...item, plannedHours: bulkQuantity })),
    );
    props.onNotice(
      props.tt(
        "Quantity updated for every Contract Item.",
        "Se actualizó la Cantidad de todas las Partidas de Contrato.",
      ),
    );
  };

  return (
    <div className="ji-bulk">
      <style>{bulkCss}</style>
      <div className="ji-bulk-tools">
        <div>
          <strong>
            {props.tt(
              "Bulk Contract Item editor",
              "Editor masivo de Partidas de Contrato",
            )}
          </strong>
          <p>
            {props.tt(
              "The default grid shows only Contract Item Name and Quantity. IDs and inherited commercial/workflow values stay under Advanced.",
              "La cuadrícula predeterminada muestra solamente Nombre de la Partida y Cantidad. Los IDs y valores comerciales/de flujo heredados permanecen en Avanzado.",
            )}
          </p>
        </div>
        <span>
          {props.items.length}/{MAX_ITEMS}
        </span>
      </div>
      <div className="ji-bulk-actions">
        <label className="ji-paste">
          <ClipboardPaste size={16} />
          <span>
            {props.tt("Paste Excel range", "Pegar rango de Excel")}
            <small>
              {props.tt(
                "Name in column 1, Quantity in column 2",
                "Nombre en columna 1, Cantidad en columna 2",
              )}
            </small>
          </span>
          <textarea
            aria-label={props.tt(
              "Paste Contract Item Name and Quantity columns",
              "Pegue columnas de Nombre y Cantidad de Partidas",
            )}
            onPaste={paste}
            value=""
            onChange={() => undefined}
          />
        </label>
        <label>
          {props.tt("Set every Quantity", "Establecer todas las Cantidades")}
          <input
            inputMode="decimal"
            value={bulkQuantity}
            onChange={(event) => setBulkQuantity(event.target.value)}
          />
        </label>
        <button type="button" onClick={applyBulkQuantity}>
          {props.tt("Apply to all rows", "Aplicar a todas las filas")}
        </button>
        <button type="button" onClick={add}>
          <Plus size={14} /> {props.tt("Add row", "Agregar fila")}
        </button>
      </div>
      {props.capabilities.budget && (
        <label className="ji-bulk-budget">
          {props.tt(
            "Inherited approved budget snapshot",
            "Versión aprobada del presupuesto heredada",
          )}
          <select
            value={props.budgetSnapshotId}
            onChange={(event) =>
              props.onBudgetSnapshotChange(event.target.value)
            }
          >
            <option value="">
              {props.tt("Select version", "Seleccione una versión")}
            </option>
            {props.snapshots.map((snapshot: any) => (
              <option key={snapshot.id} value={snapshot.id}>
                v{snapshot.budgetVersion || snapshot.version} · {snapshot.total}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="ji-bulk-head" aria-hidden="true">
        <span>#</span>
        <span>
          {props.tt("Contract Item Name", "Nombre de la Partida de Contrato")}
        </span>
        <span>{props.tt("Quantity", "Cantidad")}</span>
        <span>{props.tt("Actions", "Acciones")}</span>
      </div>
      {props.items.length === 0 && (
        <div className="ji-bulk-empty">
          {props.tt(
            "No Contract Items yet. Add a row, paste an Excel range, or map a preserved spreadsheet source.",
            "Aún no hay Partidas de Contrato. Agregue una fila, pegue un rango de Excel o mapee una hoja preservada.",
          )}
        </div>
      )}
      {props.items.map((item, index) => (
        <div className="ji-bulk-row" key={item.id}>
          <span className="ji-bulk-number">{index + 1}</span>
          <label>
            <span className="ji-mobile-label">
              {props.tt("Contract Item Name", "Nombre de la Partida")}
            </span>
            <input
              value={item.name}
              onChange={(event) => update(index, { name: event.target.value })}
              aria-label={props.tt(
                `Contract Item Name row ${index + 1}`,
                `Nombre de la Partida fila ${index + 1}`,
              )}
            />
          </label>
          <label>
            <span className="ji-mobile-label">
              {props.tt("Quantity", "Cantidad")}
            </span>
            <input
              inputMode="decimal"
              value={item.plannedHours}
              onChange={(event) =>
                update(index, { plannedHours: event.target.value })
              }
              aria-label={props.tt(
                `Quantity row ${index + 1}`,
                `Cantidad fila ${index + 1}`,
              )}
            />
          </label>
          <button
            className="danger"
            type="button"
            onClick={() =>
              props.setItems((items) => items.filter((_, i) => i !== index))
            }
            aria-label={props.tt(
              `Remove row ${index + 1}`,
              `Eliminar fila ${index + 1}`,
            )}
          >
            <Trash2 size={14} />
          </button>
          <details className="ji-advanced">
            <summary>
              {props.tt(
                `Advanced overrides for row ${index + 1}${item.name ? `: ${item.name}` : ""}`,
                `Opciones avanzadas para la fila ${index + 1}${item.name ? `: ${item.name}` : ""}`,
              )}
            </summary>
            <div className="ji-grid three">
              <label>
                {props.tt("Contract profile", "Perfil de contrato")}
                <select
                  value={item.contractId || props.defaultContractId}
                  aria-label={props.tt(
                    `Contract profile row ${index + 1}`,
                    `Perfil de contrato fila ${index + 1}`,
                  )}
                  onChange={(event) =>
                    update(index, { contractId: event.target.value })
                  }
                >
                  {props.contracts.map((contract) => (
                    <option key={contract.id} value={contract.id}>
                      {contract.contractNumber ||
                        contract.counterpartyName ||
                        props.tt("Draft contract", "Contrato borrador")}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {props.tt("Contract Item ID", "ID de Partida de Contrato")}
                <input
                  value={item.id}
                  readOnly
                  aria-label={props.tt(
                    `Contract Item ID row ${index + 1}`,
                    `ID de Partida de Contrato fila ${index + 1}`,
                  )}
                />
              </label>
              <label>
                {props.tt("Unit", "Unidad")}
                <input
                  value={item.unit}
                  aria-label={props.tt(
                    `Unit row ${index + 1}`,
                    `Unidad fila ${index + 1}`,
                  )}
                  onChange={(event) =>
                    update(index, { unit: event.target.value })
                  }
                />
              </label>
              {props.capabilities.costValuePlanner && (
                <>
                  <label>
                    {props.tt(
                      "Inherited APU unit rate",
                      "Tarifa unitaria APU heredada",
                    )}
                    <input
                      inputMode="decimal"
                      value={item.billingHourlyRate}
                      aria-label={props.tt(
                        `Inherited APU unit rate row ${index + 1}`,
                        `Tarifa unitaria APU heredada fila ${index + 1}`,
                      )}
                      onChange={(event) =>
                        update(index, { billingHourlyRate: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    {props.tt("Calculated value", "Valor calculado")}
                    <input
                      value={`${exactProduct(item.plannedHours, item.billingHourlyRate)} ${props.currency}`}
                      readOnly
                      aria-label={props.tt(
                        `Calculated value row ${index + 1}`,
                        `Valor calculado fila ${index + 1}`,
                      )}
                    />
                  </label>
                  <label>
                    {props.tt("APU version", "Versión APU")}
                    <input
                      value={
                        item.apuPlanVersion ? `v${item.apuPlanVersion}` : "—"
                      }
                      readOnly
                      aria-label={props.tt(
                        `APU version row ${index + 1}`,
                        `Versi\u00f3n APU fila ${index + 1}`,
                      )}
                    />
                  </label>
                </>
              )}
              <label>
                {props.tt("Workflow", "Flujo")}
                <select
                  value={item.workflowTemplate || props.defaultWorkflow}
                  aria-label={props.tt(
                    `Workflow row ${index + 1}`,
                    `Flujo fila ${index + 1}`,
                  )}
                  onChange={(event) =>
                    update(index, { workflowTemplate: event.target.value })
                  }
                >
                  <option value="generic">
                    {props.tt(
                      "Generic configurable workflow",
                      "Flujo genérico configurable",
                    )}
                  </option>
                  <option value="bim-submittal">
                    {props.tt(
                      "BIM delivery (display alias: Submittal)",
                      "Entrega BIM (alias visible: Submittal)",
                    )}
                  </option>
                </select>
              </label>
              {props.capabilities.budget && (
                <label>
                  {props.tt("Budget line", "Línea presupuestaria")}
                  <select
                    value={item.budgetSnapshotLineId}
                    aria-label={props.tt(
                      `Budget line row ${index + 1}`,
                      `L\u00ednea presupuestaria fila ${index + 1}`,
                    )}
                    onChange={(event) => {
                      const line = props.budgetLines.find(
                        (entry: any) => String(entry.id) === event.target.value,
                      );
                      update(index, {
                        budgetSnapshotLineId: event.target.value,
                        projectCostNodeId: line?.project_cost_node_id || "",
                      });
                    }}
                  >
                    <option value="">
                      {props.tt("Select line", "Seleccione una línea")}
                    </option>
                    {props.budgetLines.map((line: any) => (
                      <option key={line.id} value={line.id}>
                        {line.project_code} · {line.project_name} ·{" "}
                        {line.amount}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                {props.tt("Description", "Descripción")}
                <textarea
                  value={item.description}
                  aria-label={props.tt(
                    `Description row ${index + 1}`,
                    `Descripci\u00f3n fila ${index + 1}`,
                  )}
                  onChange={(event) =>
                    update(index, { description: event.target.value })
                  }
                />
              </label>
              <label>
                {props.tt("Assumptions", "Supuestos")}
                <textarea
                  value={item.assumptions}
                  aria-label={props.tt(
                    `Assumptions row ${index + 1}`,
                    `Supuestos fila ${index + 1}`,
                  )}
                  onChange={(event) =>
                    update(index, { assumptions: event.target.value })
                  }
                />
              </label>
              <label>
                {props.tt("Exclusions", "Exclusiones")}
                <textarea
                  value={item.exclusions}
                  aria-label={props.tt(
                    `Exclusions row ${index + 1}`,
                    `Exclusiones fila ${index + 1}`,
                  )}
                  onChange={(event) =>
                    update(index, { exclusions: event.target.value })
                  }
                />
              </label>
            </div>
            {item.provenance && (
              <p className="ji-provenance">
                {props.tt("Source", "Fuente")}:{" "}
                {item.provenance.fileName ||
                  props.tt("Pasted range", "Rango pegado")}{" "}
                {item.provenance.sheetName
                  ? `· ${item.provenance.sheetName}`
                  : ""}{" "}
                {item.provenance.sourceRow
                  ? `· ${props.tt("row", "fila")} ${item.provenance.sourceRow}`
                  : ""}{" "}
                {item.provenance.sourceHash
                  ? `· SHA ${String(item.provenance.sourceHash).slice(0, 12)}…`
                  : ""}
              </p>
            )}
          </details>
        </div>
      ))}
    </div>
  );
}

const bulkCss = `.ji-bulk{margin-top:14px}.ji-bulk-tools{display:flex;justify-content:space-between;gap:12px;padding:12px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px}.ji-bulk-tools p{margin:4px 0 0;font-size:12px}.ji-bulk-tools>span{font-weight:800;color:#1d4ed8}.ji-bulk-actions{display:flex;align-items:end;gap:8px;flex-wrap:wrap;margin:12px 0}.ji-bulk-actions>label{min-width:180px}.ji-paste{position:relative;display:flex!important;grid-template-columns:20px 1fr!important;align-items:center;min-width:260px;padding:8px 10px;border:1px dashed #2563eb;border-radius:8px;color:#1d4ed8!important}.ji-paste:focus-within{outline:3px solid #93c5fd;outline-offset:2px}.ji-paste small{display:block;font-weight:400}.ji-paste textarea{position:absolute;inset:0;opacity:0;cursor:copy;resize:none}.ji-bulk-budget{max-width:420px;margin-bottom:12px}.ji-bulk-head,.ji-bulk-row{display:grid;grid-template-columns:42px minmax(240px,1fr) 150px 46px;gap:8px;align-items:center}.ji-bulk-head{padding:7px 10px;background:#e2e8f0;border-radius:8px 8px 0 0;font-size:11px;font-weight:800;color:#475569}.ji-bulk-row{padding:8px 10px;border:1px solid #e2e8f0;border-top:0;background:#fff}.ji-bulk-row label{min-width:0}.ji-bulk-number{font-variant-numeric:tabular-nums;color:#64748b}.ji-mobile-label{display:none}.ji-advanced{grid-column:2/-1}.ji-advanced summary{cursor:pointer;color:#1d4ed8;font-size:12px;font-weight:700;padding:5px 0}.ji-advanced .ji-grid{margin-top:8px}.ji-provenance{font-size:11px;margin:8px 0 0}.ji-bulk-empty{padding:24px;border:1px dashed #94a3b8;border-radius:8px;text-align:center;color:#64748b}@media(max-width:600px){.ji-bulk-tools{display:block}.ji-bulk-tools>span{display:block;margin-top:8px}.ji-bulk-actions>*{width:100%}.ji-bulk-head{display:none}.ji-bulk-row{grid-template-columns:32px minmax(0,1fr);padding:12px 8px;border-top:1px solid #e2e8f0;margin-top:8px;border-radius:8px}.ji-bulk-row>label,.ji-bulk-row>button{grid-column:2}.ji-mobile-label{display:block}.ji-advanced{grid-column:1/-1}.ji-paste{min-width:0}}`;
