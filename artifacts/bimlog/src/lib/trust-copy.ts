export const TRUST_FACTS = {
  files: {
    en: "BIMLog may store uploaded and imported project files in the storage configured for the deployed environment so requested workflows can operate.",
    es: "BIMLog puede almacenar archivos cargados e importados en el almacenamiento configurado para el entorno desplegado para que funcionen los flujos solicitados.",
  },
  retention: {
    en: "Retention and deletion depend on the applicable customer configuration, contract, legal requirements, and any active legal hold.",
    es: "La retención y eliminación dependen de la configuración del cliente, el contrato, los requisitos legales y cualquier retención legal activa.",
  },
  security: {
    en: "Access controls and transport security apply to the configured environment. Hosting region, storage encryption, backup, and production-access commitments are deployment-specific.",
    es: "Los controles de acceso y la seguridad de transporte se aplican al entorno configurado. La región, cifrado, copias y acceso a producción dependen del despliegue.",
  },
  records: {
    en: "BIMLog records server-observed events and available provenance. Reports are informational project records, not independent legal or technical certification.",
    es: "BIMLog registra eventos observados por el servidor y la procedencia disponible. Los informes son registros informativos, no certificación legal o técnica independiente.",
  },
} as const;
