# User Workflows - NexusTrade Platform

## Overview

Dokumen ini menjelaskan alur kerja pengguna end-to-end di platform NexusTrade, dari registrasi hingga eksekusi trading otomatis.

## 1. User Onboarding Workflow

### 1.1 Registration Flow

```mermaid
flowchart TD
    Start([User visits website]) --> Register[Fill registration form]
    Register --> Verify{Email verification}
    Verify -->|Not verified| Resend[Resend verification email]
    Resend --> Verify
    Verify -->|Verified| Profile[Complete profile]
    Profile --> KYC{KYC required?}
    KYC -->|Yes| Upload[Upload documents]
    Upload --> Review[Admin review]
    Review -->|Approved| Subscribe
    Review -->|Rejected| Resubmit[Resubmit documents]
    Resubmit --> Review
    KYC -->|No| Subscribe[Choose subscription]
    Subscribe --> Payment[Payment process]
    Payment -->|Success| Dashboard[Access dashboard]
    Payment -->|Failed| Retry[Retry payment]
    Retry --> Payment
```

**Implementation Details:**

1. **Registration Form Validation**
   - Email format validation
   - Password strength check (min 8 chars, uppercase, lowercase, number, special char)
   - Phone number format validation
   - Duplicate email check

2. **Email Verification Process**
   - Send verification link with 24-hour expiry
   - Allow resend after 60 seconds
   - Auto-login after verification

3. **KYC Process (if required)**
   - Document types: ID card, passport, driver's license
   - Proof of address: Utility bill, bank statement
   - Selfie with ID for verification
   - Automated OCR scanning
   - Manual review queue for admin

4. **Subscription Selection**
   - Show feature comparison table
   - Calculate pro-rated billing
   - Apply referral/promo codes
   - Show local currency pricing

### 1.2 First-Time Setup Flow

```mermaid
flowchart LR
    Login([User logs in]) --> Tutorial{Show tutorial?}
    Tutorial -->|Yes| Guide[Interactive guide]
    Guide --> Demo[Demo strategy]
    Demo --> Connect
    Tutorial -->|No| Connect[Connect broker]
    Connect --> Download[Download executor]
    Download --> Install[Install & configure]
    Install --> Test[Test connection]
    Test -->|Success| Ready[Ready to trade]
    Test -->|Failed| Troubleshoot[Troubleshooting]
    Troubleshoot --> Test
```

## 2. Strategy Creation Workflows

### 2.1 Manual Strategy Builder

```mermaid
stateDiagram-v2
    [*] --> ChooseSymbol
    ChooseSymbol --> SetTimeframe
    SetTimeframe --> AddEntryRules
    
    AddEntryRules --> AddIndicator
    AddIndicator --> SetCondition
    SetCondition --> AddMoreIndicators
    AddMoreIndicators --> AddIndicator
    AddMoreIndicators --> SetLogic
    
    SetLogic --> AddExitRules
    AddExitRules --> SetTP
    SetTP --> SetSL
    SetSL --> SetTrailing
    
    SetTrailing --> RiskManagement
    RiskManagement --> SetLotSize
    SetLotSize --> SetMaxPositions
    SetMaxPositions --> SetMaxLoss
    
    SetMaxLoss --> Review
    Review --> Backtest
    Backtest --> Optimize
    Optimize --> Backtest
    Optimize --> SaveStrategy
    SaveStrategy --> [*]
```

**Step-by-Step Process:**

1. **Symbol & Timeframe Selection**
   ```typescript
   interface StrategyBasics {
     name: string;
     description: string;
     symbol: 'EURUSD' | 'GBPUSD' | 'XAUUSD' | etc;
     timeframe: 'M1' | 'M5' | 'M15' | 'M30' | 'H1' | 'H4' | 'D1';
   }
   ```

2. **Entry Rules Configuration**
   - Add technical indicators
   - Set comparison conditions
   - Define logical operators (AND/OR)
   - Preview signal generation

