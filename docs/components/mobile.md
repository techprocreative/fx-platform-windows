# Mobile Control Component - React Native Application

## Overview

Mobile Control adalah aplikasi cross-platform (iOS & Android) yang memberikan kemampuan monitoring dan kontrol penuh atas sistem trading dari mana saja. Aplikasi ini berfungsi sebagai remote control untuk Executor dan dashboard mobile untuk analisis performa.

## Arsitektur Aplikasi

### Technology Stack

```yaml
Framework: React Native 0.72+
Language: TypeScript 5.x
State Management: 
  - Redux Toolkit
  - RTK Query (API caching)
  - Redux Persist (offline support)
Navigation: React Navigation 6
UI Framework: 
  - React Native Elements
  - React Native Paper
  - Custom components
Authentication:
  - Biometric (FaceID/TouchID/Fingerprint)
  - PIN code fallback
Push Notifications:
  - Firebase Cloud Messaging (FCM)
  - iOS Push Notification Service (APNs)
Charts: 
  - React Native Charts Wrapper
  - Victory Native
Real-time:
  - Socket.IO Client
  - WebSocket native
Security:
  - React Native Keychain (secure storage)
  - Certificate pinning
  - Jailbreak/Root detection
```

### Project Structure

```
mobile/
├── src/
│   ├── app/                      # App entry & setup
│   │   ├── App.tsx               # Main app component
│   │   ├── store.ts             # Redux store configuration
│   │   └── AppNavigator.tsx     # Root navigator
│   ├── features/                 # Feature-based modules
│   │   ├── auth/
│   │   │   ├── screens/
│   │   │   │   ├── LoginScreen.tsx
│   │   │   │   ├── BiometricSetup.tsx
│   │   │   │   └── PinCodeScreen.tsx
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   └── authSlice.ts
│   │   ├── dashboard/
│   │   │   ├── screens/
│   │   │   │   └── DashboardScreen.tsx
│   │   │   ├── components/
│   │   │   │   ├── AccountSummary.tsx
│   │   │   │   ├── PerformanceChart.tsx
│   │   │   │   └── QuickStats.tsx
│   │   │   └── dashboardSlice.ts
│   │   ├── positions/
│   │   │   ├── screens/
│   │   │   │   ├── PositionsScreen.tsx
│   │   │   │   └── PositionDetailScreen.tsx
│   │   │   ├── components/
│   │   │   │   ├── PositionCard.tsx
│   │   │   │   └── PositionActions.tsx
│   │   │   └── positionsSlice.ts
│   │   ├── strategies/
│   │   │   ├── screens/
│   │   │   │   ├── StrategiesScreen.tsx
│   │   │   │   └── StrategyControlScreen.tsx
│   │   │   ├── components/
│   │   │   └── strategiesSlice.ts
│   │   ├── commands/
│   │   │   ├── screens/
│   │   │   │   └── RemoteControlScreen.tsx
│   │   │   ├── components/
│   │   │   │   ├── EmergencyStop.tsx
│   │   │   │   └── CommandHistory.tsx
│   │   │   └── commandsSlice.ts
│   │   └── settings/
│   │       ├── screens/
│   │       ├── components/
│   │       └── settingsSlice.ts
│   ├── components/               # Shared components
│   │   ├── common/
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Input.tsx
│   │   │   └── Loading.tsx
│   │   ├── charts/
│   │   │   ├── LineChart.tsx
│   │   │   ├── BarChart.tsx
│   │   │   └── PieChart.tsx
│   │   └── layout/
│   │       ├── Header.tsx
│   │       ├── TabBar.tsx
│   │       └── SafeArea.tsx
│   ├── services/                 # External services
│   │   ├── api/
│   │   │   ├── client.ts        # API client setup
│   │   │   ├── auth.ts
│   │   │   ├── strategies.ts
│   │   │   └── positions.ts
│   │   ├── websocket/
│   │   │   └── socketClient.ts
│   │   └── notifications/
│   │       ├── fcm.ts
│   │       └── localNotifications.ts
│   ├── utils/                    # Utilities
│   │   ├── storage.ts           # Async storage wrapper
│   │   ├── keychain.ts          # Secure storage
│   │   ├── formatters.ts        # Data formatters
│   │   ├── validators.ts        # Input validators
│   │   └── permissions.ts       # Permission helpers
│   ├── hooks/                    # Custom hooks
│   │   ├── useAuth.ts
│   │   ├── useWebSocket.ts
│   │   ├── useBiometric.ts
│   │   └── useNotifications.ts
│   ├── constants/                # App constants
│   │   ├── colors.ts
│   │   ├── fonts.ts
│   │   └── config.ts
│   └── types/                    # TypeScript types
│       ├── models.ts
│       ├── navigation.ts
│       └── api.ts
├── android/                       # Android specific
│   ├── app/
│   │   ├── build.gradle
│   │   └── src/
│   └── gradle.properties
├── ios/                          # iOS specific
│   ├── NexusTrade/
│   │   ├── Info.plist
│   │   └── AppDelegate.mm
│   └── Podfile
├── __tests__/                    # Test files
├── .env                          # Environment variables
├── app.json                      # App configuration
├── babel.config.js
├── metro.config.js
├── package.json
└── tsconfig.json
```

