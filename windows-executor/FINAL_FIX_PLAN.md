# Windows Executor - Final Fix Plan

## Current Status: 817 Errors ❌

## CRITICAL ERRORS (Must Fix untuk Build)

### 1. Import Path Issues ⚠️ BLOCKING
**Files**: App.tsx
```typescript
// WRONG:
import { StatusBar } from './components/StatusBar';

// CORRECT:
import { StatusBar } from '../components/StatusBar';
```

**Fix**: Update semua import di App.tsx dari `./components/` ke `../components/`

### 2. Missing react-hot-toast Module ⚠️ BLOCKING
```
error TS2307: Cannot find module 'react-hot-toast'
```

**Fix**: Install `react-hot-toast` atau buat dummy Toaster component

### 3. LogEntry Type Mismatch ⚠️ HIGH
**Problem**: Code menggunakan `level` property, tapi type definition pakai `type`

```typescript
// WRONG:
addLog({ level: 'info', message: 'test' });

// CORRECT:
addLog({ type: 'INFO', message: 'test', id: '...', timestamp: new Date() });
```

**Fix**: Update semua usage dari `level` ke `type` dengan value uppercase

### 4. Missing Store Methods ⚠️ MEDIUM
Missing di app.store.ts:
- `setMt5Installations` ✓ (Already exists)
Tapi code pakai nama yang beda!

### 5. Missing electronAPI Methods ⚠️ MEDIUM
```typescript
// Missing:
- saveConfig (should be updateConfig)
- startServices (not in preload.ts)
- completeSetup (should be setupComplete)
```

### 6. Unused React Imports ⚠️ LOW (Code Quality)
50+ files dengan `import React` yang tidak digunakan (with new JSX transform)

## QUICK FIX PRIORITY

### PHASE A: Blocking Issues (15 min)
1. ✅ Fix import paths di App.tsx
2. ✅ Install atau create dummy react-hot-toast
3. ✅ Fix LogEntry property dari 'level' ke 'type' di semua pages

### PHASE B: Type Issues (20 min)
4. ✅ Add missing electronAPI methods di preload.ts atau update callers
5. ✅ Fix activeStrategies type definition untuk include semua properties
6. ✅ Fix Setup page onSetupComplete prop

### PHASE C: Code Quality (Optional - 15 min)
7. ⏭️ Remove unused React imports (can use eslint --fix)
8. ⏭️ Remove unused variables

## Recommended Action

**Option 1: Quick Fix untuk Build** (35 minutes)
- Fix Phase A dan B saja
- Build should work
- Cleanup nanti

**Option 2: Complete Fix** (50 minutes)  
- Fix semua phases
- Clean code
- Production ready

## Expected Result After Phase A+B
- ✅ 0-50 errors remaining (mostly unused variables)
- ✅ App can compile
- ✅ Ready to test build

## Build Test Command
```bash
npm run build:react
npm run build:electron  
npm run package:win
```
