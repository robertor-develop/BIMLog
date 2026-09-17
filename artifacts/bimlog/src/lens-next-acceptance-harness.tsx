import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { LensNextPanelView, type LensNextPanelViewProps } from "./features/lens-next/LensNextPanelView";
import { LENS_NEXT_DEFAULT_FILTERS, type LensNextFilters, type LensNextIssue } from "./features/lens-next/lens-next-types";
import { filterLensNextIssues } from "./features/lens-next/lens-next-model";
import { buildLensNextIssueGroups, type LensNextViewPresetId } from "./features/lens-next/lens-next-view-settings";
import { I18nProvider, useI18n } from "./lib/i18n";
import "./index.css";
import "./features/lens-next/lens-next-panel.css";

const noop = () => undefined;

function issue(serverId: number): LensNextIssue {
  const trades = ["HVAC", "Plumbing", "Fire Protection", "Electrical"];
  const floors = ["L1", "L2", "L3", "Roof"];
  const statuses: LensNextIssue["status"][] = ["open", "follow_up", "waiting_design", "resolved"];
  return {
    identity: { projectId: 26, serverId, viewpointId: `vp-${serverId}`, lifecycleStatus: "active", revisionNumber: 2 },
    mutationVersion: 2,
    publishingAllowed: true,
    displayId: `CL-${String(serverId).padStart(3, "0")}`,
    navisworksGuid: `00000000-0000-4000-8000-${String(serverId).padStart(12, "0")}`,
    bimlogPhysicalId: `physical-${serverId}`,
    issueGroupId: `group-${Math.ceil(serverId / 5)}`,
    note: `${trades[serverId % trades.length]} coordination conflict at ${floors[serverId % floors.length]}`,
    openItems: "Coordinate the affected systems and verify clearance.",
    trade: trades[serverId % trades.length],
    floor: floors[serverId % floors.length],
    responsibleCompany: serverId % 2 ? "BIMTech Corp" : "Elara MEP",
    reportType: "Coordination",
    priority: ((serverId % 4) + 1) as 1 | 2 | 3 | 4,
    status: statuses[serverId % statuses.length],
    capturedAt: "2026-09-16T14:00:00.000Z",
    syncedAt: "2026-09-16T14:10:00.000Z",
    supersedesId: null,
    supersedesCode: null,
    screenshotUrl: serverId === 2 ? "/images/hero-bg.png" : null,
    visualStateAvailable: true,
    visualStateDigest: "a".repeat(64),
  };
}

export const LENS_NEXT_ACCEPTANCE_FIXTURES = Array.from({ length: 100 }, (_, index) => issue(index + 1));

