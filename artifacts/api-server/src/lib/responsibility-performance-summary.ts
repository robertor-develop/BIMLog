type TraceableResponsibilityItem = {
  key: string;
  owner: { company: string | null };
  authorizedLink: string;
  classification: {
    groups: { due: boolean; overdue: boolean; blocked: boolean; noResponse: boolean };
  };
};

export interface ResponsibilityPerformanceAggregate {
  identity: string;
  company: string | null;
  actionableCount: number;
  dueCount: number;
  overdueCount: number;
  blockedCount: number;
  noResponseCount: number;
  sourceReferences: Array<{ key: string; authorizedLink: string }>;
}

export function responsibilityPerformanceSummary(items: readonly TraceableResponsibilityItem[]) {
  const byCompany = new Map<string, ResponsibilityPerformanceAggregate>();
  for (const item of items) {
    const company = item.owner.company?.trim() || null;
    const identity = company ? `company:${company.toLocaleLowerCase()}` : "company:unassigned";
    const aggregate = byCompany.get(identity) ?? {
      identity,
      company,
      actionableCount: 0,
      dueCount: 0,
      overdueCount: 0,
      blockedCount: 0,
      noResponseCount: 0,
      sourceReferences: [],
    };
    aggregate.actionableCount += 1;
    if (item.classification.groups.due) aggregate.dueCount += 1;
    if (item.classification.groups.overdue) aggregate.overdueCount += 1;
    if (item.classification.groups.blocked) aggregate.blockedCount += 1;
    if (item.classification.groups.noResponse) aggregate.noResponseCount += 1;
    if (!aggregate.sourceReferences.some(source => source.key === item.key)) {
      aggregate.sourceReferences.push({ key: item.key, authorizedLink: item.authorizedLink });
    }
    byCompany.set(identity, aggregate);
  }

  const aggregates = [...byCompany.values()].sort((a, b) =>
    (a.company ?? "").localeCompare(b.company ?? "") || a.identity.localeCompare(b.identity));
  const escalationCandidates = aggregates
    .filter(item => item.overdueCount > 0 || item.blockedCount > 0 || item.noResponseCount > 0)
    .map(item => ({
      aggregateIdentity: item.identity,
      company: item.company,
      reasons: [
        item.overdueCount > 0 ? "OVERDUE_SOURCE_RECORDS" : null,
        item.blockedCount > 0 ? "BLOCKED_SOURCE_RECORDS" : null,
        item.noResponseCount > 0 ? "NO_RESPONSE_SOURCE_RECORDS" : null,
      ].filter((reason): reason is string => Boolean(reason)),
      sourceReferences: item.sourceReferences,
    }));

  return {
    aggregates,
    escalationPreparation: {
      neutral: true,
      automaticScore: false,
      notificationSent: false,
      candidates: escalationCandidates,
    },
  };
}
