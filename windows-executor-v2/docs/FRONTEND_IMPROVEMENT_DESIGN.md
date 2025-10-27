# Windows Executor V2 - Frontend Improvement Design

## 📋 Current State Analysis

### ✅ What Works Now:
- Basic account information display
- Strategy list view
- Open positions table
- Backend health status badge
- Minimalist dark theme

### ❌ What's Missing:
- Real-time updates
- Interactive charts/graphs
- Detailed performance metrics
- Trade history view
- System monitoring
- Settings/configuration UI
- Notifications/alerts
- Multi-window support
- Responsive layout improvements

---

## 🎨 Design Goals

### 1. **Professional Trading Dashboard**
- Modern, clean interface inspired by professional trading platforms
- Information density balanced with readability
- Quick access to critical metrics

### 2. **Real-Time Monitoring**
- Live updates without page refresh
- WebSocket connection for instant data
- Visual indicators for status changes

### 3. **Comprehensive Data Visualization**
- Equity curve charts
- Performance metrics graphs
- Position heat maps
- Strategy performance comparison

### 4. **Enhanced User Control**
- Easy strategy management
- Quick actions for common tasks
- Keyboard shortcuts
- Bulk operations

---

## 🏗️ Proposed Architecture

### Technology Stack (Already Available):
- ✅ **React 18** - UI framework
- ✅ **TypeScript** - Type safety
- ✅ **Electron** - Desktop wrapper
- 🆕 **Pusher JS** - Real-time updates (Vercel compatible)
- 🆕 **TanStack Query (React Query)** - Data fetching & caching
- 🆕 **Recharts** - Charts and graphs
- 🆕 **Framer Motion** - Animations
- 🆕 **Radix UI** - Accessible components
- 🆕 **Zustand** - State management

---

## 📐 New Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│  [Logo] Windows Executor V2          [Settings] [Minimize]  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────┐  │
│  │Dashboard│ │Strategies│ │Positions │ │ Trade History  │  │
│  └─────────┘ └──────────┘ └──────────┘ └────────────────┘  │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                                                         │  │
│  │                  MAIN CONTENT AREA                     │  │
│  │             (Changes based on active tab)              │  │
│  │                                                         │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Status Bar: Backend ● | MT5 ● | Last Update: 2s ago    ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Dashboard Tab (Main View)

### Top Section - Quick Stats Cards
```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   Balance    │ │    Equity    │ │    Profit    │ │   Win Rate   │
│   $9,979.50  │ │  $9,981.98   │ │   +$81.98    │ │     68.5%    │
│   +0.82% ↗   │ │  +0.84% ↗    │ │   +0.82% ↗   │ │   47/68 ✓    │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

### Middle Section - Charts (Side by Side)
```
┌────────────────────────────────┐ ┌────────────────────────────┐
│   Equity Curve (Last 7 Days)   │ │  Daily P&L Distribution    │
│                                 │ │                            │
│   [Line Chart showing growth]   │ │  [Bar Chart of profits]    │
│                                 │ │                            │
└────────────────────────────────┘ └────────────────────────────┘
```

### Bottom Section - Active Strategies & Positions
```
┌─────────────────────────────────────────────────────────────┐
│  Active Strategies (3)                          [+ Add New] │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐   │
│  │ ● EMA Triple CCI Gold    XAUUSD H1    Status: Active │   │
│  │   Today: +$125.50 | 8 Trades | 75% Win Rate          │   │
│  │   [⏸ Pause] [⏹ Stop] [⚙ Settings] [📊 Performance]  │   │
│  └──────────────────────────────────────────────────────┘   │
│  ...                                                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Open Positions (5)                    Total P&L: +$81.98   │
├─────────────────────────────────────────────────────────────┤
│  Ticket   Symbol   Type   Lots   Entry    Current   P&L    │
│  ────────────────────────────────────────────────────────   │
│  12345    EURUSD   BUY    0.10   1.0850   1.0875   +$25.00 │
│  12346    XAUUSD   SELL   0.02   2045.50  2043.20  +$46.00 │
│  ...                                                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Strategies Tab

