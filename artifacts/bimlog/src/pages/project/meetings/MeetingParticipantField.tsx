export function MeetingParticipantField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "tel";
}) {
  return (
    <td
      style={{
        border: "1px solid #E5E7EB",
        padding: "6px 8px",
        fontSize: 12,
        verticalAlign: "middle",
      }}
    >
      <input
        type={type}
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{
          border: "none",
          outline: "none",
          width: "100%",
          fontSize: 12,
          background: "transparent",
        }}
      />
    </td>
  );
}