## Core Features Implementation

### 1. Authentication & Security

```typescript
// src/features/auth/hooks/useBiometric.ts
import { useState, useEffect } from 'react';
import TouchID from 'react-native-touch-id';
import * as Keychain from 'react-native-keychain';
import { Platform } from 'react-native';

interface BiometricAuthResult {
  isAvailable: boolean;
  biometryType: string | null;
  authenticate: () => Promise<boolean>;
  saveCredentials: (username: string, password: string) => Promise<void>;
  getCredentials: () => Promise<{ username: string; password: string } | null>;
}

export const useBiometric = (): BiometricAuthResult => {
  const [isAvailable, setIsAvailable] = useState(false);
  const [biometryType, setBiometryType] = useState<string | null>(null);

  useEffect(() => {
    checkBiometricAvailability();
  }, []);

  const checkBiometricAvailability = async () => {
    try {
      const biometryType = await TouchID.isSupported();
      setIsAvailable(true);
      setBiometryType(biometryType);
    } catch (error) {
      setIsAvailable(false);
      setBiometryType(null);
    }
  };

  const authenticate = async (): Promise<boolean> => {
    if (!isAvailable) return false;

    const optionalConfigObject = {
      title: 'Authentication Required',
      imageColor: '#2196F3',
      imageErrorColor: '#ff0000',
      sensorDescription: 'Touch sensor',
      sensorErrorDescription: 'Failed',
      cancelText: 'Cancel',
      fallbackLabel: 'Show Passcode',
      unifiedErrors: false,
      passcodeFallback: true,
    };

    try {
      const biometryType = await TouchID.authenticate(
        'Authenticate to access NexusTrade',
        optionalConfigObject
      );
      return true;
    } catch (error) {
      console.error('Biometric authentication failed:', error);
      return false;
    }
  };

  const saveCredentials = async (username: string, password: string) => {
    try {
      await Keychain.setInternetCredentials(
        'nexustrade.com',
        username,
        password,
        {
          accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
          authenticatePrompt: 'Authenticate to save credentials',
          authenticationPromptTitle: 'Save Credentials',
        }
      );
    } catch (error) {
      console.error('Failed to save credentials:', error);
      throw error;
    }
  };

  const getCredentials = async () => {
    try {
      const credentials = await Keychain.getInternetCredentials('nexustrade.com');
      if (credentials) {
        return {
          username: credentials.username,
          password: credentials.password,
        };
      }
      return null;
    } catch (error) {
      console.error('Failed to get credentials:', error);
      return null;
    }
  };

  return {
    isAvailable,
    biometryType,
    authenticate,
    saveCredentials,
    getCredentials,
  };
};
```

### 2. Real-time WebSocket Connection

