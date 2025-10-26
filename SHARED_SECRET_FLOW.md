# Shared Secret Authentication Flow
**Simple & Secure Authentication for EA-Executor Communication**

## 📋 **Overview**

The platform uses **Shared Secret** authentication to secure communication between:
- **Windows Executor** ↔ **Web Platform** (API Key + Secret Key)
- **MT5 EA** ↔ **Windows Executor** (Shared Secret)

This approach is **perfect for localhost** because:
- ✅ Simple for users (one-time setup)
- ✅ Secure enough for localhost communication
- ✅ No performance overhead (no heavy encryption)
- ✅ Easy to rotate if compromised

## 🔐 **Credentials Breakdown**

### 1. API Key
**Purpose**: Identify the executor  
**Format**: `exe_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`  
**Used By**: Windows Executor → Web Platform  
**Stored**: Database (plain text, it's just an identifier)

### 2. Secret Key
**Purpose**: Authenticate the executor  
**Format**: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` (64 chars)  
**Used By**: Windows Executor → Web Platform  
**Stored**: Database (bcrypt hashed)

### 3. Shared Secret
**Purpose**: Authenticate EA commands  
**Format**: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` (32 chars)  
**Used By**: MT5 EA → Windows Executor  
**Stored**: 
- Database (plain text, for validation)
- EA settings (user manually inputs)

## 🔄 **Complete Flow Diagram**

```
┌─────────────────────────────────────────────────────────────────┐
│                      1. EXECUTOR CREATION                       │
└─────────────────────────────────────────────────────────────────┘

User in Web Platform:
├── Clicks "Add New Executor"
├── Enters name & platform (MT5/MT4)
└── Clicks "Create"

Web Platform API:
├── Generates:
│   ├── apiKey: "exe_xxxxx"
│   ├── secretKey: "random_64_char_string"
│   │   └── Hashed with bcrypt before storing
│   └── sharedSecret: SHA256(apiKey + secretKey + timestamp)
├── Stores in database:
│   ├── apiKey (plain)
│   ├── apiSecretHash (bcrypt hashed)
│   └── sharedSecret (plain, for validation)
└── Returns JSON:
    {
      "executor": {
        "apiKey": "exe_xxxxx",
        "secretKey": "xxxxx",  // ⚠️ Only shown once!
        "sharedSecret": "xxxxx" // ⚠️ Only shown once!
      }
    }

Web Platform UI:
├── Shows modal with 3 sections:
│   ├── 🖥️ For Windows Executor
│   │   ├── API Key (with copy button)
│   │   └── Secret Key (with copy button)
│   │
│   ├── 📊 For MT5 EA
│   │   └── Shared Secret (with copy button)
│   │
│   └── 📝 Setup Instructions
│       └── Step-by-step guide
└── User copies all credentials

┌─────────────────────────────────────────────────────────────────┐
│                   2. WINDOWS EXECUTOR SETUP                     │
└─────────────────────────────────────────────────────────────────┘

User in Windows Executor:
├── Opens Settings
├── Pastes:
│   ├── API Key: "exe_xxxxx"
│   └── Secret Key: "xxxxx"
└── Clicks "Save"

Windows Executor:
├── Validates credentials with Web Platform
│   POST /api/auth/validate
│   Headers: {
│     "X-API-Key": "exe_xxxxx",
│     "X-API-Secret": "xxxxx"
│   }
├── Web Platform validates:
│   ├── Find executor by apiKey
│   ├── Compare bcrypt(secretKey) with stored hash
│   └── Return success/fail
└── If valid:
    ├── Save credentials locally
    ├── Connect to platform
    └── Start listening for commands

┌─────────────────────────────────────────────────────────────────┐
│                      3. MT5 EA CONFIGURATION                    │
└─────────────────────────────────────────────────────────────────┘

User in MT5:
├── Drag "FX_NusaNexus_Beta.mq5" to chart
├── EA Settings dialog opens
├── Input parameters:
│   ├── InpPushAddress: "tcp://127.0.0.1:5555" (default)
│   ├── InpReplyAddress: "tcp://127.0.0.1:5556" (default)
│   └── InpSharedSecret: "xxxxx" ← User pastes here
└── Click OK

EA Initialization:
├── Checks if InpSharedSecret is empty
│   ├── If empty: ⚠️ WARNING (no auth)
│   └── If filled: ✅ Auth enabled
├── Connects to Windows Executor via ZeroMQ
│   ├── REQ socket → port 5555
│   └── REP socket ← port 5556
└── Ready to receive commands

┌─────────────────────────────────────────────────────────────────┐
│                   4. COMMAND EXECUTION FLOW                     │
└─────────────────────────────────────────────────────────────────┘

User in Web Platform:
├── Creates/activates strategy
└── Strategy triggers trade signal

Web Platform → Windows Executor:
├── Sends command via WebSocket/Pusher
└── Command: {
    "command": "OPEN_POSITION",
    "symbol": "EURUSD",
    "action": "BUY",
    "lotSize": 0.01,
    ...
}

Windows Executor:
├── Receives command from platform
├── Validates with command validator
│   ├── Check beta limits (lot size, symbol)
│   ├── Check max positions
│   └── If invalid: reject and log
├── Adds authentication token:
    const authenticatedCommand = {
      ...command,
      token: this.sharedSecret, // ← Add shared secret
      timestamp: Date.now()
    }
└── Sends to EA via ZeroMQ (port 5556)

MT5 EA:
├── Receives command on port 5556
├── ValidateAuth(request):
│   ├── Extract token from request
│   ├── Compare token with InpSharedSecret
│   ├── If match: ✅ proceed
│   └── If mismatch:
│       ├── Increment g_failedAuthCount
│       ├── If count >= 5: block for 5 minutes
│       └── Return {"status": "ERROR", "message": "Authentication failed"}
├── If authenticated:
│   ├── Execute trade via CTrade
│   └── Return result to Windows Executor
└── Windows Executor returns result to Web Platform

┌─────────────────────────────────────────────────────────────────┐
│                    5. SECURITY FEATURES                         │
└─────────────────────────────────────────────────────────────────┘

Failed Authentication Tracking:
int g_failedAuthCount = 0;
datetime g_lastAuthFailure = 0;

After 5 failed attempts:
├── Block all commands for 5 minutes
├── Log: "🚫 Authentication blocked"
└── Auto-unblock after timeout

Replay Attack Prevention:
├── Optional: Add nonce in Windows Executor
└── Validate timestamp (reject if > 30 seconds old)

Rate Limiting (Web Platform):
├── API requests: 30/minute
├── Trade commands: 10/minute
└── Return 429 if exceeded
```

## 🛡️ **Security Comparison**

### With Shared Secret (Current Implementation):
```
✅ Prevents unauthorized commands
✅ Auto-blocks after failed attempts
✅ Simple for users to setup
✅ Good enough for localhost
✅ No performance overhead
⚠️ Shared secret visible in EA settings
⚠️ No encryption on wire (but localhost only)
```

### Without Shared Secret (Previous):
```
❌ Any process can send commands
❌ No authentication at all
❌ Vulnerable to local malware
❌ No audit trail of unauthorized attempts
```

### With Full Encryption (Over-engineered):
```
✅ Wire encryption (CurveZMQ/TLS)
✅ Certificate-based auth
⚠️ Complex setup for users
⚠️ Performance overhead
⚠️ Overkill for localhost
```

## 📝 **User Instructions (Copy-Paste for Docs)**

### For Beta Testers:

**Step 1: Create Executor**
1. Go to Web Platform → Dashboard → Executors
2. Click "Add New Executor"
3. Enter name (e.g., "My Trading PC")
4. Select platform (MT5 or MT4)
5. Click "Create Executor"

**Step 2: Save Credentials**
You'll see 3 credentials (⚠️ **Save all 3 now!** They won't be shown again):

