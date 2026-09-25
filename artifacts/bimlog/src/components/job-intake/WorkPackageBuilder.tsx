import { Layers3, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

export function WorkPackageBuilder({
  items,
  setItems,
  tt,
  request,
  projectId,
  defaultClassification,
}: {
  items: any[];
  setItems: (updater: (items: any[]) => any[]) => void;
  tt: (en: string, es: string) => string;
  request: (path: string, init?: RequestInit) => Promise<any>;
  projectId: number;
  defaultClassification?: Record<string, unknown>;
}) {
  const [catalogs, setCatalogs] = useState<Record<string, any[]>>({ disciplines: [], services: [], phases: [] });
  const [catalogError, setCatalogError] = useState("");
  const projectDiscipline = { disciplineId: defaultClassification?.disciplineId ?? "", disciplineCode: defaultClassification?.disciplineCode ?? "", disciplineName: defaultClassification?.disciplineName ?? "" };
  useEffect(() => { let active = true; Promise.all(["disciplines", "services", "phases"].map(async kind => [kind, (await request(`/master-catalogs/${kind}?projectId=${projectId}`)).entries ?? []] as const)).then(rows => { if (active) { setCatalogs(Object.fromEntries(rows)); setCatalogError(""); } }).catch(() => { if (active) setCatalogError(tt("Work-package classifications could not be loaded. Refresh and retry before saving.", "No se pudieron cargar las clasificaciones de los paquetes de trabajo. Actualice y vuelva a intentar antes de guardar.")); }); return () => { active = false; }; }, [projectId, request, tt]);
  const classificationFields = (value: any, change: (classification: any) => void) => (
    (["discipline", "service", "phase"] as const).map(kind => <label key={kind}>{tt(kind[0]!.toUpperCase()+kind.slice(1), ({ discipline:"Disciplina", service:"Servicio", phase:"Fase" } as const)[kind])}<select value={value?.[`${kind}Id`] ?? ""} onChange={event => { const entry = catalogs[`${kind}s`].find(candidate => String(candidate.id) === event.target.value); change({ ...projectDiscipline, ...(value ?? {}), [`${kind}Id`]: entry?.id ?? "", [`${kind}Code`]: entry?.code ?? "", [`${kind}Name`]: entry?.name ?? "" }); }}><option value="">{kind === "discipline" ? tt("Use project discipline", "Usar disciplina del proyecto") : tt("Select for this package or task", "Seleccionar para este paquete o tarea")}</option>{catalogs[`${kind}s`].map(entry => <option key={entry.id} value={entry.id}>{entry.code} — {entry.name}</option>)}</select></label>)
  );
  const dimensions = [
    "building",
    "floor",
    "zone",
    "discipline",
    "system",
    "phase",
    "deliverable",
    "task",
    "milestone",
  ];
  const dimensionLabel = (value: string) =>
    (
      ({
        building: tt("Building", "Edificio"),
        floor: tt("Floor", "Piso"),
        zone: tt("Zone", "Zona"),
        discipline: tt("Discipline", "Disciplina"),
        system: tt("System", "Sistema"),
        phase: tt("Phase", "Fase"),
        deliverable: tt("Deliverable", "Entregable"),
        task: tt("Task", "Tarea"),
        milestone: tt("Milestone", "Hito"),
      }) as Record<string, string>
    )[value] ?? value;
  const update = (itemIndex: number, packageIndex: number, patch: any) =>
    setItems((current) =>
      current.map((item, index) =>
        index === itemIndex
          ? {
              ...item,
              workPackages: (item.workPackages || []).map(
                (row: any, rowIndex: number) =>
                  rowIndex === packageIndex ? { ...row, ...patch } : row,
              ),
            }
          : item,
      ),
    );
  const updateTask = (
    itemIndex: number,
    packageIndex: number,
    taskIndex: number,
    patch: any,
  ) =>
    setItems((current) =>
      current.map((item, index) =>
        index === itemIndex
          ? {
              ...item,
              workPackages: (item.workPackages || []).map(
                (row: any, rowIndex: number) =>
                  rowIndex === packageIndex
                    ? {
                        ...row,
                        tasks: (row.tasks || []).map(
                          (task: any, index: number) =>
                            index === taskIndex ? { ...task, ...patch } : task,
                        ),
                      }
                    : row,
              ),
            }
          : item,
      ),
    );
  const addPackage = (itemIndex: number) =>
    setItems((current) =>
      current.map((candidate, index) => {
        if (index !== itemIndex) return candidate;
        const id = `WP-${crypto.randomUUID()}`;
        return {
          ...candidate,
          workPackages: [
            ...(candidate.workPackages || []),
            {
              id,
              packageCode: id.slice(0, 11),
              title: "",
              dimensionType: "deliverable",
              dimensionValue: "",
              packageType: "deliverable",
              classification: projectDiscipline,
              tasks: [],
            },
          ],
        };
      }),
    );
  const addTask = (itemIndex: number, packageIndex: number) => {
    const id = `TASK-${crypto.randomUUID()}`;
    update(itemIndex, packageIndex, {
      tasks: [
        ...(items[itemIndex].workPackages?.[packageIndex]?.tasks || []),
        { id, taskCode: id.slice(0, 13), name: "", plannedHours: "0.00", classification: items[itemIndex].workPackages?.[packageIndex]?.classification ?? projectDiscipline },
      ],
    });
  };
  return (
    <section className="ji-row">
      <h3>
        <Layers3 size={16} />{" "}
        {tt(
          "Work-package decomposition",
          "Descomposición en paquetes de trabajo",
        )}
      </h3>
      <p>
        {tt(
          "For budget-linked commercial activation, every Contract Item needs a floor or area Work Package with a discipline and deliverable type. Otherwise, packages are optional. A package may contain several operational tasks when the work needs that detail.",
          "Para activar un trabajo comercial vinculado a un presupuesto, cada Partida de Contrato necesita un Paquete de Trabajo de piso o zona con disciplina y tipo de entregable. En los demás casos, los paquetes son opcionales. Un paquete puede contener varias tareas operativas cuando el trabajo necesite ese detalle.",
        )}
      </p>
      {catalogError && <p className="ji-error" role="alert">{catalogError}</p>}
      {items.map((item, itemIndex) => (
        <div className="ji-row" key={item.id}>
          <strong>{item.name || item.id}</strong>
          <small>
            {tt("Owning Contract Item", "Partida de Contrato propietaria")}:{" "}
            {item.id}
          </small>
          {(item.workPackages || []).map((row: any, packageIndex: number) => (
            <div className="ji-row" key={row.id}>
              <div className="ji-grid three">
                <label>
                  {tt("Package", "Paquete")}
                  <input
                    value={row.title || ""}
                    onChange={(e) =>
                      update(itemIndex, packageIndex, { title: e.target.value })
                    }
                  />
                </label>
                <label>
                  {tt("Stable package code", "Código estable del paquete")}
                  <input value={row.packageCode || row.id} readOnly />
                </label>
                <label>
                  {tt("Break down by", "Dividir por")}
                  <select
                    value={row.dimensionType || "deliverable"}
                    onChange={(e) =>
                      update(itemIndex, packageIndex, {
                        dimensionType: e.target.value,
                      })
                    }
                  >
                    {dimensions.map((value) => (
                      <option key={value} value={value}>
                        {dimensionLabel(value)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {tt("Value", "Valor")}
                  <input
                    value={row.dimensionValue || ""}
                    placeholder={
                      row.dimensionType === "floor"
                        ? tt("Example: Level 3", "Ejemplo: Piso 3")
                        : undefined
                    }
                    onChange={(e) =>
                      update(itemIndex, packageIndex, {
                        dimensionValue: e.target.value,
                      })
                    }
                  />
                </label>
                <button
                  type="button"
                  aria-label={tt(
                    "Remove work package",
                    "Eliminar paquete de trabajo",
                  )}
                  onClick={() =>
                    setItems((current) =>
                      current.map((candidate, index) =>
                        index === itemIndex
                          ? {
                              ...candidate,
                              workPackages: (
                                candidate.workPackages || []
                              ).filter(
                                (_: any, i: number) => i !== packageIndex,
                              ),
                            }
                          : candidate,
                      ),
                    )
                  }
                >
                  <Trash2 size={14} />
                </button>
                {classificationFields(row.classification, classification => update(itemIndex, packageIndex, { classification }))}
              </div>
              <div className="ji-lock">
                <strong>
                  {tt(
                    "Operational tasks in this package",
                    "Tareas operativas de este paquete",
                  )}
                </strong>
                <p>
                  {tt(
                    "Add separate tasks only when they need their own assignment or progress control. Example: CELLAR_PB_SH_PRE_R0V0.",
                    "Agregue tareas separadas solo cuando necesiten su propia asignación o control de avance. Ejemplo: CELLAR_PB_SH_PRE_R0V0.",
                  )}
                </p>
                {(row.tasks || []).map((task: any, taskIndex: number) => (
                  <div className="ji-grid three" key={task.id}>
                    <label>
                      {tt("Task name", "Nombre de tarea")}
                      <input
                        value={task.name || ""}
                        onChange={(event) =>
                          updateTask(itemIndex, packageIndex, taskIndex, {
                            name: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      {tt("Stable task code", "Código estable de tarea")}
                      <input value={task.taskCode || task.id} readOnly />
                    </label>
                    <label>
                      {tt("Planned hours", "Horas planificadas")}
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={task.plannedHours || "0.00"}
                        onChange={(event) =>
                          updateTask(itemIndex, packageIndex, taskIndex, {
                            plannedHours: event.target.value,
                          })
                        }
                      />
                    </label>
                    <button
                      type="button"
                      aria-label={tt("Remove task", "Eliminar tarea")}
                      onClick={() =>
                        update(itemIndex, packageIndex, {
                          tasks: (row.tasks || []).filter(
                            (_: any, index: number) => index !== taskIndex,
                          ),
                        })
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                    {classificationFields(task.classification, classification => updateTask(itemIndex, packageIndex, taskIndex, { classification }))}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addTask(itemIndex, packageIndex)}
                >
                  <Plus size={14} />{" "}
                  {tt("Add operational task", "Agregar tarea operativa")}
                </button>
              </div>
            </div>
          ))}
          <button type="button" onClick={() => addPackage(itemIndex)}>
            <Plus size={14} />{" "}
            {tt("Add Work Package", "Agregar paquete de trabajo")}
          </button>
        </div>
      ))}
    </section>
  );
}