3. **Exit Rules Setup**
   - Take Profit: Fixed pips, ATR multiple, or percentage
   - Stop Loss: Fixed pips, ATR multiple, or percentage  
   - Trailing Stop: Enable/disable, distance configuration
   - Time-based exits: Max holding period

4. **Risk Management**
   - Position sizing method
   - Maximum simultaneous positions
   - Daily/weekly loss limits
   - Margin requirements check

### 2.2 AI-Powered Strategy Generation

```mermaid
sequenceDiagram
    participant User
    participant UI
    participant API
    participant OpenRouter
    participant Backtest
    
    User->>UI: Enter natural language prompt
    UI->>UI: Show example prompts
    User->>UI: Select parameters (symbol, risk)
    UI->>API: POST /api/strategy/generate
    API->>OpenRouter: Send prompt with context
    OpenRouter->>API: Return strategy JSON
    API->>API: Validate & sanitize
    API->>UI: Return generated strategy
    UI->>UI: Display visual representation
    User->>UI: Request modifications
    UI->>API: Refine strategy
    API->>OpenRouter: Send refinement prompt
    OpenRouter->>API: Return updated strategy
    API->>UI: Show updated version
    User->>UI: Approve strategy
    UI->>Backtest: Run initial backtest
    Backtest->>UI: Show results
    User->>UI: Save strategy
```

**AI Prompt Examples:**

1. **Trend Following**
   ```
   "Create a trend-following strategy for EURUSD on H1 timeframe. 
   Enter long when price crosses above 50 EMA and RSI is above 50. 
   Use 2:1 risk-reward ratio with 30 pip stop loss."
   ```

2. **Mean Reversion**
   ```
   "Build a mean reversion strategy for GBPUSD. Buy when RSI drops 
   below 20 and price touches lower Bollinger Band. Sell when price 
   reaches middle band. Maximum 3 positions open simultaneously."
   ```

3. **Breakout Strategy**
   ```
   "Design a breakout strategy that enters trades when price breaks 
   above the previous day's high with above-average volume. Set stop 
   loss at the previous day's low."
   ```

### 2.3 Strategy Import

```yaml
Supported Formats:
  - TradingView Pine Script
  - MetaTrader 4/5 EA (basic)
  - JSON strategy format
  - CSV with trade rules
  
Import Process:
  1. Upload file
  2. Parse and validate
  3. Convert to internal format
  4. Show conversion summary
  5. Allow manual adjustments
  6. Save as new strategy
```

## 3. Backtesting Workflow

### 3.1 Standard Backtest

```mermaid
flowchart TD
    Start([Select strategy]) --> Period[Choose date range]
    Period --> Settings[Configure settings]
    Settings --> Queue[Add to queue]
    Queue --> Process{Processing}
    Process --> Progress[Show progress]
    Progress --> Complete{Complete?}
    Complete -->|No| Progress
    Complete -->|Yes| Results[Display results]
    Results --> Analyze[Analyze metrics]
    Analyze --> Decision{Satisfied?}
    Decision -->|No| Optimize[Adjust parameters]
    Optimize --> Queue
    Decision -->|Yes| Activate[Activate strategy]
```

**Backtest Configuration:**

```typescript
interface BacktestConfig {
  strategy: string;
  dateRange: {
    from: Date;
    to: Date;
  };
  marketConditions: {
    spread: number;        // in pips
    commission: number;    // per lot
    slippage: number;     // in pips
    swapRates: boolean;   // include swap
  };
  moneyManagement: {
    initialBalance: number;
    compounding: boolean;
    riskPerTrade: number; // percentage
  };
  dataQuality: 'tick' | '1min' | '5min';
}
```

### 3.2 Walk-Forward Analysis