### Enhanced Strategy Management
```
┌─────────────────────────────────────────────────────────────┐
│  My Strategies                [Search...] [Filter ▾] [+ New]│
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  [✓] EMA Triple CCI Gold              Status: ● Active │ │
│  │       Symbol: XAUUSD | Timeframe: H1                   │ │
│  │                                                         │ │
│  │  📊 Performance:                                       │ │
│  │     • Total Trades: 145                                │ │
│  │     • Win Rate: 68.5%                                  │ │
│  │     • Total Profit: +$1,245.80                         │ │
│  │     • Avg Win: $35.20 | Avg Loss: -$18.50             │ │
│  │     • Max Drawdown: -$125.00 (5.2%)                   │ │
│  │     • Sharpe Ratio: 1.85                               │ │
│  │                                                         │ │
│  │  ⚡ Actions:                                           │ │
│  │     [▶ Start] [⏸ Pause] [⏹ Stop] [⚙ Configure]       │ │
│  │     [📈 Backtest] [📊 Analytics] [📋 Logs] [🗑 Delete]│ │
│  │                                                         │ │
│  │  ⚙️ Configuration:                          [Edit ✏]  │ │
│  │     • Lot Size: 0.02                                   │ │
│  │     • Max Positions: 3                                 │ │
│  │     • Risk Per Trade: 2%                               │ │
│  │     • Stop Loss: 100 pips                              │ │
│  │     • Take Profit: 200 pips                            │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                               │
│  [More strategies...]                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 💼 Positions Tab

### Enhanced Position Tracking
```
┌─────────────────────────────────────────────────────────────┐
│  Open Positions              [Export] [Close All] [Refresh] │
├─────────────────────────────────────────────────────────────┤
│  Total Open: 5 | Total Volume: 0.42 lots | Total P&L: +$81 │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Ticket: 12345          ● EURUSD          BUY 0.10 lots  ││
│  │                                                          ││
│  │ Entry Price:    1.0850      Current: 1.0875  (+25 pips) ││
│  │ Stop Loss:      1.0800      Take Profit: 1.0950         ││
│  │ Opened:         2h 15m ago  Duration: 2:15:33           ││
│  │                                                          ││
│  │ Profit: +$25.00 (+2.3%)                                 ││
│  │                                                          ││
│  │ [📊 Chart] [✏ Modify] [❌ Close] [➗ Close Partial]     ││
│  └─────────────────────────────────────────────────────────┘│
│                                                               │
│  [More positions...]                                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 📜 Trade History Tab

