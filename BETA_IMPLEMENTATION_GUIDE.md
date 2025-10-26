# Beta Testing Implementation Guide
**Platform**: NusaNexus FX Trading Platform  
**Target Launch**: 6 November 2025  
**Phase**: Internal Beta → Limited Beta → Open Beta

## ✅ **COMPLETED IMPLEMENTATIONS**

### 1. Beta Configuration System
**File**: `src/config/beta.config.ts`
- ✅ Beta mode toggle
- ✅ Trading limits (max lot size 0.01, max positions 3)
- ✅ Symbol whitelist (EURUSD, GBPUSD, USDJPY, AUDUSD)
- ✅ Rate limiting configuration
- ✅ Account restrictions (demo only, max executors)
- ✅ Phase management (internal/limited/open)

### 2. Shared Secret Authentication System
**File**: `src/lib/auth/shared-secret.ts`
- ✅ Shared secret generation (SHA256-based)
- ✅ HMAC signature validation
- ✅ Nonce manager for replay attack prevention
- ✅ Command signing and validation
- ✅ Token-based authentication with expiry

### 3. Rate Limiting Middleware
**File**: `src/lib/middleware/rate-limit.ts`
- ✅ In-memory rate limiter
- ✅ API rate limiting (30 req/min)
- ✅ Trade rate limiting (10 trades/min)
- ✅ Automatic cleanup of old records
- ✅ Rate limit headers in responses

### 4. Audit Logging System
**File**: `src/lib/audit/audit-logger.ts`
- ✅ Comprehensive audit event types
- ✅ Database logging (Prisma)
- ✅ File-based backup logging
- ✅ Critical event alerting
- ✅ Trade logging, executor logging, emergency logging
- ✅ Query interface for audit trails

### 5. Database Schema Updates
**File**: `prisma/schema.prisma`
- ✅ Enhanced AuditLog model with new fields
- ✅ Added sharedSecret field to Executor model
- ✅ Added executorId index to AuditLog
- ✅ Added success/error tracking fields

### 6. Executor API Enhancements
**File**: `src/app/api/executor/route.ts`
- ✅ Integrated beta limits for executor creation
- ✅ Shared secret generation on executor creation
- ✅ Bcrypt hashing for API secrets (already existed)
- ✅ Audit logging integration
- ✅ Return shared secret in creation response

### 7. Enhanced EA with Authentication
**File**: `windows-executor/resources/experts/FX_NusaNexus_Beta.mq5`
- ✅ Shared secret input parameter
- ✅ Token validation for all commands
- ✅ Failed authentication tracking
- ✅ Auto-blocking after failed attempts
- ✅ Authentication status in responses

## 🔄 **IN PROGRESS / NEEDS COMPLETION**

### 8. Windows Executor Updates
**Required Changes**:
```typescript
// 1. Display shared secret in UI after executor creation
// Location: windows-executor/src/app/pages/Setup.tsx or Settings.tsx

// Show in setup flow:
{
  apiKey: "exe_...",
  secretKey: "...",
  sharedSecret: "..." // NEW - For EA configuration
}

// 2. Auto-copy shared secret functionality
// 3. Instructions for EA configuration
// 4. Validate commands with shared secret before sending

// Update command service:
// Location: windows-executor/src/services/command.service.ts
import crypto from 'crypto';

class CommandService {
  private sharedSecret: string;
  
  async sendCommand(command: any) {
    // Add authentication token
    const commandWithAuth = {
      ...command,
      token: this.sharedSecret,
      timestamp: Date.now()
    };
    
    return this.zeromqService.send(commandWithAuth);
  }
}
```

### 9. Complete FX_NusaNexus_Beta.mq5
**Required**: Copy all trading functions from original FX_NusaNexus.mq5:
- GetHistoricalBars()
- GetCurrentPrice()
- ExecuteOpenPosition()
- ExecuteClosePosition()
- GetAccountInfoJSON()
- StringToTimeframe()
- ParseNumberParam()

