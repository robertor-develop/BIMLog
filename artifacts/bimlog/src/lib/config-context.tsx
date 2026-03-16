import React, { createContext, useContext, useMemo } from 'react';
import { useGetConfig, getGetConfigQueryKey } from '@workspace/api-client-react';
import { useI18n } from './i18n';
import { useAuthStore } from '@/store/auth';

type ConfigOption = { value: string; label: string; labelEs: string; meta?: Record<string, string> };
type AppConfig = Record<string, ConfigOption[]>;

type ConfigContextType = {
  config: AppConfig;
  isLoading: boolean;
  getOptions: (category: string) => ConfigOption[];
  getLabel: (category: string, value: string) => string;
  adminRoles: string[];
  writeRoles: string[];
};

const ConfigContext = createContext<ConfigContextType | null>(null);

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore();
  const { data, isLoading } = useGetConfig({ query: { queryKey: getGetConfigQueryKey(), enabled: !!token } });
  const { lang } = useI18n();
  const config = (data ?? {}) as AppConfig;

  const getOptions = (category: string): ConfigOption[] => {
    return config[category] ?? [];
  };

  const getLabel = (category: string, value: string): string => {
    const options = config[category] ?? [];
    const opt = options.find((o) => o.value === value);
    if (!opt) return value;
    return lang === 'es' ? opt.labelEs : opt.label;
  };

  const adminRoles = useMemo(() => {
    return (config['member_role'] ?? [])
      .filter((r) => r.meta?.permission === 'admin')
      .map((r) => r.value);
  }, [config]);

  const writeRoles = useMemo(() => {
    return (config['member_role'] ?? [])
      .filter((r) => r.meta?.permission === 'admin' || r.meta?.permission === 'write')
      .map((r) => r.value);
  }, [config]);

  return (
    <ConfigContext.Provider value={{ config, isLoading, getOptions, getLabel, adminRoles, writeRoles }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error('useConfig must be used within ConfigProvider');
  return ctx;
}