```typescript
// src/services/websocket/socketClient.ts
import io, { Socket } from 'socket.io-client';
import { store } from '@/app/store';
import { 
  updatePosition, 
  addTrade, 
  updateAccountInfo 
} from '@/features/positions/positionsSlice';
import { showNotification } from '@/services/notifications/localNotifications';

class WebSocketClient {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  connect(token: string): void {
    if (this.socket?.connected) {
      return;
    }

    this.socket = io('wss://api.nexustrade.com', {
      transports: ['websocket'],
      auth: {
        token,
      },
      reconnection: true,
      reconnectionDelay: this.reconnectDelay,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: this.maxReconnectAttempts,
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.subscribeToChannels();
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, attempt to reconnect
        this.socket?.connect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.socket?.disconnect();
        store.dispatch({ 
          type: 'websocket/connectionFailed',
          payload: 'Failed to connect to server' 
        });
      }
    });

    // Business event listeners
    this.socket.on('trade', (data) => {
      store.dispatch(addTrade(data));
      
      // Show notification for new trades
      showNotification({
        title: 'New Trade Executed',
        body: `${data.type} ${data.lots} ${data.symbol} @ ${data.price}`,
        data: { type: 'trade', tradeId: data.id },
      });
    });

    this.socket.on('position_update', (data) => {
      store.dispatch(updatePosition(data));
    });

    this.socket.on('account_update', (data) => {
      store.dispatch(updateAccountInfo(data));
    });

    this.socket.on('alert', (data) => {
      // Show critical alerts
      if (data.level === 'critical' || data.level === 'warning') {
        showNotification({
          title: `${data.level.toUpperCase()} Alert`,
          body: data.message,
          data: { type: 'alert', alertId: data.id },
          priority: 'high',
        });
      }
    });

    this.socket.on('command_result', (data) => {
      store.dispatch({
        type: 'commands/commandExecuted',
        payload: data,
      });
    });
  }

  private subscribeToChannels(): void {
    if (!this.socket) return;

    this.socket.emit('subscribe', {
      channels: ['trades', 'positions', 'alerts', 'commands'],
    });
  }

  sendCommand(command: string, parameters: any): void {
    if (!this.socket?.connected) {
      console.error('WebSocket not connected');
      return;
    }

    this.socket.emit('command', {
      command,
      parameters,
      timestamp: Date.now(),
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export default new WebSocketClient();
```

### 3. Dashboard Implementation

```typescript
// src/features/dashboard/screens/DashboardScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Alert,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';
import {
  AccountSummary,
  PerformanceChart,
  ActiveStrategies,
  RecentTrades,
  QuickActions,
} from '../components';
import { fetchDashboardData } from '../dashboardSlice';
import { RootState, AppDispatch } from '@/app/store';

export const DashboardScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const [refreshing, setRefreshing] = useState(false);
  
  const {
    accountInfo,
    performance,
    activeStrategies,
    recentTrades,
    isLoading,
    error,
  } = useSelector((state: RootState) => state.dashboard);

  useFocusEffect(
    React.useCallback(() => {
      loadDashboardData();
      
      // Set up auto-refresh every 30 seconds
      const interval = setInterval(loadDashboardData, 30000);
      
      return () => clearInterval(interval);
    }, [])
  );

  const loadDashboardData = async () => {
    try {
      await dispatch(fetchDashboardData()).unwrap();
    } catch (error) {
      Alert.alert('Error', 'Failed to load dashboard data');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const handleEmergencyStop = () => {
    Alert.alert(
      'Emergency Stop',
      'This will stop all trading activities. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Stop All',
          style: 'destructive',
          onPress: () => {
            dispatch({ type: 'commands/emergencyStop' });
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <AccountSummary data={accountInfo} />
      
      <QuickActions
        onEmergencyStop={handleEmergencyStop}
        onPauseTrading={() => dispatch({ type: 'commands/pauseTrading' })}
        onResumeTrading={() => dispatch({ type: 'commands/resumeTrading' })}
      />
      
      <PerformanceChart data={performance} period="week" />
      
      <ActiveStrategies
        strategies={activeStrategies}
        onStrategyPress={(id) => {
          // Navigate to strategy detail
        }}
      />
      
      <RecentTrades
        trades={recentTrades}
        onTradePress={(id) => {
          // Navigate to trade detail
        }}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
});
```

