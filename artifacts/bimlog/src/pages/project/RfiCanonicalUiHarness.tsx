import {
  RfiSectionDistributionResponses,
  RfiSectionHeaderStatus,
  RfiSectionImpact,
  RfiSectionQuestion,
  RfiSectionReferencesAttachments,
  RfiSectionSubmittedBy,
  RfiSectionSubmittedTo,
} from "./RfisTab";

type HarnessState = {
  slug: string;
  title: string;
  mode: "create" | "view" | "edit";
  state: string;
  status: string;
  primaryAction: string;
  secondaryActions: string[];
  hasViewpoint?: boolean;
  cost: "No Cost Impact" | "Cost Increase TBD" | "Cost Increase Known" | "Cost Decrease";
  schedule: "No Schedule Impact" | "Increase in Calendar Days" | "Decrease in Calendar Days";
  responseAllowed: boolean;
};

export const rfiCanonicalUiHarnessStates: HarnessState[] = [
  { slug: "new-rfi", title: "New RFI", mode: "create", state: "New RFI", status: "Draft", primaryAction: "Submit RFI", secondaryActions: ["Cancel"], cost: "Cost Increase TBD", schedule: "Increase in Calendar Days", responseAllowed: false },
  { slug: "viewpoint-created-rfi", title: "Viewpoint-created RFI", mode: "create", state: "New RFI from Viewpoint", status: "Draft", primaryAction: "Submit RFI", secondaryActions: ["Cancel", "Jump to Viewpoint"], hasViewpoint: true, cost: "Cost Increase Known", schedule: "Increase in Calendar Days", responseAllowed: false },
  { slug: "existing-draft-rfi", title: "Existing draft RFI", mode: "view", state: "Existing RFI / Not sent", status: "Open", primaryAction: "Edit RFI", secondaryActions: ["RFI PDF", "Complete RFI PDF", "RFI DOCX", "RFI Audit PDF", "Close RFI", "Raise Change Order"], cost: "No Cost Impact", schedule: "No Schedule Impact", responseAllowed: false },
  { slug: "sent-rfi", title: "Sent RFI", mode: "view", state: "Existing RFI / Sent RFI", status: "Open", primaryAction: "Edit RFI", secondaryActions: ["RFI PDF", "Complete RFI PDF", "RFI DOCX", "RFI Audit PDF", "Close RFI", "Save Response", "Jump to Viewpoint", "Raise Change Order"], hasViewpoint: true, cost: "Cost Decrease", schedule: "Decrease in Calendar Days", responseAllowed: true },
  { slug: "closed-rfi", title: "Closed RFI", mode: "view", state: "Closed RFI", status: "Closed", primaryAction: "Reopen RFI", secondaryActions: ["Edit RFI", "RFI PDF", "Complete RFI PDF", "RFI DOCX", "RFI Audit PDF", "Jump to Viewpoint", "Raise Change Order"], hasViewpoint: true, cost: "Cost Increase Known", schedule: "No Schedule Impact", responseAllowed: false },
  { slug: "reopened-rfi", title: "Reopened RFI", mode: "view", state: "Reopened RFI", status: "Open", primaryAction: "Close RFI", secondaryActions: ["Edit RFI", "RFI PDF", "Complete RFI PDF", "RFI DOCX", "RFI Audit PDF", "Save Response", "Raise Change Order"], cost: "Cost Increase TBD", schedule: "Increase in Calendar Days", responseAllowed: true },
  { slug: "existing-edit-rfi", title: "Existing draft RFI - Edit", mode: "edit", state: "Existing RFI / Edit mode", status: "Open", primaryAction: "Save RFI", secondaryActions: ["Cancel"], cost: "Cost Increase Known", schedule: "Increase in Calendar Days", responseAllowed: false },
  { slug: "sent-edit-rfi", title: "Sent RFI - Edit", mode: "edit", state: "Sent RFI / Edit mode", status: "Open", primaryAction: "Save RFI", secondaryActions: ["Cancel", "Save Response"], hasViewpoint: true, cost: "Cost Decrease", schedule: "Decrease in Calendar Days", responseAllowed: true },
  { slug: "closed-edit-rfi", title: "Closed RFI - Edit", mode: "edit", state: "Closed RFI / Edit mode", status: "Closed", primaryAction: "Save RFI", secondaryActions: ["Cancel", "Reopen RFI"], hasViewpoint: true, cost: "Cost Increase TBD", schedule: "No Schedule Impact", responseAllowed: false },
];

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <div className={full ? "rfi-field full" : "rfi-field"}><span>{label}</span>{children}</div>;
}

