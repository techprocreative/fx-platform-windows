import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppConfig } from '../types/config.types';

interface ConfigState {
  config: Partial<AppConfig>;
  updateConfig: (updates: Partial<AppConfig>) => void;
  resetConfig: () => void;
  isConfigured: () => boolean;
  getApiCredentials: () => { apiKey: string; apiSecret: string } | null;
  updateApiCredentials: (apiKey: string, apiSecret: string) => void;
}

const defaultConfig: Partial<AppConfig> = {
  platformUrl: 'https://platform.com',
  pusherCluster: 'mt1',
  zmqPort: 5555,
  zmqHost: 'tcp://localhost',
  heartbeatInterval: 60,
  autoReconnect: true,
};

export const useConfigStore = create<ConfigState>()(
  persist(
    (set, get) => ({
      config: defaultConfig,
      updateConfig: (updates) => set((state) => ({
        config: { ...state.config, ...updates }
      })),
      resetConfig: () => set({ config: defaultConfig }),
      isConfigured: () => {
        const { config } = get();
        return !!(config.executorId && config.apiKey && config.apiSecret);
      },
      getApiCredentials: () => {
        const { config } = get();
        if (config.apiKey && config.apiSecret) {
          return {
            apiKey: config.apiKey,
            apiSecret: config.apiSecret,
          };
        }
        return null;
      },
      updateApiCredentials: (apiKey, apiSecret) => set((state) => ({
        config: { ...state.config, apiKey, apiSecret }
      })),
    }),
    {
      name: 'executor-config',
    }
  )
);