### 4. Position Management

```typescript
// src/features/positions/components/PositionCard.tsx
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Card, Button, Badge } from 'react-native-elements';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Position } from '@/types/models';
import { formatCurrency, formatPips } from '@/utils/formatters';

interface PositionCardProps {
  position: Position;
  onClose: () => void;
  onModify: () => void;
  onDetail: () => void;
}

export const PositionCard: React.FC<PositionCardProps> = ({
  position,
  onClose,
  onModify,
  onDetail,
}) => {
  const isProfitable = position.profit >= 0;
  const profitColor = isProfitable ? '#4CAF50' : '#F44336';

  return (
    <Card containerStyle={styles.card}>
      <TouchableOpacity onPress={onDetail}>
        <View style={styles.header}>
          <View style={styles.symbolContainer}>
            <Text style={styles.symbol}>{position.symbol}</Text>
            <Badge
              value={position.type}
              badgeStyle={[
                styles.typeBadge,
                position.type === 'BUY' ? styles.buyBadge : styles.sellBadge,
              ]}
            />
          </View>
          <Text style={[styles.profit, { color: profitColor }]}>
            {formatCurrency(position.profit)}
          </Text>
        </View>

        <View style={styles.details}>
          <DetailRow label="Lots" value={position.lots.toFixed(2)} />
          <DetailRow label="Open Price" value={position.openPrice.toFixed(5)} />
          <DetailRow label="Current" value={position.currentPrice.toFixed(5)} />
          <DetailRow
            label="Pips"
            value={formatPips(position.pips)}
            color={profitColor}
          />
        </View>

        <View style={styles.levels}>
          <LevelIndicator
            label="SL"
            value={position.stopLoss}
            current={position.currentPrice}
            isSL={true}
          />
          <LevelIndicator
            label="TP"
            value={position.takeProfit}
            current={position.currentPrice}
            isSL={false}
          />
        </View>

        <View style={styles.actions}>
          <Button
            title="Modify"
            type="outline"
            buttonStyle={styles.actionButton}
            onPress={onModify}
            icon={
              <Icon name="edit" size={18} color="#2196F3" />
            }
          />
          <Button
            title="Close"
            buttonStyle={[styles.actionButton, styles.closeButton]}
            onPress={onClose}
            icon={
              <Icon name="close" size={18} color="#fff" />
            }
          />
        </View>
      </TouchableOpacity>
    </Card>
  );
};

const DetailRow: React.FC<{
  label: string;
  value: string;
  color?: string;
}> = ({ label, value, color }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}:</Text>
    <Text style={[styles.detailValue, color && { color }]}>{value}</Text>
  </View>
);

const LevelIndicator: React.FC<{
  label: string;
  value: number;
  current: number;
  isSL: boolean;
}> = ({ label, value, current, isSL }) => {
  const distance = Math.abs(current - value);
  const isClose = distance < 0.001; // Within 10 pips
  
  return (
    <View style={styles.levelContainer}>
      <Text style={styles.levelLabel}>{label}</Text>
      <Text style={[
        styles.levelValue,
        isClose && styles.levelClose,
      ]}>
        {value.toFixed(5)}
      </Text>
      <Text style={styles.levelDistance}>
        {(distance * 10000).toFixed(1)} pips
      </Text>
    </View>
  );
};
```

### 5. Remote Command Execution

