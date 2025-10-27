import { useEffect, useState } from 'react';
import Pusher from 'pusher-js';

interface PusherConfig {
  enabled: boolean;
  key: string | null;
  cluster: string | null;
  channel: string | null;
  executorId: string | null;
}

interface UsePusherReturn {
  pusher: Pusher | null;
  channel: any | null;
  isConnected: boolean;
  error: Error | null;
}

export function usePusher(backendUrl: string): UsePusherReturn {
  const [pusher, setPusher] = useState<Pusher | null>(null);
  const [channel, setChannel] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let pusherInstance: Pusher | null = null;

    async function initPusher() {
      try {
        // Fetch Pusher config from backend
        const response = await fetch(`${backendUrl}/api/config/pusher`);
        const config: PusherConfig = await response.json();

        if (!config.enabled || !config.key || !config.cluster || !config.channel) {
          console.log('Pusher not configured, skipping real-time updates');
          return;
        }

        // Initialize Pusher
        pusherInstance = new Pusher(config.key, {
          cluster: config.cluster,
          encrypted: true,
        });

        // Subscribe to channel
        const channelInstance = pusherInstance.subscribe(config.channel);

        pusherInstance.connection.bind('connected', () => {
          console.log('✅ Connected to Pusher');
          setIsConnected(true);
        });

        pusherInstance.connection.bind('disconnected', () => {
          console.log('⚠️ Disconnected from Pusher');
          setIsConnected(false);
        });

        pusherInstance.connection.bind('error', (err: any) => {
          console.error('❌ Pusher connection error:', err);
          setError(new Error(err.message || 'Pusher connection error'));
        });

        setPusher(pusherInstance);
        setChannel(channelInstance);
      } catch (err) {
        console.error('Failed to initialize Pusher:', err);
        setError(err instanceof Error ? err : new Error('Failed to initialize Pusher'));
      }
    }

    initPusher();

    return () => {
      if (pusherInstance) {
        pusherInstance.disconnect();
      }
    };
  }, [backendUrl]);

  return { pusher, channel, isConnected, error };
}
