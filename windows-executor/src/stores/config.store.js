import { create } from "zustand";
import { persist } from "zustand/middleware";
const defaultConfig = {
    platformUrl: "https://fx.nusanexus.com",
    pusherCluster: "mt1",
    zmqPort: 5555,
    zmqHost: "tcp://localhost",
    heartbeatInterval: 60,
    autoReconnect: true,
};
export const useConfigStore = create()(persist((set, get) => ({
    config: defaultConfig,
    isLoading: false,
    error: null,
    updateConfig: (updates) => set((state) => ({
        config: { ...state.config, ...updates },
        error: null,
    })),
    resetConfig: () => set({
        config: defaultConfig,
        error: null,
        isLoading: false,
    }),
    isConfigured: () => {
        const { config } = get();
        return !!(config.executorId &&
            config.apiKey &&
            config.apiSecret &&
            config.pusherKey &&
            config.pusherCluster);
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
        config: { ...state.config, apiKey, apiSecret },
        error: null,
    })),
    /**
     * Auto-provision configuration from platform
     * Fetches Pusher credentials and other config from /api/executor/config
     */
    fetchConfigFromPlatform: async (apiKey, apiSecret, platformUrl) => {
        set({ isLoading: true, error: null });
        try {
            // Validate inputs
            if (!apiKey || !apiSecret || !platformUrl) {
                throw new Error("Missing required credentials");
            }
            // Construct the config endpoint URL
            const configUrl = new URL("/api/executor/config", platformUrl).toString();
            // Fetch configuration from platform
            const response = await fetch(configUrl, {
                method: "GET",
                headers: {
                    "X-API-Key": apiKey,
                    "X-API-Secret": apiSecret,
                    "Content-Type": "application/json",
                },
            });
            // Handle HTTP errors
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errorMessage = errorData.message || `HTTP ${response.status}`;
                if (response.status === 401) {
                    throw new Error("Invalid API credentials. Please check your key and secret.");
                }
                else if (response.status === 404) {
                    throw new Error("Executor not found. Please verify your credentials.");
                }
                else if (response.status === 429) {
                    throw new Error("Too many requests. Please wait a moment and try again.");
                }
                else {
                    throw new Error(`Failed to fetch configuration: ${errorMessage}`);
                }
            }
            // Parse response
            const data = await response.json();
            if (!data.success || !data.config) {
                throw new Error("Invalid response from platform");
            }
            // Extract the config
            const platformConfig = data.config;
            // Update store with fetched config
            set((state) => ({
                config: {
                    ...state.config,
                    // User-provided credentials
                    apiKey,
                    apiSecret,
                    platformUrl,
                    // Server-provided configuration
                    executorId: platformConfig.executorId,
                    executorName: platformConfig.executorName,
                    pusherKey: platformConfig.pusherKey,
                    pusherCluster: platformConfig.pusherCluster,
                    zmqPort: platformConfig.zmqPort,
                    zmqHost: platformConfig.zmqHost,
                    heartbeatInterval: platformConfig.heartbeatInterval,
                    commandTimeout: platformConfig.commandTimeout,
                    autoReconnect: platformConfig.autoReconnect,
                    retryAttempts: platformConfig.retryAttempts,
                },
                isLoading: false,
                error: null,
            }));
            console.log(`✅ Configuration auto-provisioned for executor: ${platformConfig.executorId}`);
            return true;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            console.error("❌ Failed to fetch platform configuration:", errorMessage);
            set({
                isLoading: false,
                error: errorMessage,
                config: { ...get().config, pusherKey: "", pusherCluster: "" },
            });
            return false;
        }
    },
    setLoading: (loading) => set({ isLoading: loading }),
    setError: (error) => set({ error }),
}), {
    name: "executor-config",
}));