```typescript
// src/features/commands/screens/RemoteControlScreen.tsx
import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import {
  Card,
  Button,
  ListItem,
  Switch,
  Slider,
  Text,
} from 'react-native-elements';
import { useDispatch, useSelector } from 'react-redux';
import { sendCommand } from '../commandsSlice';
import { RootState, AppDispatch } from '@/app/store';

export const RemoteControlScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { executors, commandHistory } = useSelector(
    (state: RootState) => state.commands
  );
  
  const [selectedExecutor, setSelectedExecutor] = useState<string | null>(null);
  const [settings, setSettings] = useState({
    pauseNewTrades: false,
    closeAllPositions: false,
    maxRisk: 1.0,
    maxPositions: 5,
  });

  const handleEmergencyStop = () => {
    Alert.alert(
      'Emergency Stop',
      'This will immediately stop all trading and close all positions. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Execute',
          style: 'destructive',
          onPress: async () => {
            try {
              await dispatch(
                sendCommand({
                  executorId: selectedExecutor || 'all',
                  command: 'EMERGENCY_STOP',
                  parameters: {
                    closePositions: true,
                    disableAutoTrading: true,
                  },
                  priority: 'URGENT',
                })
              ).unwrap();
              
              Alert.alert('Success', 'Emergency stop executed');
            } catch (error) {
              Alert.alert('Error', 'Failed to execute emergency stop');
            }
          },
        },
      ]
    );
  };

  const handlePauseTrading = async () => {
    try {
      await dispatch(
        sendCommand({
          executorId: selectedExecutor || 'all',
          command: 'PAUSE_TRADING',
          parameters: {},
          priority: 'HIGH',
        })
      ).unwrap();
      
      Alert.alert('Success', 'Trading paused');
    } catch (error) {
      Alert.alert('Error', 'Failed to pause trading');
    }
  };

  const handleResumeTrading = async () => {
    try {
      await dispatch(
        sendCommand({
          executorId: selectedExecutor || 'all',
          command: 'RESUME_TRADING',
          parameters: {},
          priority: 'NORMAL',
        })
      ).unwrap();
      
      Alert.alert('Success', 'Trading resumed');
    } catch (error) {
      Alert.alert('Error', 'Failed to resume trading');
    }
  };

  const handleUpdateSettings = async () => {
    try {
      await dispatch(
        sendCommand({
          executorId: selectedExecutor || 'all',
          command: 'UPDATE_SETTINGS',
          parameters: settings,
          priority: 'NORMAL',
        })
      ).unwrap();
      
      Alert.alert('Success', 'Settings updated');
    } catch (error) {
      Alert.alert('Error', 'Failed to update settings');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Card>
        <Card.Title>Emergency Controls</Card.Title>
        <Button
          title="EMERGENCY STOP ALL"
          buttonStyle={[styles.button, styles.emergencyButton]}
          onPress={handleEmergencyStop}
          icon={{
            name: 'stop-circle',
            type: 'font-awesome-5',
            color: 'white',
          }}
        />
        
        <View style={styles.controlRow}>
          <Button
            title="Pause Trading"
            buttonStyle={[styles.button, styles.warningButton]}
            onPress={handlePauseTrading}
          />
          <Button
            title="Resume Trading"
            buttonStyle={[styles.button, styles.successButton]}
            onPress={handleResumeTrading}
          />
        </View>
      </Card>

      <Card>
        <Card.Title>Risk Settings</Card.Title>
        
        <ListItem>
          <ListItem.Content>
            <ListItem.Title>Pause New Trades</ListItem.Title>
          </ListItem.Content>
          <Switch
            value={settings.pauseNewTrades}
            onValueChange={(value) =>
              setSettings({ ...settings, pauseNewTrades: value })
            }
          />
        </ListItem>

        <ListItem>
          <ListItem.Content>
            <ListItem.Title>Max Risk per Trade: {settings.maxRisk}%</ListItem.Title>
            <Slider
              value={settings.maxRisk}
              onValueChange={(value) =>
                setSettings({ ...settings, maxRisk: value })
              }
              minimumValue={0.1}
              maximumValue={5}
              step={0.1}
              thumbStyle={styles.sliderThumb}
              trackStyle={styles.sliderTrack}
            />
          </ListItem.Content>
        </ListItem>

        <ListItem>
          <ListItem.Content>
            <ListItem.Title>Max Positions: {settings.maxPositions}</ListItem.Title>
            <Slider
              value={settings.maxPositions}
              onValueChange={(value) =>
                setSettings({ ...settings, maxPositions: Math.round(value) })
              }
              minimumValue={1}
              maximumValue={20}
              step={1}
            />
          </ListItem.Content>
        </ListItem>

        <Button
          title="Apply Settings"
          buttonStyle={styles.button}
          onPress={handleUpdateSettings}
        />
      </Card>

      <Card>
        <Card.Title>Command History</Card.Title>
        {commandHistory.map((cmd, index) => (
          <ListItem key={index} bottomDivider>
            <ListItem.Content>
              <ListItem.Title>{cmd.command}</ListItem.Title>
              <ListItem.Subtitle>
                {new Date(cmd.timestamp).toLocaleString()}
              </ListItem.Subtitle>
            </ListItem.Content>
            <Badge
              value={cmd.status}
              status={
                cmd.status === 'completed' ? 'success' :
                cmd.status === 'failed' ? 'error' : 'warning'
              }
            />
          </ListItem>
        ))}
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  button: {
    marginVertical: 5,
    paddingVertical: 12,
  },
  emergencyButton: {
    backgroundColor: '#d32f2f',
  },
  warningButton: {
    backgroundColor: '#ff9800',
  },
  successButton: {
    backgroundColor: '#4caf50',
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  sliderThumb: {
    width: 20,
    height: 20,
    backgroundColor: '#2196F3',
  },
  sliderTrack: {
    height: 5,
    borderRadius: 2,
  },
});
```