### Comprehensive Trade Log
```
┌─────────────────────────────────────────────────────────────┐
│  Trade History           [Date Range ▾] [Export] [Analyze]  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Summary (Last 30 Days):                                     │
│  • Total Trades: 145                                         │
│  • Wins: 99 (68.3%) | Losses: 46 (31.7%)                   │
│  • Total Profit: +$1,245.80                                  │
│  • Best Trade: +$125.50 | Worst Trade: -$45.20             │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Date       Symbol  Type  Lots  Entry  Exit   P&L      ││
│  │ ────────────────────────────────────────────────────── ││
│  │ 2025-10-27 EURUSD  BUY  0.10  1.0850  1.0875  +$25.00 ││
│  │   Duration: 2h 15m | Strategy: EMA Triple CCI          ││
│  │                                                         ││
│  │ 2025-10-27 XAUUSD  SELL 0.02  2045.5  2043.2  +$46.00 ││
│  │   Duration: 45m    | Strategy: Gold Scalper            ││
│  │                                                         ││
│  │ [More trades...]                                        ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## ⚙️ Settings Panel (Right Sidebar)

### Configuration & Preferences
```
┌─────────────────────────────────┐
│        Settings                  │
├─────────────────────────────────┤
│                                  │
│ 🔌 Connections                   │
│   ● Backend: Connected          │
│   ● MT5: Connected              │
│   ● Platform: Online            │
│                                  │
│ 🔔 Notifications                 │
│   [✓] Trade opened/closed       │
│   [✓] Strategy started/stopped  │
│   [✓] Error alerts              │
│   [ ] Daily summary             │
│                                  │
│ 🎨 Appearance                    │
│   Theme: Dark ▾                 │
│   Font Size: Medium ▾           │
│   Layout: Comfortable ▾         │
│                                  │
│ 📊 Data Refresh                  │
│   Interval: 5 seconds ▾         │
│   Chart Period: 7 days ▾        │
│                                  │
│ 🔐 Account                       │
│   Executor ID: cmh7ci8om...     │
│   [Edit Credentials]            │
│   [View Logs]                   │
│                                  │
│ ℹ️ About                         │
│   Version: 1.0.0                │
│   [Check for Updates]           │
│   [Documentation]               │
│                                  │
└─────────────────────────────────┘
```

---

## 🎨 Visual Design System

### Color Palette (Dark Theme)
```
Background Levels:
- Level 0 (App BG):      #0f172a (slate-900)
- Level 1 (Cards):       #1e293b (slate-800)
- Level 2 (Elevated):    #334155 (slate-700)

Accent Colors:
- Primary:   #3b82f6 (blue-500)   - Actions, links
- Success:   #22c55e (green-500)  - Profit, wins
- Danger:    #ef4444 (red-500)    - Loss, errors
- Warning:   #f59e0b (amber-500)  - Warnings, pending
- Info:      #06b6d4 (cyan-500)   - Information

Text Colors:
- Primary:   #f1f5f9 (slate-100)  - Main text
- Secondary: #94a3b8 (slate-400)  - Secondary text
- Muted:     #64748b (slate-500)  - Disabled, hints
```

### Typography
```
Headings:
- H1: 2rem (32px) - Bold - Page titles
- H2: 1.5rem (24px) - Semibold - Section headers
- H3: 1.25rem (20px) - Medium - Card titles