```mermaid
flowchart LR
    Data[Historical data] --> Split[Split into segments]
    Split --> IS1[In-sample 1]
    Split --> OOS1[Out-sample 1]
    IS1 --> Optimize1[Optimize]
    Optimize1 --> Test1[Test on OOS1]
    Test1 --> IS2[In-sample 2]
    IS2 --> Optimize2[Optimize]
    Optimize2 --> Test2[Test on OOS2]
    Test2 --> Combine[Combine results]
    Combine --> Report[Final report]
```

### 3.3 Monte Carlo Simulation

```yaml
Process:
  1. Run base backtest
  2. Generate random variations:
     - Trade order shuffling
     - Random skipping of trades
     - Spread/slippage variations
     - Starting point variations
  3. Run 1000+ iterations
  4. Calculate statistics:
     - Confidence intervals
     - Probability of ruin
     - Expected drawdown
  5. Display distribution charts
```

## 4. Live Trading Workflow

### 4.1 Strategy Activation

```mermaid
stateDiagram-v2
    [*] --> SelectStrategy
    SelectStrategy --> ConfigureRisk
    ConfigureRisk --> SelectExecutor
    SelectExecutor --> ValidateAccount
    
    ValidateAccount --> CheckBalance
    CheckBalance --> CheckMargin
    CheckMargin --> CheckSubscription
    
    CheckSubscription --> Deploy
    Deploy --> SendToExecutor
    SendToExecutor --> ConfirmReceipt
    ConfirmReceipt --> StartMonitoring
    
    StartMonitoring --> Active
    Active --> Trading
    Trading --> Active
    
    Active --> Pause
    Pause --> Resume
    Resume --> Active
    
    Active --> Stop
    Stop --> [*]
```

### 4.2 Trade Execution Flow

```mermaid
sequenceDiagram
    participant Market
    participant MT5
    participant EA
    participant Executor
    participant Supervisor
    participant AI
    
    Market->>MT5: Price tick
    MT5->>EA: OnTick event
    EA->>Executor: Market data (ZMQ)
    
    Executor->>Executor: Evaluate strategy
    
    alt Entry signal detected
        Executor->>Executor: Check risk limits
        
        opt AI Supervision enabled
            Executor->>Supervisor: Request AI analysis
            Supervisor->>AI: Analyze conditions
            AI->>Supervisor: Recommendation
            Supervisor->>Executor: Response
        end
        
        alt Approved to trade
            Executor->>EA: Open position command
            EA->>MT5: OrderSend
            MT5->>EA: Order result
            EA->>Executor: Confirmation
            Executor->>Supervisor: Report trade
            Supervisor->>Supervisor: Update database
            Supervisor-->>User: Push notification
        else Rejected
            Executor->>Supervisor: Log rejection
        end
    end
    
    loop Position monitoring
        MT5->>EA: Position update
        EA->>Executor: Position status
        Executor->>Executor: Check exit conditions
        
        alt Exit signal
            Executor->>EA: Close position
            EA->>MT5: OrderClose
            MT5->>EA: Close result
            EA->>Executor: Confirmation
            Executor->>Supervisor: Report closure
        end
    end
```

### 4.3 Risk Management Flow

```mermaid
flowchart TD
    Trade[New trade signal] --> Check1{Daily loss < limit?}
    Check1 -->|No| Reject[Reject trade]
    Check1 -->|Yes| Check2{Open positions < max?}
    Check2 -->|No| Reject
    Check2 -->|Yes| Check3{Margin available?}
    Check3 -->|No| Reject
    Check3 -->|Yes| Check4{Risk per trade OK?}
    Check4 -->|No| Adjust[Adjust lot size]
    Adjust --> Check4
    Check4 -->|Yes| Check5{Correlation check}
    Check5 -->|High correlation| Reduce[Reduce position size]
    Reduce --> Execute[Execute trade]
    Check5 -->|OK| Execute
    
    Execute --> Monitor[Monitor position]
    Monitor --> Update{Update metrics}
    Update --> Trail{Trailing stop?}
    Trail -->|Yes| MoveStop[Adjust stop loss]
    Trail -->|No| Monitor
    MoveStop --> Monitor
```