### 10. Web Platform Rate Limiting Integration
**Files to Update**:
```typescript
// src/app/api/strategy/route.ts
import { rateLimit } from '@/lib/middleware/rate-limit';

export async function POST(req: NextRequest) {
  const rateLimitResponse = await rateLimit(req);
  if (rateLimitResponse) return rateLimitResponse;
  // ... existing code
}

// Same for:
// - src/app/api/backtest/route.ts
// - src/app/api/command/route.ts
// - src/app/api/supervisor/route.ts
```

### 11. Emergency Stop Implementation
**Location**: `windows-executor/src/app/EmergencyStop.tsx`
```typescript
export const EmergencyStopButton = () => {
  const handleEmergencyStop = async () => {
    if (!confirm('⚠️ EMERGENCY STOP\n\nThis will:\n- Stop all running strategies\n- Close all open positions\n- Disconnect from MT5\n\nContinue?')) {
      return;
    }
    
    try {
      // Close all positions
      await commandService.closeAllPositions();
      
      // Stop all strategies
      await strategyService.stopAll();
      
      // Log emergency event
      await AuditLogger.logEmergency(
        AuditAction.EMERGENCY_STOP_TRIGGERED,
        userId,
        { reason: 'User initiated' }
      );
      
      alert('✅ Emergency stop completed');
    } catch (error) {
      console.error('Emergency stop failed:', error);
    }
  };
  
  return (
    <button 
      onClick={handleEmergencyStop}
      className="bg-red-600 text-white px-6 py-3 rounded-lg font-bold"
    >
      🛑 EMERGENCY STOP
    </button>
  );
};
```

### 12. Command Validation Layer
**Location**: `windows-executor/src/services/command-validator.service.ts`
```typescript
import { BETA_CONFIG, validateBetaRestrictions } from '@/config/beta.config';

export class CommandValidator {
  validateTrade Command(command: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Beta restrictions
    if (BETA_CONFIG.enabled) {
      const betaValidation = validateBetaRestrictions('OPEN_POSITION', command);
      if (!betaValidation.valid) {
        errors.push(...betaValidation.errors);
      }
    }
    
    // General validations
    if (command.lotSize <= 0) {
      errors.push('Lot size must be positive');
    }
    
    if (!command.symbol) {
      errors.push('Symbol is required');
    }
    
    // Safety checks
    const openPositions = await this.getOpenPositions();
    if (openPositions.length >= BETA_CONFIG.limits.maxPositions) {
      errors.push(`Maximum ${BETA_CONFIG.limits.maxPositions} positions allowed in beta`);
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}
```

## 📝 **MIGRATION STEPS**

### Step 1: Database Migration
```bash
# Generate migration
npx prisma migrate dev --name add_beta_features

# Or if already deployed:
npx prisma db push
```

### Step 2: Environment Variables
Add to `.env`:
```env
BETA_MODE=true
MAX_LOT_SIZE=0.01
MAX_POSITIONS=3
MAX_DAILY_TRADES=20
```

### Step 3: Install Dependencies
```bash
# If not already installed
npm install bcryptjs @types/bcryptjs
```

### Step 4: Update EA
1. Copy all functions from `FX_NusaNexus.mq5` to `FX_NusaNexus_Beta.mq5`
2. Compile EA in MetaEditor
3. Replace EA in `windows-executor/resources/experts/`

### Step 5: Update Windows Executor
1. Update command service to include shared secret
2. Update UI to display shared secret
3. Add emergency stop button
4. Rebuild executor: `npm run build`

### Step 6: Web Platform Updates
1. Add rate limiting to all API routes
2. Test executor creation flow
3. Verify shared secret is returned
4. Test authentication flow

## 🧪 **TESTING CHECKLIST**

### Pre-Launch Testing:
- [ ] Create executor → verify shared secret returned
- [ ] Configure EA with shared secret
- [ ] Send PING command → verify authentication works
- [ ] Send PING without token → verify rejection
- [ ] Send PING with wrong token → verify rejection
- [ ] Test rate limiting (send 40 requests → verify 429)
- [ ] Test lot size limit (try 0.1 lot → verify rejection)
- [ ] Test symbol restriction (try XAUUSD → verify rejection)
- [ ] Test max positions (open 4 positions → verify rejection)
- [ ] Test emergency stop button
- [ ] Verify audit logs are created
- [ ] Test failed auth blocking (5 bad attempts → verify block)