1. **API Key** - For Windows Executor
2. **Secret Key** - For Windows Executor  
3. **Shared Secret** - For MT5 EA

**Step 3: Configure Windows Executor**
1. Open Windows Executor app
2. Go to Settings
3. Paste **API Key** and **Secret Key**
4. Click "Save & Connect"
5. Wait for ✅ "Connected" status

**Step 4: Configure MT5 EA**
1. Open MetaTrader 5
2. Drag **FX_NusaNexus** EA to any chart
3. In EA settings, find **InpSharedSecret** parameter
4. Paste the **Shared Secret** you saved earlier
5. Click OK
6. EA should show: "✅ Shared secret configured"

**Step 5: Verify Connection**
1. In Windows Executor, click "Test Connection"
2. EA should show: "📨 Received command: PING"
3. EA should respond: "✅ PONG"
4. If you see "❌ Authentication failed", check your shared secret

**Troubleshooting**:
- **"Authentication failed"**: Verify shared secret matches exactly
- **"Authentication blocked"**: Wait 5 minutes, then try again
- **"No shared secret configured"**: EA will work but without authentication (not recommended)

## 🔧 **For Developers**

### Testing Authentication:

```javascript
// Test command WITH valid token
{
  "command": "PING",
  "token": "your_shared_secret_here"
}
// Expected: {"status":"OK","message":"PONG","authEnabled":true}

// Test command WITHOUT token
{
  "command": "PING"
}
// Expected: {"status":"ERROR","message":"Authentication failed"}

// Test command with WRONG token
{
  "command": "PING",
  "token": "wrong_token"
}
// Expected: {"status":"ERROR","message":"Authentication failed"}
```

### Rotating Shared Secret:

If shared secret is compromised:

1. **Web Platform**: Delete and recreate executor
2. **Windows Executor**: Re-enter new credentials
3. **MT5 EA**: Update InpSharedSecret parameter

**Note**: Old shared secret is immediately invalidated.

## 🎯 **Summary**

**What You Need to Remember**:
1. **3 credentials** are generated when you create an executor
2. **API Key + Secret** = Windows Executor authentication
3. **Shared Secret** = EA command authentication
4. All credentials shown **only once** at creation
5. Failed auth = auto-block after 5 attempts
6. Localhost only = sufficient security without full encryption

**Bottom Line**: Simple, secure, user-friendly authentication for beta testing!

---
**Questions?** See `BETA_IMPLEMENTATION_GUIDE.md` for more details.