## 5. Mobile Control Workflow

### 5.1 Remote Monitoring

```yaml
Real-time Updates:
  - Position status (P&L, pips)
  - Account metrics (balance, equity, margin)
  - Strategy performance
  - Executor health status
  
Push Notifications:
  Triggers:
    - New position opened
    - Position closed
    - Daily profit/loss threshold
    - Margin call warning
    - Strategy error
    - Connection lost
    
  Customization:
    - Enable/disable per event type
    - Quiet hours setting
    - Importance levels
    - Sound/vibration settings
```

### 5.2 Emergency Intervention

```mermaid
sequenceDiagram
    participant User
    participant Mobile
    participant API
    participant Database
    participant Executor
    participant EA
    
    User->>Mobile: Press emergency stop
    Mobile->>Mobile: Confirm action
    User->>Mobile: Confirm
    Mobile->>API: POST /api/command/emergency
    API->>Database: Queue command
    API->>Mobile: Command queued
    
    loop Executor polling
        Executor->>API: GET /api/command/pending
        API->>Database: Check queue
        Database->>API: Return commands
        API->>Executor: Emergency stop command
        
        Executor->>Executor: Process command
        Executor->>EA: Close all positions
        EA->>EA: Close positions loop
        EA->>Executor: Positions closed
        
        Executor->>EA: Disable auto trading
        EA->>Executor: Confirmed
        
        Executor->>API: POST /api/command/ack
        API->>Database: Update status
        API-->>Mobile: Push notification
    end
    
    Mobile->>User: Show success message
```

## 6. Analytics & Reporting Workflow

### 6.1 Performance Dashboard

```yaml
Dashboard Sections:
  1. Account Overview:
     - Current balance
     - Today's P&L
     - Open positions
     - Active strategies
     
  2. Performance Metrics:
     - Win rate
     - Profit factor  
     - Sharpe ratio
     - Maximum drawdown
     
  3. Charts:
     - Equity curve
     - Monthly returns
     - Win/loss distribution
     - Strategy comparison
     
  4. Recent Activity:
     - Last 10 trades
     - Recent signals
     - System events
```

### 6.2 Report Generation

```mermaid
flowchart LR
    Select[Select period] --> Type{Report type}
    Type -->|Trading| TradingReport[Generate trading report]
    Type -->|Tax| TaxReport[Generate tax report]
    Type -->|Performance| PerfReport[Generate performance report]
    
    TradingReport --> Format1{Format}
    TaxReport --> Format2{Format}
    PerfReport --> Format3{Format}
    
    Format1 -->|PDF| GeneratePDF1[Create PDF]
    Format1 -->|Excel| GenerateExcel1[Create Excel]
    Format1 -->|CSV| GenerateCSV1[Create CSV]
    
    GeneratePDF1 --> Download[Download file]
    GenerateExcel1 --> Download
    GenerateCSV1 --> Download
    
    Download --> Email{Email?}
    Email -->|Yes| SendEmail[Send to email]
    Email -->|No| Complete[Complete]
```

## 7. Troubleshooting Workflow

### 7.1 Connection Issues