function Harness() {
  const { language, setLanguage } = useI18n();
  const [selectedServerId, setSelectedServerId] = useState<number | null>(1);
  const [presentation, setPresentation] = useState<LensNextViewPresetId>("floor_trade_company");
  const [filters, setFilters] = useState<LensNextFilters>({ ...LENS_NEXT_DEFAULT_FILTERS });
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const filteredIssues = useMemo(() => filterLensNextIssues(LENS_NEXT_ACCEPTANCE_FIXTURES, filters), [filters]);
  const visibleIssues = useMemo(() => filteredIssues.slice((page - 1) * pageSize, page * pageSize), [filteredIssues, page]);
  const selectedIssue = LENS_NEXT_ACCEPTANCE_FIXTURES.find(item => item.identity.serverId === selectedServerId) ?? null;
  const groups = useMemo(
    () => buildLensNextIssueGroups(visibleIssues, { id: "fixture:26:acceptance", name: "Acceptance", scope: "published", preset: presentation, groupBy: [], hideResolved: false, statuses: [], priorityMaximum: null, ownerUserId: null, projectId: 26, updatedAt: "2026-09-16T14:10:00.000Z" }),
    [presentation, visibleIssues],
  );
  useEffect(() => {
    if (new URLSearchParams(location.search).get("acceptanceMobile") !== "390") return;
    const timer = window.setTimeout(() => {
      const browser = document.querySelector<HTMLElement>(".lens-next__browser");
      const details = document.querySelector<HTMLElement>(".lens-next__details:not(.lens-next__details--empty)");
      const header = details?.querySelector<HTMLElement>(".lens-next__detail-header");
      window.parent.postMessage({ type: "lens-next-mobile-acceptance", metrics: {
        viewportWidth: window.innerWidth,
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        browserDisplay: browser ? getComputedStyle(browser).display : null,
        detailsTop: details?.getBoundingClientRect().top ?? null,
        detailHeaderTop: header?.getBoundingClientRect().top ?? null,
        selectedCode: selectedIssue?.displayId ?? null,
        language,
      } }, location.origin);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [language, selectedIssue?.identity.serverId]);
  const props: LensNextPanelViewProps = {
    authorizedProjects: [{ id: 26, name: "Elara East", code: "ELA01" }], selectedProjectId: 26, onProjectChange: noop, projectLocked: true,
    bridgeDisplayName: "35-45 41ST_COORD_MODEL.nwf", bridgeModelFingerprint: "acceptance-model-fingerprint", bridgeBindingSource: "verified BIMLog marker",
    inventorySummary: { matched: 63, platformOnly: 37, navisworksOnly: 0, conflicted: 0, unresolved: 0 },
    synchronizationPlan: { items: [], inSync: 63, confirmLocalIdentity: 0, pullFromBimlog: 37, uploadToBimlog: 0, manualConflict: 0, blocked: 0, executable: true }, uploadableLocalViewpoints: [], localUploadState: "idle", localUploadMessage: null, onUploadLocalViewpoint: noop,
    createEnabled: true, createState: "idle", createMessage: null, onCreateIssue: noop,
    layoutEnabled: true, layoutState: "idle", layoutMessage: null, onMaterializeMyView: noop,
    reconciliationState: "idle", reconciliationMessage: null, onRunReconciliation: noop,
    platformPullState: "idle", platformPullMessage: null, onPullPlatformViewpoints: noop,
    xmlExportEnabled: true, xmlExportState: "idle", xmlExportMessage: null, onExportViewpointsXml: noop,
    filteredIssues, visibleIssues, activeIssueCount: 100,
    issueSort: "priority", onIssueSortChange: noop, issuePage: page, issuePageCount: Math.max(1, Math.ceil(filteredIssues.length / pageSize)), issuePageSize: pageSize, onIssuePageChange: setPage, onIssuePageSizeChange: noop,
    issueGroups: groups, viewPreset: presentation, customGroupBy: [], onViewPresetChange: setPresentation, onCustomGroupByChange: noop,
    selectedServerId, selectedIssue, linkedItems: { links: [], eligible: [] }, linkedItemsError: null, onLinkBimlogItem: noop, onRemoveLinkedItem: noop,
    referenceAttachments: { attachments: [] }, referenceAttachmentsError: null, onUploadReferenceAttachment: noop, onOpenReferenceAttachment: noop, onRemoveReferenceAttachment: noop,
    filters, onFiltersChange: (next) => { setFilters(next); setPage(1); }, trades: ["HVAC", "Plumbing", "Fire Protection", "Electrical"], floors: ["L1", "L2", "L3", "Roof"],
    filterCompanies: ["BIMTech Corp", "Elara MEP"], filterReportTypes: ["Coordination"],
    createTrades: ["HVAC", "Plumbing"], createFloors: ["L1", "L2"], createResponsibleCompanies: ["BIMTech Corp"], createReportTypes: ["Coordination"],
    apiState: "connected", bridgeState: "connected", refreshState: "fresh", apiError: null, bridgeError: null,
    history: null, historyError: null, lastRefreshedAt: "2026-09-16T14:10:00.000Z", bridgeOpenEnabled: true,
    workingViewState: "idle", workingViewUnavailable: false, visualRepairState: "idle", visualRepairMessage: null, onRepairCurrentWorkingView: noop,
    onRefresh: noop, onSelectIssue: setSelectedServerId, onCloseIssue: () => setSelectedServerId(null), onOpenWorkingView: noop, onLoadHistory: noop,
    publishState: "idle", publishMessage: null, onPublishAction: noop,
  };
  return <div className="lens-next-acceptance-shell">
    <div className="lens-next-acceptance-toolbar">
      <strong>Test-only acceptance fixture · real LensNextPanelView</strong>
      <button type="button" onClick={() => setLanguage(language === "en" ? "es" : "en")}>Language: {language.toUpperCase()}</button>
    </div>
    <main className="lens-next-workspace lens-next-workspace--embedded"><LensNextPanelView {...props} /></main>
  </div>;
}

createRoot(document.getElementById("root")!).render(<I18nProvider><Harness /></I18nProvider>);
