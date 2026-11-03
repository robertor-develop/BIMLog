import { useState } from "react";
import type { AdminSupportCase } from "@/lib/support-case-admin-client";
const API_BASE = import.meta.env.VITE_API_URL ?? "";
const scopes = [
  "nonessential_profile_processing",
  "product_analytics",
  "ai_assistance_context",
] as const;
export function AdminSupportDataRequestActions({
  item,
  token,
  es,
  onChanged,
}: {
  item: AdminSupportCase;
  token: string;
  es: boolean;
  onChanged: () => Promise<void>;
}) {
  const [reason, setReason] = useState(""),
    [receipt, setReceipt] = useState(""),
    [field, setField] = useState("fullName"),
    [value, setValue] = useState(""),
    [selectedScopes, setSelectedScopes] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  if (item.category !== "data" || !item.dataRequestKind) return null;
  const request = async (
    path: string,
    method: "PATCH" | "POST",
    body: Record<string, unknown>,
  ) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
          `${API_BASE}/api/v1/admin/support/cases/${item.id}/${path}`,
          {
            method,
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          },
        ),
        payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          String(payload.code || payload.error || "REQUEST_FAILED"),
        );
      setMessage(
        es
          ? "La acción quedó registrada con evidencia."
          : "The action was recorded with evidence.",
      );
      await onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };
  const base = { expectedUpdatedAt: item.updatedAt },
    review = (state: string) =>
      request("data-request", "PATCH", {
        ...base,
        kind: item.dataRequestKind,
        expectedState: item.dataRequestState,
        state,
        reason,
      }),
    fulfill = () =>
      request("data-request/fulfillment", "POST", {
        ...base,
        kind: item.dataRequestKind,
        expectedState: item.dataRequestState,
        receiptReference: receipt,
        summary: reason,
      }),
    correct = () =>
      request("data-request/correction", "POST", {
        ...base,
        field,
        value,
        reason,
        receiptReference: receipt,
      }),
    restrict = () =>
      request("data-request/restriction", "POST", {
        ...base,
        scopes: selectedScopes,
        reason,
        receiptReference: receipt,
      });
  const actionable =
    item.assignedToCurrentUser &&
    !["denied", "fulfilled"].includes(item.dataRequestState ?? "");
  return (
    <section
      aria-label={
        es ? "Acciones de solicitud de datos" : "Data request actions"
      }
      style={{
        border: "1px solid #cbd5e1",
        borderRadius: 8,
        padding: 12,
        margin: "12px 0",
      }}
    >
      <strong>
        {es ? "Solicitud de datos" : "Data request"}: {item.dataRequestKind} ·{" "}
        {item.dataRequestState}
      </strong>
      {!actionable && (
        <p role="status">
          {es
            ? "Asígnese el caso para revisar o cumplir esta solicitud."
            : "Assign the case to yourself to review or fulfill this request."}
        </p>
      )}
      {actionable && (
        <>
          <label style={{ display: "grid", gap: 4 }}>
            {es ? "Motivo / resumen de evidencia" : "Reason / evidence summary"}
            <textarea
              minLength={10}
              maxLength={2000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          {item.dataRequestState === "requested" && (
            <button
              disabled={busy || reason.trim().length < 10}
              onClick={() => void review("under_review")}
            >
              {es ? "Iniciar revisión" : "Start review"}
            </button>
          )}
          {item.dataRequestState === "under_review" && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {["approved", "partially_approved", "denied"].map((state) => (
                <button
                  key={state}
                  disabled={busy || reason.trim().length < 10}
                  onClick={() => void review(state)}
                >
                  {state.replaceAll("_", " ")}
                </button>
              ))}
            </div>
          )}
          {["approved", "partially_approved"].includes(
            item.dataRequestState ?? "",
          ) && (
            <>
              <label>
                {es ? "Referencia del comprobante" : "Receipt reference"}
                <input
                  value={receipt}
                  onChange={(event) => setReceipt(event.target.value)}
                />
              </label>
              {item.dataRequestKind === "correction" && (
                <>
                  <label>
                    {es ? "Campo" : "Field"}
                    <select
                      value={field}
                      onChange={(event) => setField(event.target.value)}
                    >
                      {["fullName", "jobTitle", "phone"].map((entry) => (
                        <option key={entry}>{entry}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {es ? "Valor corregido" : "Corrected value"}
                    <input
                      value={value}
                      onChange={(event) => setValue(event.target.value)}
                    />
                  </label>
                  <button
                    disabled={
                      busy ||
                      reason.trim().length < 10 ||
                      receipt.length < 6 ||
                      !value.trim()
                    }
                    onClick={() => void correct()}
                  >
                    {es ? "Aplicar corrección" : "Apply correction"}
                  </button>
                </>
              )}
              {item.dataRequestKind === "restriction" && (
                <>
                  <fieldset>
                    <legend>
                      {es ? "Alcances restringidos" : "Restricted scopes"}
                    </legend>
                    {scopes.map((scope) => (
                      <label key={scope}>
                        <input
                          type="checkbox"
                          checked={selectedScopes.includes(scope)}
                          onChange={(event) =>
                            setSelectedScopes((current) =>
                              event.target.checked
                                ? [...current, scope]
                                : current.filter((value) => value !== scope),
                            )
                          }
                        />
                        {scope.replaceAll("_", " ")}
                      </label>
                    ))}
                  </fieldset>
                  <button
                    disabled={
                      busy ||
                      reason.trim().length < 10 ||
                      receipt.length < 6 ||
                      selectedScopes.length === 0
                    }
                    onClick={() => void restrict()}
                  >
                    {es ? "Aplicar restricción" : "Apply restriction"}
                  </button>
                </>
              )}
              {!["correction", "restriction"].includes(
                item.dataRequestKind,
              ) && (
                <button
                  disabled={
                    busy || reason.trim().length < 10 || receipt.length < 6
                  }
                  onClick={() => void fulfill()}
                >
                  {es ? "Registrar cumplimiento" : "Record fulfillment"}
                </button>
              )}
            </>
          )}
        </>
      )}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
