export function IntakeCommercialReadiness({ capabilities, errors, activated, hasContracts, tt, onRetry }: {
  capabilities: { costValuePlanner: boolean; budget: boolean; contracts: boolean; fullCommercialActivation: boolean };
  errors: string[]; activated: boolean; hasContracts: boolean; tt: (en: string, es: string) => string; onRetry: () => void;
}) {
  const modules = [
    ["apu", capabilities.costValuePlanner, tt("APU versions", "Versiones APU")],
    ["budget", capabilities.budget, tt("Budget", "Presupuesto")],
    ["contracts", capabilities.contracts, tt("Contracts", "Contratos")],
  ] as const;
  return <div className="ji-guide" aria-label={tt("Commercial readiness", "Preparación comercial")}>
    <strong>{tt("Operations and Commercial setup", "Configuración operativa y comercial")}</strong>
    <p>{hasContracts ? tt("Commercial contracts already exist. Review them through the links in Contract setup.", "Ya existen contratos comerciales. Revíselos desde los vínculos en Configuración contractual.") : activated ? tt("The operational job is active. Commercial records can be added when the required access, approved budget and item mappings are ready.", "El trabajo operativo está activo. Los registros comerciales se pueden agregar cuando estén listos el acceso requerido, el presupuesto aprobado y los vínculos de partidas.") : tt("Core job activation does not require buying Commercial features or assigning every worker. Review the required operational items below. Selecting commercial references adds their validation requirements.", "La activación básica no requiere comprar funciones comerciales ni asignar a todo el personal. Revise los requisitos operativos abajo. Seleccionar referencias comerciales agrega sus requisitos de validación.")}</p>
    <ul>{modules.map(([key, enabled, label]) => <li key={key}>{label}: {errors.includes(key) ? tt("Could not load — retry; saved references are preserved", "No se pudo cargar — reintente; se conservan las referencias") : enabled ? tt("Available for this account; actions still require the appropriate project role", "Disponible para esta cuenta; las acciones requieren el rol adecuado") : tt("Not enabled for this account — optional for core operations", "No habilitado para esta cuenta — opcional para operaciones básicas")}</li>)}</ul>
    {!capabilities.fullCommercialActivation && <p>{tt("Creating Commercial records requires the complete Commercial package and authorized project access. Your company administrator can review availability.", "Crear registros comerciales requiere el paquete Comercial completo y acceso autorizado al proyecto. El administrador de su empresa puede revisar la disponibilidad.")}</p>}
    {errors.length > 0 && <button type="button" onClick={onRetry}>{tt("Retry Commercial sources", "Reintentar fuentes comerciales")}</button>}
  </div>;
}