```mermaid
flowchart TD
    Issue[Connection lost] --> Type{Issue type}
    
    Type -->|API| CheckAPI[Check API status]
    CheckAPI --> APIStatus{API online?}
    APIStatus -->|No| WaitAPI[Wait for API]
    APIStatus -->|Yes| CheckCreds[Check credentials]
    CheckCreds --> CredsValid{Valid?}
    CredsValid -->|No| UpdateCreds[Update credentials]
    CredsValid -->|Yes| Reconnect1[Reconnect]
    
    Type -->|MT5| CheckMT5[Check MT5]
    CheckMT5 --> MT5Running{Running?}
    MT5Running -->|No| StartMT5[Start MT5]
    MT5Running -->|Yes| CheckEA[Check EA]
    CheckEA --> EAActive{EA active?}
    EAActive -->|No| ActivateEA[Activate EA]
    EAActive -->|Yes| CheckZMQ[Check ZMQ]
    CheckZMQ --> Reconnect2[Reconnect]
    
    Type -->|Network| CheckNetwork[Check network]
    CheckNetwork --> Internet{Internet OK?}
    Internet -->|No| FixNetwork[Fix network]
    Internet -->|Yes| CheckFirewall[Check firewall]
    CheckFirewall --> Reconnect3[Reconnect]
    
    Reconnect1 --> Success{Connected?}
    Reconnect2 --> Success
    Reconnect3 --> Success
    Success -->|Yes| Resume[Resume trading]
    Success -->|No| Support[Contact support]
```

### 7.2 Strategy Debugging

```yaml
Debug Steps:
  1. Check strategy status:
     - Is it active?
     - Any error messages?
     - Last execution time
     
  2. Verify market conditions:
     - Is market open?
     - Spread within limits?
     - Sufficient liquidity?
     
  3. Review entry conditions:
     - Indicator values
     - Condition evaluation
     - Logic (AND/OR) results
     
  4. Check risk limits:
     - Daily loss limit
     - Position limits
     - Margin requirements
     
  5. Examine logs:
     - Executor logs
     - EA logs
     - API logs
     
  6. Run diagnostic:
     - Test connection
     - Verify data feed
     - Check account status
```

## 8. Subscription Management Workflow

### 8.1 Upgrade/Downgrade

```mermaid
stateDiagram-v2
    [*] --> CurrentPlan
    CurrentPlan --> ViewPlans
    ViewPlans --> SelectNewPlan
    
    SelectNewPlan --> Compare
    Compare --> Confirm
    
    Confirm --> CheckBilling
    CheckBilling --> Proration
    
    Proration --> Payment
    Payment --> UpdateSubscription
    
    UpdateSubscription --> UpdateLimits
    UpdateLimits --> NotifyUser
    NotifyUser --> [*]
```

### 8.2 Payment Processing

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API
    participant Stripe
    participant Database
    
    User->>Frontend: Select plan
    Frontend->>API: Create checkout session
    API->>Stripe: Create session
    Stripe->>API: Session ID
    API->>Frontend: Redirect URL
    Frontend->>Stripe: Redirect to checkout
    
    User->>Stripe: Complete payment
    Stripe->>API: Webhook (payment success)
    API->>Database: Update subscription
    API->>Database: Log transaction
    API->>User: Send receipt email
    
    API->>Frontend: Update UI
    Frontend->>User: Show success
```

## 9. Security Workflows

### 9.1 Two-Factor Authentication Setup

```yaml
Setup Process:
  1. Navigate to Security Settings
  2. Click "Enable 2FA"
  3. Choose method:
     - Authenticator app (TOTP)
     - SMS (backup)
  4. Scan QR code or enter secret
  5. Enter verification code
  6. Save backup codes
  7. Confirm activation
  
Usage:
  - Login: Email + Password + 2FA code
  - Sensitive actions require 2FA:
    - Strategy deletion
    - API key generation
    - Withdrawal requests
    - Account changes
```

### 9.2 API Key Management

```mermaid
flowchart TD
    Request[Request new API key] --> Auth[Authenticate with 2FA]
    Auth --> Generate[Generate key pair]
    Generate --> Display[Display once]
    Display --> Warning[Show security warning]
    Warning --> Store{User stores safely?}
    Store -->|Yes| Activate[Activate key]
    Store -->|No| Cancel[Cancel generation]
    
    Activate --> SetPermissions[Set permissions]
    SetPermissions --> SetIPWhitelist[Set IP whitelist]
    SetIPWhitelist --> SetExpiry[Set expiry date]
    SetExpiry --> Complete[Key active]
    
    Complete --> Monitor[Monitor usage]
    Monitor --> Anomaly{Anomaly detected?}
    Anomaly -->|Yes| Alert[Alert user]
    Alert --> Suspend{Suspend key?}
    Suspend -->|Yes| Deactivate[Deactivate key]
    Anomaly -->|No| Monitor
