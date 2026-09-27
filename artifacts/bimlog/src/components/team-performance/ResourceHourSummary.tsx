export type ResourceHourSources = { recorded: string; pending: string; approved: string; committed: string; draft: string; rejected: string; legacy: string };

export function ResourceHourSummary({ people, lang, projectTotals }: { people: Array<{ userId: number; name: string; hourSources?: ResourceHourSources }>; lang: string; projectTotals?: ResourceHourSources }) {
  const tr = (en: string, es: string) => lang === "es" ? es : en;
  return <section className="rounded-xl border p-4 space-y-3" aria-label={tr("Time approval sources", "Fuentes de aprobación de horas")}>
    <h2 className="font-semibold">{tr("Recorded and approved time", "Horas registradas y aprobadas")}</h2>
    <p className="text-sm text-muted-foreground">{tr("Committed/pending means recorded but unapproved, including draft and legacy time. Approved time is consumed separately; rejected time is excluded from commitments. Draft and legacy are subsets of pending, not additional hours. Figures use the selected dates; planning estimates do not approve time or authorize payments.", "Comprometidas/pendientes son las horas registradas sin aprobar, incluidos borradores y registros históricos. Las aprobadas se consumen por separado; las rechazadas se excluyen de los compromisos. Borradores e históricas son partes de pendientes, no horas adicionales. Las cifras usan las fechas seleccionadas; las estimaciones no aprueban horas ni autorizan pagos.")}</p>
    {!people.length && <p>{tr("No people match the selected filters.", "Ninguna persona coincide con los filtros seleccionados.")}</p>}
    {projectTotals && <p className="text-sm">{tr("Project totals include all recorded users in the loaded date period, including former members. Member and category filters apply to the individual cards only.", "Los totales del proyecto incluyen a todos los usuarios con registros en el período cargado, incluidos antiguos miembros. Los filtros de miembro y categoría se aplican solo a las tarjetas individuales.")}</p>}
    {[...(projectTotals ? [{ userId: -1, name: tr("Project total — loaded period", "Total del proyecto — período cargado"), hourSources: projectTotals }] : []), ...people].map(person => <div className="rounded-lg border p-3" key={person.userId}>
      <h3 className="font-medium break-words">{person.name}</h3>
      <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">{([
        ["recorded", "Recorded", "Registradas"], ["draft", "Draft", "Borrador"],
        ["pending", "Pending", "Pendientes"], ["approved", "Approved / consumed", "Aprobadas / consumidas"],
        ["rejected", "Rejected", "Rechazadas"], ["legacy", "Legacy / unreviewed", "Históricas / sin revisión"],
        ["committed", "Committed / pending", "Comprometidas / pendientes"],
      ] as const).map(([key, en, es]) => <div key={key}><dt className="text-xs text-muted-foreground">{tr(en, es)}</dt><dd className="font-medium tabular-nums">{person.hourSources?.[key] ?? "—"} h</dd></div>)}</dl>
    </div>)}
  </section>;
}
