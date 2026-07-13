import { RfiCanonicalForm } from "./RfisTab";

type HarnessState = {
  slug: string;
  mode: "create" | "view" | "edit";
  recordState: "new" | "draft" | "sent" | "closed" | "reopened" | "revised";
  subject: string;
  status: string;
  hasViewpoint?: boolean;
  canRespond?: boolean;
  costImpact: string;
  scheduleImpact: string;
};

export const rfiCanonicalUiHarnessStates: HarnessState[] = [
  { slug: "new-rfi", mode: "create", recordState: "new", subject: "New RFI", status: "draft", costImpact: "Cost Increase TBD", scheduleImpact: "Increase in Calendar Days" },
  { slug: "viewpoint-created-rfi", mode: "create", recordState: "new", subject: "Viewpoint-created RFI", status: "draft", hasViewpoint: true, costImpact: "Cost Increase Known", scheduleImpact: "Increase in Calendar Days" },
  { slug: "existing-draft-rfi", mode: "view", recordState: "draft", subject: "Existing draft RFI", status: "open", costImpact: "No Cost Impact", scheduleImpact: "No Schedule Impact" },
  { slug: "existing-draft-edit-rfi", mode: "edit", recordState: "draft", subject: "Existing draft RFI - Edit", status: "open", costImpact: "Cost Increase Known", scheduleImpact: "Increase in Calendar Days" },
  { slug: "sent-rfi", mode: "view", recordState: "sent", subject: "Sent RFI", status: "open", hasViewpoint: true, canRespond: true, costImpact: "Cost Decrease", scheduleImpact: "Decrease in Calendar Days" },
  { slug: "sent-edit-rfi", mode: "edit", recordState: "sent", subject: "Sent RFI - Edit", status: "open", hasViewpoint: true, canRespond: true, costImpact: "Cost Decrease", scheduleImpact: "Decrease in Calendar Days" },
  { slug: "closed-rfi", mode: "view", recordState: "closed", subject: "Closed RFI", status: "closed", hasViewpoint: true, costImpact: "Cost Increase Known", scheduleImpact: "No Schedule Impact" },
  { slug: "closed-edit-rfi", mode: "edit", recordState: "closed", subject: "Closed RFI - Edit", status: "closed", hasViewpoint: true, costImpact: "Cost Increase TBD", scheduleImpact: "No Schedule Impact" },
  { slug: "reopened-rfi", mode: "view", recordState: "reopened", subject: "Reopened RFI", status: "open", canRespond: true, costImpact: "Cost Increase TBD", scheduleImpact: "Increase in Calendar Days" },
  { slug: "reopened-edit-rfi", mode: "edit", recordState: "reopened", subject: "Reopened RFI - Edit", status: "open", canRespond: true, costImpact: "Cost Increase TBD", scheduleImpact: "Increase in Calendar Days" },
];

const noop = () => {};

export function RfiCanonicalUiHarness({ state }: { state: HarnessState }) {
  return (
    <RfiCanonicalForm
      lang="en"
      mode={state.mode}
      recordState={state.recordState}
      values={{
        number: state.recordState === "new" ? undefined : "RFI-0081",
        projectName: "River Avenue East",
        subject: state.subject,
        status: state.status,
        priority: "high",
        rfiType: "Coordination",
        dateRequested: "2026-07-13",
        dateRequired: "2026-07-20",
        daysOutstanding: state.recordState === "new" ? "" : "4d",
        dateAnswered: state.recordState === "closed" ? "2026-07-18" : "",
        submittedByCompany: "BIMCorp Inc",
        submittedByContact: "Roberto Test 1",
        submittedByAddress: "123 Project Office, New York, NY",
        submittedByPhone: "+1 555 0100",
        submittedByEmail: "roberto@bimcorpinc.com",
        submittedToCompany: "Design Partner LLC",
        submittedToPerson: "Jane Reviewer",
        submittedToAddress: "Project directory address",
        submittedToPhone: "+1 555 0200",
        submittedToEmail: "jane@design.example",
        drawingNumber: "A-401",
        drawingTitle: "B1 Fire Protection",
        specSection: "05 12 00",
        detailNumber: "5/A-301",
        noteNumber: "Note 3",
        locationDescription: "B1 Fire Protection, Grid B2",
        referenceInput: "",
        question: "Clarify the fire protection coordination conflict at B1 before fabrication.",
        costImpact: state.costImpact,
        costImpactAmount: state.costImpact === "No Cost Impact" || state.costImpact === "Cost Increase TBD" ? "" : "$12,500",
        costImpactReason: state.costImpact === "No Cost Impact" ? "" : "Coordination change under review.",
        scheduleImpact: state.scheduleImpact,
        scheduleImpactDays: state.scheduleImpact === "No Schedule Impact" ? "" : "5",
        scheduleImpactReason: state.scheduleImpact === "No Schedule Impact" ? "" : "Lead time and resequencing.",
        distributionList: ["Jane Reviewer", "PM Team", "BIM Coordinator"],
        emailDescription: "Please respond with detail SK and impact confirmation.",
        emailDraft: "Please review the RFI question and provide a coordinated response.",
        responseText: "",
      }}
      permissions={{ canEdit: true, canRespond: !!state.canRespond, canClose: state.recordState !== "closed", canReopen: state.recordState === "closed", canExport: state.recordState !== "new", canRaiseChangeOrder: state.recordState !== "new", canJumpViewpoint: !!state.hasViewpoint }}
      references={["SK-105 Rev2.pdf"]}
      attachments={["Grid B2 Field Photo.jpg"]}
      imagePresentation={state.hasViewpoint ? { sourceFileId: 99, includeInCompletePdf: true, crop: null } : null}
      packageItems={[{ key: "fixture:1", label: "SK-105 Rev2.pdf", include: true, order: 0 }]}
      responses={state.canRespond ? [{ text: "Official response controls visible when permitted.", by: "Reviewer" }] : []}
      actions={{ submit: noop, cancel: noop, "save-rfi": noop, "save-response": noop, edit: noop, close: noop, reopen: noop, "export-pdf": noop, "export-complete-pdf": noop, "export-docx": noop, "export-audit-pdf": noop, "jump-viewpoint": noop, "raise-change-order": noop }}
      onChange={noop}
      onAddReference={noop}
      onRemoveReference={noop}
      onUploadFile={noop}
      onGenerateQuestionAi={noop}
      onGenerateEmailAi={noop}
      onCopyEmail={noop}
    />
  );
}