## Push Notifications

### Firebase Setup

```typescript
// src/services/notifications/fcm.ts
import messaging from '@react-native-firebase/messaging';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '@/services/api/client';

class FCMService {
  async requestPermission(): Promise<boolean> {
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (enabled) {
      console.log('FCM Authorization status:', authStatus);
    }

    return enabled;
  }

  async getToken(): Promise<string | null> {
    try {
      const token = await messaging().getToken();
      
      if (token) {
        // Save token to server
        await this.saveTokenToServer(token);
        // Save locally
        await AsyncStorage.setItem('fcmToken', token);
        return token;
      }
    } catch (error) {
      console.error('Failed to get FCM token:', error);
    }
    
    return null;
  }

  async saveTokenToServer(token: string): Promise<void> {
    try {
      await api.post('/user/fcm-token', {
        token,
        platform: Platform.OS,
        deviceInfo: {
          os: Platform.OS,
          version: Platform.Version,
        },
      });
    } catch (error) {
      console.error('Failed to save FCM token to server:', error);
    }
  }

  setupMessageHandlers(): void {
    // Foreground messages
    messaging().onMessage(async (remoteMessage) => {
      console.log('FCM foreground message:', remoteMessage);
      
      // Show local notification since FCM doesn't show notifications in foreground
      this.showLocalNotification(remoteMessage);
    });

    // Background/Quit message handler
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
      console.log('FCM background message:', remoteMessage);
      
      // Handle background message
      await this.handleBackgroundMessage(remoteMessage);
    });

    // When app is opened from notification
    messaging().onNotificationOpenedApp((remoteMessage) => {
      console.log('Notification opened app:', remoteMessage);
      
      this.handleNotificationOpen(remoteMessage);
    });

    // Check if app was opened from notification (when app was quit)
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage) {
          console.log('Initial notification:', remoteMessage);
          this.handleNotificationOpen(remoteMessage);
        }
      });

    // Token refresh
    messaging().onTokenRefresh(async (token) => {
      await this.saveTokenToServer(token);
      await AsyncStorage.setItem('fcmToken', token);
    });
  }

  private showLocalNotification(remoteMessage: any): void {
    // Implementation depends on local notification library
    // e.g., using react-native-push-notification
  }

  private async handleBackgroundMessage(remoteMessage: any): Promise<void> {
    const { data } = remoteMessage;
    
    if (data?.type === 'trade_alert') {
      // Handle trade alert
    } else if (data?.type === 'position_update') {
      // Handle position update
    }
  }

  private handleNotificationOpen(remoteMessage: any): void {
    const { data } = remoteMessage;
    
    // Navigate to appropriate screen based on notification data
    if (data?.screen) {
      // Navigate to screen
    }
  }
}

export default new FCMService();
```