### Security Testing:
- [ ] Verify API secrets are hashed in database
- [ ] Verify shared secrets are not logged
- [ ] Test replay attack prevention
- [ ] Verify rate limiting works
- [ ] Test command validation

## 📊 **MONITORING SETUP**

### Daily Monitoring (First Week):
```bash
# Check audit logs
SELECT action, COUNT(*) 
FROM "AuditLog" 
WHERE DATE(timestamp) = CURRENT_DATE 
GROUP BY action;

# Check failed authentications
SELECT executorId, COUNT(*) as failures
FROM "AuditLog"
WHERE action = 'UNAUTHORIZED_ACCESS'
AND DATE(timestamp) = CURRENT_DATE
GROUP BY executorId;

# Check rate limit hits
SELECT COUNT(*) as rate_limit_hits
FROM "AuditLog"
WHERE action = 'RATE_LIMIT_EXCEEDED'
AND DATE(timestamp) = CURRENT_DATE;
```

## 🚀 **LAUNCH TIMELINE**

### Week 1 (27 Oct - 2 Nov): Development
- Complete Windows Executor updates
- Finish FX_NusaNexus_Beta.mq5
- Add rate limiting to all routes
- Implement emergency stop

### Week 2 (3-5 Nov): Testing
- Internal testing with team
- Fix bugs
- Performance testing
- Security audit

### Week 3 (6 Nov): Beta Launch
- **6 November**: Launch internal beta (5-10 testers)
- Monitor 24/7 for first 48 hours
- Gather feedback
- Hot-fix critical issues

### Week 4-5 (7-20 Nov): Limited Beta
- Expand to 20-30 testers
- Continue monitoring
- Implement feedback
- Prepare for open beta

### Week 6+ (21 Nov): Open Beta
- Open to 100 testers
- Marketing campaign
- Community engagement
- Bug bounty program

## ⚠️ **BETA DISCLAIMER**

Add to Terms & Conditions:
```
BETA TESTING AGREEMENT

1. SOFTWARE STATUS
   This is BETA software under active development. Bugs and issues are expected.

2. DEMO ACCOUNTS REQUIRED
   For the first 2 weeks, only DEMO accounts are permitted.
   Maximum lot size: 0.01 (micro lots)

3. NO LIABILITY
   NusaNexus Trading Systems accepts NO LIABILITY for any losses,
   whether in demo or live accounts.

4. DATA RETENTION
   Beta testing data may be reset at any time without notice.

5. PARTICIPATION REQUIREMENTS
   By participating, you agree to:
   - Provide detailed feedback on bugs and issues
   - Test assigned features thoroughly
   - Report any security vulnerabilities immediately
   - Not share beta access credentials

6. TERMINATION
   Beta access may be revoked at any time for:
   - Violation of terms
   - Abusive behavior
   - Security concerns
   - End of beta period

7. CONFIDENTIALITY
   Beta features and roadmap are confidential.
   Do not share screenshots or details publicly without permission.
```

## 📞 **SUPPORT CHANNELS**

Setup for beta testers:
- Discord Server: Beta Testing Channel
- Email: beta@fx.nusanexus.com
- Bug Tracker: GitHub Issues (private repo)
- Emergency Contact: (Your phone number)

## ✨ **SUCCESS METRICS**

Track during beta:
- User signups / activations
- Strategies created
- Trades executed (demo)
- Bug reports / severity
- User retention (day 1, 7, 30)
- Feature requests
- Net Promoter Score (NPS)

---

**Next Steps**: Complete items 8-12, then proceed to testing phase.

**Estimated Time to Beta Ready**: 3-5 days focused development.

**Contact for Questions**: See PLATFORM_AUDIT_REPORT.md for full system overview.
