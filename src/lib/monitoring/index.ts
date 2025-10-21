// Essential monitoring exports only
export * from "./logger";
export * from "./sentry";
export * from "./position-monitor";
export * from "./pnl-calculator";
export * from "./alert-system";

// Keep only essential types that are actually exported
export type {
  MonitoredPosition,
  PricePoint,
  PnLReport,
  PositionPnL,
  Anomaly,
  AnomalyType,
  AnomalySeverity,
  AnomalyAction,
  PositionSubscription,
  MonitoringConfig,
  AlertChannel,
  PositionAlert,
  AlertType,
  MonitoringStatus,
  MonitoringError,
  ExchangeRates,
  PositionEvent,
  PerformanceMetrics,
} from "./types";

// Export alert types from monitoring-types file
export type {
  MonitoringAlert,
  AlertSeverity,
  AlertCategory,
  AlertStatus,
  AlertFilter,
} from "./monitoring-types";

// Removed overengineered monitoring components:
// - LatencyTracker (only used in advanced monitor)
// - ExecutionQualityTracker (only used in advanced monitor)
// - SlippageTracker (only used in advanced monitor)
// - ResourceMonitor (only used in advanced monitor)
// - AdvancedMonitor (overkill for trading platform)
// - AnomalyDetector (complex, rarely needed)
// - BusinessMetrics (overkill for trading platform)
// - PerformanceMonitor (duplicated functionality)