```

## 10. Customer Support Workflow

### 10.1 Issue Resolution

```mermaid
flowchart TD
    User[User has issue] --> Check[Check documentation]
    Check --> Resolved1{Resolved?}
    Resolved1 -->|Yes| End1[End]
    Resolved1 -->|No| Category{Issue category}
    
    Category -->|Technical| TechSupport[Technical support]
    Category -->|Billing| BillingSupport[Billing support]
    Category -->|Strategy| StrategySupport[Strategy support]
    
    TechSupport --> Ticket1[Create ticket]
    BillingSupport --> Ticket2[Create ticket]
    StrategySupport --> Community{Try community?}
    
    Community -->|Yes| Forum[Post in forum]
    Forum --> Resolved2{Resolved?}
    Resolved2 -->|Yes| End2[End]
    Resolved2 -->|No| Ticket3[Create ticket]
    Community -->|No| Ticket3
    
    Ticket1 --> Assign[Auto-assign to agent]
    Ticket2 --> Assign
    Ticket3 --> Assign
    
    Assign --> Investigate[Agent investigates]
    Investigate --> Solution{Solution found?}
    Solution -->|Yes| Apply[Apply solution]
    Apply --> Verify[Verify with user]
    Verify --> Resolved3{Resolved?}
    Resolved3 -->|Yes| Close[Close ticket]
    Resolved3 -->|No| Escalate[Escalate]
    Solution -->|No| Escalate
    
    Escalate --> Senior[Senior support]
    Senior --> Resolve[Resolve issue]
    Resolve --> Document[Document solution]
    Document --> Close
```

### 10.2 Feature Request

```yaml
Process:
  1. User submits request via:
     - In-app feedback form
     - Community forum
     - Support ticket
     
  2. Initial review:
     - Check if already exists
     - Check if planned
     - Assess feasibility
     
  3. Community voting:
     - Post to feature board
     - Allow user voting
     - Gather feedback
     
  4. Prioritization:
     - Technical complexity
     - Business value
     - User demand
     - Strategic fit
     
  5. Implementation:
     - Add to roadmap
     - Assign to sprint
     - Development
     - Testing
     - Beta release
     - Full rollout
     
  6. Communication:
     - Notify requester
     - Update changelog
     - Create tutorial
```

## Best Practices & Tips

### For New Users

1. **Start with Paper Trading**
   - Test strategies without real money
   - Understand platform features
   - Build confidence

2. **Use Conservative Settings Initially**
   - Small position sizes
   - Tight stop losses
   - Limited daily risk

3. **Monitor Actively at First**
   - Watch how strategies execute
   - Understand market behavior
   - Learn from each trade

### For Strategy Development

1. **Backtest Thoroughly**
   - Use multiple time periods
   - Include different market conditions
   - Account for transaction costs

2. **Diversify Strategies**
   - Don't rely on single strategy
   - Use different timeframes
   - Trade multiple instruments

3. **Regular Optimization**
   - Review performance monthly
   - Adjust to market changes
   - Remove underperforming strategies

### For Risk Management

1. **Set Appropriate Limits**
   - Never risk more than 2% per trade
   - Daily loss limit: 6% of account
   - Use correlation analysis

2. **Monitor Drawdowns**
   - Set maximum drawdown limits
   - Scale down during losses
   - Take breaks after losing streaks

3. **Keep Records**
   - Document all changes
   - Track performance metrics
   - Regular review sessions
