import React, { createContext, useContext, useState } from 'react';

type Language = 'en' | 'es';

const translations = {
  en: {
    // General
    'app.name': 'BIMLog',
    'app.tagline': 'by IgniteSmart',
    'nav.dashboard': 'Dashboard',
    'nav.projects': 'Projects',
    'nav.logout': 'Sign Out',
    
    // Auth
    'auth.login': 'Log In',
    'auth.register': 'Create Account',
    'auth.email': 'Email Address',
    'auth.password': 'Password',
    'auth.fullName': 'Full Name',
    'auth.companyName': 'Company Name',
    'auth.noAccount': "Don't have an account?",
    'auth.hasAccount': 'Already have an account?',

    // Landing
    'landing.hero.title': 'Intelligent BIM Coordination & Accountability',
    'landing.hero.subtitle': 'The enterprise-grade platform for AEC professionals to manage files, RFIs, and naming conventions with uncompromising strictness.',
    'landing.hero.cta': 'Get Started',
    'landing.features.title': 'Built for Precision',
    'landing.features.naming': 'Strict Naming Conventions',
    'landing.features.namingDesc': 'Enforce exact file naming rules. Uploads fail if they don\'t match.',
    'landing.features.audit': 'Immutable Audit Trail',
    'landing.features.auditDesc': 'Every action is logged. No deletes. Total accountability.',
    'landing.features.rfi': 'RFI & Submittals',
    'landing.features.rfiDesc': 'Track the complete lifecycle of project documentation.',

    // Dashboard
    'dashboard.title': 'Your Projects',
    'dashboard.newProject': 'New Project',
    'project.code': 'Code',
    'project.members': 'Members',
    'project.files': 'Files',
    'project.create.title': 'Create New Project',
    'project.create.name': 'Project Name',
    'project.create.desc': 'Description',
    'project.create.submit': 'Create Project',

    // Project Detail
    'project.tabs.files': 'Files',
    'project.tabs.rfis': 'RFIs',
    'project.tabs.submittals': 'Submittals',
    'project.tabs.activity': 'Activity Log',
    'project.tabs.team': 'Team',
    'project.tabs.convention': 'Convention Builder',
    'project.tabs.generator': 'Name Generator',

    // Files
    'files.upload': 'Upload File',
    'files.name': 'File Name',
    'files.size': 'Size',
    'files.status': 'Status',
    'files.uploader': 'Uploaded By',
    'files.date': 'Date',

    // Activity
    'activity.user': 'User',
    'activity.company': 'Company',
    'activity.action': 'Action',
    'activity.before': 'Before',
    'activity.after': 'After',
    'activity.date': 'Timestamp',

    // Team
    'team.add': 'Add Member',
    'team.name': 'Name',
    'team.role': 'Role',
    'team.joined': 'Joined',

    // Convention
    'convention.title': 'Naming Convention Builder',
    'convention.separator': 'Separator Character',
    'convention.active': 'Convention Active',
    'convention.fields': 'Naming Fields',
    'convention.addField': 'Add Field',
    'convention.save': 'Save Convention',
    'convention.generator.title': 'File Name Generator',
    'convention.generator.preview': 'Generated Name Preview',
    'convention.generator.copy': 'Copy to Clipboard',

    // Common
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.loading': 'Loading...',
    'common.error': 'An error occurred.',
    'common.success': 'Success',
  },
  es: {
    // General
    'app.name': 'BIMLog',
    'app.tagline': 'por IgniteSmart',
    'nav.dashboard': 'Panel',
    'nav.projects': 'Proyectos',
    'nav.logout': 'Cerrar Sesión',
    
    // Auth
    'auth.login': 'Iniciar Sesión',
    'auth.register': 'Crear Cuenta',
    'auth.email': 'Correo Electrónico',
    'auth.password': 'Contraseña',
    'auth.fullName': 'Nombre Completo',
    'auth.companyName': 'Empresa',
    'auth.noAccount': '¿No tienes cuenta?',
    'auth.hasAccount': '¿Ya tienes cuenta?',

    // Landing
    'landing.hero.title': 'Coordinación y Responsabilidad BIM Inteligente',
    'landing.hero.subtitle': 'La plataforma de nivel empresarial para profesionales AEC para gestionar archivos, RFIs y convenciones de nombres con estricta rigurosidad.',
    'landing.hero.cta': 'Empezar',
    'landing.features.title': 'Construido para la Precisión',
    'landing.features.naming': 'Convenciones de Nombres Estrictas',
    'landing.features.namingDesc': 'Aplica reglas exactas. Las cargas fallan si no coinciden.',
    'landing.features.audit': 'Registro de Auditoría Inmutable',
    'landing.features.auditDesc': 'Cada acción se registra. Sin eliminaciones. Responsabilidad total.',
    'landing.features.rfi': 'RFI y Entregables',
    'landing.features.rfiDesc': 'Rastrea el ciclo de vida completo de la documentación.',

    // Dashboard
    'dashboard.title': 'Tus Proyectos',
    'dashboard.newProject': 'Nuevo Proyecto',
    'project.code': 'Código',
    'project.members': 'Miembros',
    'project.files': 'Archivos',
    'project.create.title': 'Crear Nuevo Proyecto',
    'project.create.name': 'Nombre del Proyecto',
    'project.create.desc': 'Descripción',
    'project.create.submit': 'Crear Proyecto',

    // Project Detail
    'project.tabs.files': 'Archivos',
    'project.tabs.rfis': 'RFIs',
    'project.tabs.submittals': 'Entregables',
    'project.tabs.activity': 'Registro de Actividad',
    'project.tabs.team': 'Equipo',
    'project.tabs.convention': 'Constructor de Convenciones',
    'project.tabs.generator': 'Generador de Nombres',

    // Files
    'files.upload': 'Subir Archivo',
    'files.name': 'Nombre de Archivo',
    'files.size': 'Tamaño',
    'files.status': 'Estado',
    'files.uploader': 'Subido Por',
    'files.date': 'Fecha',

    // Activity
    'activity.user': 'Usuario',
    'activity.company': 'Empresa',
    'activity.action': 'Acción',
    'activity.before': 'Antes',
    'activity.after': 'Después',
    'activity.date': 'Marca de tiempo',

    // Team
    'team.add': 'Agregar Miembro',
    'team.name': 'Nombre',
    'team.role': 'Rol',
    'team.joined': 'Se unió',

    // Convention
    'convention.title': 'Constructor de Convenciones',
    'convention.separator': 'Carácter Separador',
    'convention.active': 'Convención Activa',
    'convention.fields': 'Campos de Nombre',
    'convention.addField': 'Agregar Campo',
    'convention.save': 'Guardar Convención',
    'convention.generator.title': 'Generador de Nombres',
    'convention.generator.preview': 'Vista Previa',
    'convention.generator.copy': 'Copiar al Portapapeles',

    // Common
    'common.save': 'Guardar',
    'common.cancel': 'Cancelar',
    'common.delete': 'Eliminar',
    'common.loading': 'Cargando...',
    'common.error': 'Ocurrió un error.',
    'common.success': 'Éxito',
  }
};

type I18nContextType = {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: keyof typeof translations.en) => string;
};

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Language>('en');

  const t = (key: keyof typeof translations.en) => {
    return translations[lang][key] || translations['en'][key] || key;
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