function ImpactFields({ state }: { state: HarnessState }) {
  const costReason = state.cost !== "No Cost Impact";
  const costAmount = state.cost === "Cost Increase Known" || state.cost === "Cost Decrease";
  const scheduleFields = state.schedule !== "No Schedule Impact";
  return (
    <div className="rfi-two">
      <div className="rfi-panel">
        <strong>Cost Impact</strong>
        <div>{state.cost}</div>
        {costAmount && <Field label="Cost Amount">$12,500</Field>}
        {costReason && <Field label="Cost Reason / Explanation" full>Coordination change under review.</Field>}
      </div>
      <div className="rfi-panel">
        <strong>Schedule Impact</strong>
        <div>{state.schedule}</div>
        {scheduleFields && <Field label="Calendar Days">5</Field>}
        {scheduleFields && <Field label="Schedule Reason / Explanation" full>Lead time and resequencing.</Field>}
      </div>
    </div>
  );
}

export function RfiCanonicalUiHarness({ state }: { state: HarnessState }) {
  const mode = state.mode;
  return (
    <div className="rfi-harness">
      <div className="rfi-shell">
        <div className="rfi-top">
          <div>
            <div className="rfi-state">{state.state}</div>
            <h1>{state.title}</h1>
            <span className="rfi-chip">{state.status}</span>
            <span className="rfi-chip">P2 High</span>
            <span className="rfi-chip">Coordination</span>
          </div>
          <div className="rfi-actions">
            <button className="primary">{state.primaryAction}</button>
            {state.secondaryActions.map(action => <button key={action} className={action === "Close RFI" ? "danger" : ""}>{action}</button>)}
          </div>
        </div>
        <div className="rfi-content">
          <RfiSectionHeaderStatus lang="en" mode={mode}>
            <div className="rfi-grid">
              <Field label="RFI number">{mode === "create" ? "Assigned after save" : "RFI-0081"}</Field>
              <Field label="Project">River Avenue East</Field>
              <Field label="Subject/title" full>{state.title}</Field>
              <Field label="Status / Priority / Type">{state.status} / P2 High / Coordination</Field>
              <Field label="Date Requested">Jul 13, 2026</Field>
              <Field label="Date Required">Jul 20, 2026</Field>
              <Field label="Days Outstanding">{mode === "create" ? "After save" : "4d"}</Field>
              <Field label="Date Answered">{state.status === "Closed" ? "Jul 18, 2026" : "-"}</Field>
            </div>
          </RfiSectionHeaderStatus>
          <RfiSectionSubmittedBy lang="en" mode={mode}>
            <div className="rfi-grid"><Field label="Company">BIMCorp Inc</Field><Field label="Contact/person">Roberto Test 1</Field><Field label="Address" full>123 Project Office, New York, NY</Field><Field label="Phone">+1 555 0100</Field><Field label="Email">roberto@bimcorpinc.com</Field></div>
          </RfiSectionSubmittedBy>
          <RfiSectionSubmittedTo lang="en" mode={mode}>
            <div className="rfi-grid"><Field label="Company">Design Partner LLC</Field><Field label="Contact/person">Jane Reviewer</Field><Field label="Address" full>Project directory address</Field><Field label="Phone">+1 555 0200</Field><Field label="Email">jane@design.example</Field></div>
          </RfiSectionSubmittedTo>
          <RfiSectionReferencesAttachments lang="en" mode={mode}>
            <div className="rfi-grid"><Field label="Drawing number">A-401</Field><Field label="Drawing title">B1 Fire Protection</Field><Field label="Spec section">05 12 00</Field><Field label="Detail number">5/A-301</Field><Field label="Note number">Note 3</Field><Field label="Location" full>B1 Fire Protection, Grid B2</Field><Field label="References / attachments" full>SK-105 Rev2.pdf | Grid B2 Field Photo.jpg | Add Reference | Upload File</Field>{state.hasViewpoint && <Field label="Viewpoint image" full>Viewpoint preview shown here. Include/exclude and order controls available when editable.</Field>}<Field label="Package selection/order" full>Human-readable attachment names only. No numeric crop controls.</Field></div>
          </RfiSectionReferencesAttachments>
          <RfiSectionQuestion lang="en" mode={mode}>
            <Field label="Question" full>Clarify the fire protection coordination conflict at B1 before fabrication.</Field>
            <button>Generate Question with AI</button>
            <p>Text-only AI uses credits and does not read attachments unless file-reading AI is explicitly used.</p>
          </RfiSectionQuestion>
          <RfiSectionImpact lang="en" mode={mode}><ImpactFields state={state} /></RfiSectionImpact>
          <RfiSectionDistributionResponses lang="en" mode={mode}>
            <Field label="Distribution" full>Jane Reviewer, PM Team, BIM Coordinator</Field>
            <Field label="Description of Email" full>Please respond with detail SK and impact confirmation.</Field>
            <button>Generate Email with AI</button>
            <button>Copy Email</button>
            <Field label="Responses" full>{state.responseAllowed ? "Official response controls visible. Save Response when permitted." : "Responses are view-only or unavailable in this state."}</Field>
            {state.responseAllowed && <button className="primary">Save Response</button>}
          </RfiSectionDistributionResponses>
        </div>
      </div>
    </div>
  );
}