## Performance Optimization

### 1. Image Optimization

```typescript
// src/components/common/OptimizedImage.tsx
import React from 'react';
import FastImage, { FastImageProps } from 'react-native-fast-image';

export const OptimizedImage: React.FC<FastImageProps> = (props) => {
  return (
    <FastImage
      {...props}
      resizeMode={FastImage.resizeMode.contain}
      priority={FastImage.priority.normal}
    />
  );
};
```

### 2. List Optimization

```typescript
// src/components/common/OptimizedList.tsx
import React, { useMemo } from 'react';
import {
  FlatList,
  FlatListProps,
  ViewabilityConfig,
} from 'react-native';

interface OptimizedListProps<T> extends FlatListProps<T> {
  data: T[];
  keyExtractor: (item: T, index: number) => string;
}

export function OptimizedList<T>({
  data,
  keyExtractor,
  ...props
}: OptimizedListProps<T>) {
  const viewabilityConfig: ViewabilityConfig = useMemo(
    () => ({
      minimumViewTime: 300,
      viewAreaCoveragePercentThreshold: 50,
    }),
    []
  );

  return (
    <FlatList
      data={data}
      keyExtractor={keyExtractor}
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      updateCellsBatchingPeriod={50}
      initialNumToRender={10}
      windowSize={10}
      viewabilityConfig={viewabilityConfig}
      getItemLayout={(data, index) => ({
        length: 100, // Fixed item height
        offset: 100 * index,
        index,
      })}
      {...props}
    />
  );
}
```

### 3. Memoization

```typescript
// src/features/positions/components/PositionList.tsx
import React, { memo, useMemo } from 'react';
import { View, Text } from 'react-native';
import { Position } from '@/types/models';

interface PositionListProps {
  positions: Position[];
  filter: 'all' | 'buy' | 'sell';
}

export const PositionList = memo<PositionListProps>(
  ({ positions, filter }) => {
    const filteredPositions = useMemo(() => {
      if (filter === 'all') return positions;
      
      return positions.filter(
        (p) => p.type.toLowerCase() === filter
      );
    }, [positions, filter]);

    const totalProfit = useMemo(() => {
      return filteredPositions.reduce((sum, p) => sum + p.profit, 0);
    }, [filteredPositions]);

    return (
      <View>
        <Text>Total Profit: {totalProfit}</Text>
        {filteredPositions.map((position) => (
          <PositionItem key={position.id} position={position} />
        ))}
      </View>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison function
    return (
      prevProps.filter === nextProps.filter &&
      prevProps.positions.length === nextProps.positions.length &&
      JSON.stringify(prevProps.positions) === JSON.stringify(nextProps.positions)
    );
  }
);
```

## Testing

### Unit Tests

```typescript
// __tests__/features/auth/authSlice.test.ts
import authReducer, {
  login,
  logout,
  refreshToken,
} from '@/features/auth/authSlice';

describe('authSlice', () => {
  const initialState = {
    isAuthenticated: false,
    user: null,
    token: null,
    loading: false,
    error: null,
  };

  it('should handle initial state', () => {
    expect(authReducer(undefined, { type: 'unknown' })).toEqual(
      initialState
    );
  });

  it('should handle login.pending', () => {
    const actual = authReducer(initialState, login.pending);
    expect(actual.loading).toBe(true);
  });

  it('should handle login.fulfilled', () => {
    const userData = {
      id: '123',
      email: 'test@example.com',
      token: 'jwt-token',
    };
    
    const actual = authReducer(
      initialState,
      login.fulfilled(userData, '', { email: '', password: '' })
    );
    
    expect(actual.isAuthenticated).toBe(true);
    expect(actual.user).toEqual({ id: '123', email: 'test@example.com' });
    expect(actual.token).toBe('jwt-token');
    expect(actual.loading).toBe(false);
  });

  it('should handle logout', () => {
    const loggedInState = {
      ...initialState,
      isAuthenticated: true,
      user: { id: '123', email: 'test@example.com' },
      token: 'jwt-token',
    };
    
    const actual = authReducer(loggedInState, logout());
    expect(actual).toEqual(initialState);
  });
});
```