Body:
- Large: 1rem (16px) - Regular - Main content
- Normal: 0.875rem (14px) - Regular - Tables, lists
- Small: 0.75rem (12px) - Regular - Captions, hints
```

### Spacing System
```
- xs:  4px
- sm:  8px
- md:  16px
- lg:  24px
- xl:  32px
- 2xl: 48px
```

### Component Styles

#### Cards
```css
.card {
  background: #1e293b;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.card:hover {
  border-color: rgba(59, 130, 246, 0.3);
  transform: translateY(-2px);
  transition: all 0.2s ease;
}
```

#### Buttons
```css
.button-primary {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.button-secondary {
  background: #334155;
  color: #f1f5f9;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.button-danger {
  background: #ef4444;
  color: white;
}
```

#### Status Indicators
```css
.status-online {
  color: #22c55e;
  animation: pulse 2s infinite;
}

.status-offline {
  color: #ef4444;
}

.status-warning {
  color: #f59e0b;
}
```

---

## 🔄 Real-Time Updates

### Pusher Integration (Vercel Compatible)
```typescript
import Pusher from 'pusher-js';

// Initialize Pusher (credentials from backend/platform)
const pusher = new Pusher(PUSHER_KEY, {
  cluster: PUSHER_CLUSTER,
  encrypted: true,
});

// Subscribe to executor channel
const executorChannel = pusher.subscribe(`executor-${executorId}`);

// Listen to various events
executorChannel.bind('position_update', (data: any) => {
  updatePosition(data);
  queryClient.invalidateQueries(['positions']);
});

executorChannel.bind('trade_closed', (data: any) => {
  addToHistory(data);
  showNotification('Trade Closed', {
    type: 'success',
    title: 'Trade Closed',
    message: `${data.symbol} ${data.type} closed with ${data.profit > 0 ? '+' : ''}$${data.profit.toFixed(2)}`
  });
  queryClient.invalidateQueries(['positions', 'account']);
});

executorChannel.bind('strategy_status', (data: any) => {
  updateStrategyStatus(data);
  queryClient.invalidateQueries(['strategies']);
});

executorChannel.bind('account_update', (data: any) => {
  updateAccount(data);
  queryClient.setQueryData(['account'], data);
});

executorChannel.bind('heartbeat', (data: any) => {
  // Update last seen timestamp
  setLastHeartbeat(new Date());
});

// Cleanup on unmount
useEffect(() => {
  return () => {
    executorChannel.unbind_all();
    pusher.unsubscribe(`executor-${executorId}`);
  };
}, [executorId]);
```

### Auto-Refresh Mechanism (Fallback)
```typescript
// Polling fallback for data that might not come through Pusher
useEffect(() => {
  const interval = setInterval(() => {
    // Only refetch if Pusher hasn't sent update in 30 seconds
    const timeSinceLastUpdate = Date.now() - lastHeartbeat.getTime();
    if (timeSinceLastUpdate > 30000) {
      refetchAccount();
      refetchPositions();
      refetchStrategies();
    }
  }, 10000); // Check every 10 seconds

  return () => clearInterval(interval);
}, [lastHeartbeat]);
```

### Pusher Events Mapping

Backend will send these events via Pusher:

| Event | Trigger | Payload |
|-------|---------|---------|
| `position_opened` | New position created | `{ ticket, symbol, type, volume, entry_price }` |
| `position_updated` | Position P&L changed | `{ ticket, current_price, profit, duration }` |
| `position_closed` | Position closed | `{ ticket, exit_price, profit, duration }` |
| `strategy_started` | Strategy activated | `{ strategy_id, name, symbol, timeframe }` |
| `strategy_stopped` | Strategy stopped | `{ strategy_id, reason }` |
| `account_update` | Account data changed | `{ balance, equity, margin_level }` |
| `heartbeat` | Executor online status | `{ timestamp, status: "online" }` |
| `error` | Error occurred | `{ message, level: "warning" \| "error" }` |

---

## 📱 Responsive Design

### Breakpoints
```
- Mobile:  < 640px  (Stack everything vertically)
- Tablet:  640-1024px (2-column grid)
- Desktop: > 1024px (3-4 column grid)
```

### Adaptive Layout
- Cards stack on mobile
- Charts resize/simplify on smaller screens
- Sidebar becomes drawer on mobile
- Horizontal scroll for tables on mobile

---

## 🎯 Interactive Features

### 1. **Context Menus**
- Right-click on position → Quick actions (Close, Modify, etc.)
- Right-click on strategy → Start/Stop/Configure

### 2. **Keyboard Shortcuts**
```
Ctrl+R  - Refresh all data
Ctrl+N  - New strategy
Ctrl+,  - Open settings
Ctrl+H  - Toggle history
Escape  - Close modals/panels
```

### 3. **Drag & Drop**
- Rearrange strategy order
- Customize dashboard layout
- Move widgets around

### 4. **Filters & Search**
- Search strategies by name
- Filter trades by symbol, date, profit/loss
- Advanced filters (win rate, drawdown, etc.)

---

## 🔔 Notifications System

### Toast Notifications
```typescript
// Success notification
showNotification({
  type: 'success',
  title: 'Trade Closed',
  message: 'EURUSD BUY 0.10 lots closed with +$25.00 profit',
  duration: 5000,
  action: {
    label: 'View Details',
    onClick: () => openTradeDetails(tradeId)
  }
});

// Error notification
showNotification({
  type: 'error',
  title: 'Connection Lost',
  message: 'Backend disconnected. Retrying...',
  persistent: true
});
```

### Notification Types
- ✅ Trade opened/closed
- 🎯 Target reached (TP/SL hit)
- ⚠️ Strategy stopped (error)
- 🔌 Connection status changes
- 📊 Daily performance summary

---

## 📊 Charts & Visualizations

### 1. **Equity Curve Chart**
- Line chart showing balance/equity over time
- Zoom & pan functionality
- Highlight significant events (large wins/losses)
- Compare multiple strategies

### 2. **Daily P&L Bar Chart**
- Bar chart of daily profits/losses
- Color-coded (green for profit, red for loss)
- Show cumulative profit line

### 3. **Win Rate Pie Chart**
- Wins vs Losses breakdown
- By strategy, by symbol, by timeframe

### 4. **Position Heatmap**
- Visual representation of open positions
- Size = lot size, Color = P&L

### 5. **Performance Metrics**
- Sharpe ratio, Sortino ratio
- Max drawdown visualization
- Recovery factor
- Profit factor

---

## 🚀 Advanced Features (Phase 2)

### 1. **Strategy Builder UI**
- Visual strategy creator
- Drag-and-drop indicators
- Backtesting integration

### 2. **Risk Management Dashboard**
- Real-time risk exposure
- Margin usage visualization
- Correlation matrix

### 3. **Multi-Account Support**
- Switch between accounts
- Aggregate statistics
- Copy trading between accounts

### 4. **Social Features**
- Share strategies
- Performance leaderboard
- Community insights

### 5. **AI Assistant**
- Trade suggestions
- Performance analysis
- Anomaly detection

---

## 📦 Implementation Priority & Status

### Phase 1: Core Improvements ✅ COMPLETE
- ✅ **Enhanced Dashboard with charts** - DONE (Balance & Trades charts)
- ✅ **Improved Strategy management** - DONE (Strategy cards with status)
- ✅ **Better Position tracking** - DONE (Enhanced table with SL/TP)
- ✅ **Trade History view** - DONE (Full history tab)
- ✅ **Real-time updates** - DONE (Pusher integration ready)
- ⚠️ **Settings panel** - DEFERRED (Basic settings only)

**Status:** ✅ **IMPLEMENTED** (October 27, 2025)
**Build:** `Windows Executor V2-Setup-1.0.0.exe` (167.8 MB)

**What's Working:**
- 4-tab navigation (Dashboard, Strategies, Positions, History)
- Real-time Pusher connection with status indicator
- Balance & Equity line chart (last 20 data points)
- Trades by Symbol bar chart
- Toast notification system (success, error, warning, info)
- Auto-refresh every 5 seconds
- Color-coded metrics
- Enhanced positions table with SL/TP display
- Professional dark theme

### Phase 2: Advanced Features ⚠️ PARTIALLY COMPLETE
- ✅ **Advanced charts (Recharts)** - DONE (Basic implementation)
- ✅ **Notification system** - DONE (Toast notifications)
- ✅ **Pusher integration** - DONE (Frontend ready, backend events pending)
- ⚠️ **Polished animations** - PARTIAL (Basic CSS animations only)
- ❌ **Responsive design** - NOT IMPLEMENTED (Desktop-first only)

**What's Missing:**
- ❌ Advanced chart features (zoom, pan, compare)
- ❌ Win rate pie chart
- ❌ Position heatmap
- ❌ Performance metrics charts (Sharpe, drawdown)
- ❌ Framer Motion animations
- ❌ Mobile/tablet responsive layouts
- ❌ Backend Pusher event triggers (position_opened, position_closed)

### Phase 3: Polish & Optimize ❌ NOT STARTED
- ❌ **Performance optimization** - NOT STARTED
- ❌ **Bug fixes** - NOT STARTED (needs testing first)
- ❌ **User testing** - NOT STARTED (waiting for deployment)
- ❌ **Final UI polish** - NOT STARTED

**Next Steps:**
1. Deploy and test current build
2. Add backend Pusher event triggers
3. Gather user feedback
4. Prioritize Phase 2 features based on feedback
5. Implement responsive design if needed
6. Performance optimization based on real usage

---

## 🛠️ Required Dependencies

Add to `package.json`:

```json
{
  "dependencies": {
    "pusher-js": "^8.4.0-rc2",
    "@tanstack/react-query": "^5.0.0",
    "recharts": "^2.10.0",
    "framer-motion": "^10.16.0",
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "@radix-ui/react-tooltip": "^1.0.7",
    "@radix-ui/react-tabs": "^1.0.4",
    "zustand": "^4.4.0",
    "date-fns": "^2.30.0",
    "react-hot-toast": "^2.4.1",
    "lucide-react": "^0.292.0"
  }
}
```

---

## 📝 Notes

1. **Maintain Performance**: Keep render cycles efficient
2. **Accessibility**: Follow WCAG 2.1 guidelines
3. **Testing**: Add unit tests for components
4. **Documentation**: Document all new components
5. **Backward Compatibility**: Don't break existing API contracts

---

## 🎨 Mockup Examples

### Dashboard View
![Dashboard](https://via.placeholder.com/800x600/0f172a/3b82f6?text=Dashboard+with+Charts+%26+Stats)

### Strategy Management
![Strategies](https://via.placeholder.com/800x600/0f172a/22c55e?text=Strategy+Management+%26+Performance)

### Position Tracking
![Positions](https://via.placeholder.com/800x600/0f172a/f59e0b?text=Enhanced+Position+Tracking)

---

## ✅ Success Metrics

- **Usability**: Users can complete tasks in < 3 clicks
- **Performance**: < 100ms UI response time
- **Stability**: Zero crashes during normal operation
- **Clarity**: All data clearly labeled and explained
- **Delight**: Smooth animations and transitions

---

**Document Created:** October 27, 2025  
**Last Updated:** October 27, 2025 - 5:30 PM  
**Version:** 1.1  
**Status:** ✅ Phase 1 COMPLETE - Phase 2 Partial - Phase 3 Pending

---

## 🎯 QUICK STATUS SUMMARY

### ✅ IMPLEMENTED (Phase 1):
1. **4-Tab Dashboard** - Dashboard, Strategies, Positions, History
2. **Real-time Pusher** - Connection ready, event listeners implemented
3. **Charts** - Balance/Equity line chart + Trades bar chart
4. **Toast Notifications** - 4 types with auto-dismiss
5. **Enhanced Tables** - SL/TP display, color-coded profit/loss
6. **Professional Theme** - Dark theme with smooth animations
7. **Auto-refresh** - Every 5 seconds
8. **Color-coded Metrics** - 6 account cards with left border accents

### ⚠️ PARTIALLY DONE (Phase 2):
1. **Pusher Events** - Frontend ready, backend triggers not implemented
2. **Animations** - Basic CSS only, no Framer Motion
3. **Charts** - Basic only, no zoom/pan/compare features
4. **Settings** - No dedicated settings panel

### ❌ NOT DONE (Need to Implement):
1. **Responsive Design** - Mobile/tablet layouts
2. **Advanced Charts** - Win rate pie, position heatmap, performance metrics
3. **Context Menus** - Right-click actions
4. **Keyboard Shortcuts** - Hotkeys
5. **Drag & Drop** - Rearrange elements
6. **Advanced Filters** - Search & filter functionality
7. **Strategy Builder UI** - Visual creator
8. **Risk Dashboard** - Real-time exposure
9. **Multi-Account** - Account switching
10. **Backend Event Triggers** - Emit Pusher events from Python backend

### 🚀 READY FOR:
- User testing and feedback
- Real-world deployment
- Performance monitoring
- Bug identification

### 📝 RECOMMENDATIONS:
1. **Deploy current build** - Test with real users first
2. **Add backend events** - Priority for real-time updates to work fully
3. **Gather feedback** - Before implementing Phase 2 features
4. **Mobile support** - Only if users request it (desktop-first platform)
5. **Advanced features** - Add based on user demand
