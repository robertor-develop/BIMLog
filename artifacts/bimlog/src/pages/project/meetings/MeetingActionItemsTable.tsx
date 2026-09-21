import { AlertTriangle, CheckCircle2 } from "lucide-react";

export interface MeetingActionItem {
  id: number;
  description: string;
  assignedToName?: string;
  dueDate?: string;
  status: string;
  isOverdue?: boolean;
}

type Translate = (english: string, spanish: string) => string;

export function MeetingActionItemsTable({
  items,
  canWrite,
  statusLabel,
  t,
  onComplete,
}: {
  items: MeetingActionItem[];
  canWrite: boolean;
  statusLabel: (status: string) => string;
  t: Translate;
  onComplete: (id: number) => void;
}) {
  if (items.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 60, color: "#9CA3AF" }}>
        <CheckCircle2
          size={40}
          color="#D1D5DB"
          style={{ display: "block", margin: "0 auto 12px" }}
        />
        <div style={{ fontWeight: 600 }}>
          {t("No action items yet", "Sin acciones aún")}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "white",
        border: "1px solid #E5E7EB",
        borderRadius: 10,
        overflowX: "auto",
      }}
    >
      <table style={{ width: "100%", minWidth: 680, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#F9FAFB" }}>
            {[
              t("Description", "Descripción"),
              t("Assigned To", "Asignado"),
              t("Due Date", "Fecha"),
              t("Status", "Estado"),
              "",
            ].map((heading) => (
              <th
                key={heading}
                scope="col"
                style={{
                  padding: "10px 12px",
                  fontSize: 11,
                  fontWeight: 700,
                  textAlign: "left",
                  color: "#6B7280",
                  borderBottom: "1px solid #E5E7EB",
                  textTransform: "uppercase",
                }}
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              data-meeting-action-id={item.id}
              style={{
                background: item.isOverdue ? "#FEF2F2" : "white",
                borderBottom: "1px solid #F3F4F6",
              }}
            >
              <td style={{ padding: "10px 12px" }}>
                <div style={{ fontWeight: 500, fontSize: 13 }}>
                  {item.description}
                </div>
                {item.isOverdue && (
                  <div
                    style={{
                      fontSize: 11,
                      color: "#DC2626",
                      display: "flex",
                      alignItems: "center",
                      gap: 3,
                      marginTop: 2,
                    }}
                  >
                    <AlertTriangle size={10} aria-hidden="true" />
                    {t("Overdue", "Vencido")}
                  </div>
                )}
              </td>
              <td style={{ padding: "10px 12px", fontSize: 13 }}>
                {item.assignedToName || "?"}
              </td>
              <td style={{ padding: "10px 12px", fontSize: 12, color: "#6B7280" }}>
                {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : "?"}
              </td>
              <td style={{ padding: "10px 12px" }}>
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: 20,
                    fontSize: 11,
                    fontWeight: 600,
                    background:
                      item.status === "completed"
                        ? "#DCFCE7"
                        : item.isOverdue
                          ? "#FEE2E2"
                          : "#FEF3C7",
                    color:
                      item.status === "completed"
                        ? "#16A34A"
                        : item.isOverdue
                          ? "#DC2626"
                          : "#D97706",
                  }}
                >
                  {statusLabel(item.status)}
                </span>
              </td>
              <td style={{ padding: "10px 12px" }}>
                {canWrite && item.status !== "completed" && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => onComplete(item.id)}
                  >
                    {t("Done", "Listo")}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