### Integration Tests

```typescript
// __tests__/integration/RemoteControl.test.tsx
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { store } from '@/app/store';
import { RemoteControlScreen } from '@/features/commands/screens/RemoteControlScreen';

describe('RemoteControlScreen', () => {
  it('should send emergency stop command', async () => {
    const { getByText, getByTestId } = render(
      <Provider store={store}>
        <RemoteControlScreen />
      </Provider>
    );

    const emergencyButton = getByText('EMERGENCY STOP ALL');
    fireEvent.press(emergencyButton);

    // Confirm dialog
    const confirmButton = getByText('Execute');
    fireEvent.press(confirmButton);

    await waitFor(() => {
      expect(getByText('Emergency stop executed')).toBeTruthy();
    });
  });

  it('should update risk settings', async () => {
    const { getByText, getByTestId } = render(
      <Provider store={store}>
        <RemoteControlScreen />
      </Provider>
    );

    // Adjust risk slider
    const riskSlider = getByTestId('risk-slider');
    fireEvent(riskSlider, 'onValueChange', 2.5);

    // Apply settings
    const applyButton = getByText('Apply Settings');
    fireEvent.press(applyButton);

    await waitFor(() => {
      expect(getByText('Settings updated')).toBeTruthy();
    });
  });
});
```

## Deployment

### Android Build

```bash
# Generate signed APK
cd android
./gradlew assembleRelease

# Generate AAB for Play Store
./gradlew bundleRelease
```

### iOS Build

```bash
# Install pods
cd ios
pod install

# Build for App Store
xcodebuild -workspace NexusTrade.xcworkspace \
  -scheme NexusTrade \
  -configuration Release \
  -archivePath ./build/NexusTrade.xcarchive \
  archive

# Export IPA
xcodebuild -exportArchive \
  -archivePath ./build/NexusTrade.xcarchive \
  -exportPath ./build \
  -exportOptionsPlist ExportOptions.plist
```

## Security Considerations

### 1. Certificate Pinning

```typescript
// src/services/api/security.ts
import { NetworkingModule } from 'react-native';
import RNSSLPinning from 'react-native-ssl-pinning';

export const setupCertificatePinning = () => {
  RNSSLPinning.getCertificate('nexustrade.com').then((cert) => {
    // Store certificate for validation
    AsyncStorage.setItem('server_cert', cert);
  });
};

export const makeSecureRequest = async (url: string, options: any) => {
  try {
    const response = await RNSSLPinning.fetch(url, {
      ...options,
      sslPinning: {
        certs: ['nexustrade_cert'],
      },
      timeoutInterval: 10000,
    });
    
    return response;
  } catch (error) {
    if (error.message === 'cancelled') {
      throw new Error('SSL Pinning failed');
    }
    throw error;
  }
};
```

### 2. Jailbreak Detection

```typescript
// src/utils/security.ts
import JailMonkey from 'jail-monkey';
import { Alert, BackHandler } from 'react-native';

export const checkDeviceSecurity = () => {
  if (JailMonkey.isJailBroken()) {
    Alert.alert(
      'Security Warning',
      'This device appears to be jailbroken/rooted. For your security, the app cannot run on compromised devices.',
      [
        {
          text: 'Exit',
          onPress: () => BackHandler.exitApp(),
        },
      ],
      { cancelable: false }
    );
    
    return false;
  }
  
  if (JailMonkey.isDebuggedMode()) {
    console.warn('App is running in debug mode');
  }
  
  return true;
};
```
