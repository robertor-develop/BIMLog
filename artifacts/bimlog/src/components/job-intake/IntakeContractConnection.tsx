import { Link } from "wouter";
import { withIntakeReturn } from "../../lib/return-context";

export function intakeCreatedContracts(intake: any) {
  const rows = Array.isArray(intake.activationSummary?.contracts) ? intake.activationSummary.contracts : [];
  return rows.length ? rows.filter((row: any) => row.contractId) : intake.activatedContractId ? [{ contractId: intake.activatedContractId }] : [];
}

export function IntakeContractConnection({ intake, profiles, projectId, tt }: {
  intake: any; profiles: any[]; projectId: number; tt: (en: string, es: string) => string;
}) {
  const contracts = intakeCreatedContracts(intake);
  return <div className="ji-guide">
    <strong>{tt("From setup to contract", "De la configuración al contrato")}</strong>
    <p>{contracts.length ? tt("These are the canonical contracts created from this setup. Open a contract to review its current terms and saved source snapshot. Editing Intake does not rewrite that snapshot or approve a contract.", "Estos son los contratos canónicos creados desde esta configuración. Abra un contrato para revisar sus términos actuales y la instantánea de origen. Editar el Ingreso no reemplaza esa instantánea ni aprueba un contrato.") : tt("Define the agreement here once. Operational activation can proceed without Commercial records. When the commercial requirements are complete, BIMLog creates draft contracts from these profiles and their assigned items. Approval and execution remain in Contracts & Commitments.", "Defina el acuerdo aquí una sola vez. La activación operativa puede continuar sin registros comerciales. Cuando se completan los requisitos comerciales, BIMLog crea contratos borrador desde estos perfiles y sus partidas. La aprobación y ejecución permanecen en Contratos y Compromisos.")}</p>
    <div className="ji-actions">{contracts.map((contract: any, index: number) => {
      const profile = profiles.find(item => item.id === contract.profileId);
      const label = profile?.title || profile?.contractNumber || tt(`Created contract ${index + 1}`, `Contrato creado ${index + 1}`);
      return <Link key={contract.contractId} href={withIntakeReturn(`/projects/${projectId}/financial/contracts?contractId=${encodeURIComponent(contract.contractId)}`, projectId, "contract")}>{tt("Open", "Abrir")} {label}</Link>;
    })}</div>
  </div>;
}
