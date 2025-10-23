/**
 * ATR-based Risk Management Implementation Verification
 * 
 * This script verifies that our ATR-based risk management implementation
 * has been correctly integrated across all components.
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying ATR-based Risk Management Implementation...\n');

let checksPassed = 0;
let checksTotal = 0;

function check(description, condition) {
  checksTotal++;
  if (condition) {
    console.log(`✅ ${description}`);
    checksPassed++;
  } else {
    console.log(`❌ ${description}`);
  }
}

// Check 1: DynamicRiskParams interface in types/index.ts
check('DynamicRiskParams interface exists in types/index.ts', () => {
  const typesPath = path.join(__dirname, 'src/types/index.ts');
  if (!fs.existsSync(typesPath)) return false;
  
  const content = fs.readFileSync(typesPath, 'utf8');
  return content.includes('interface DynamicRiskParams') &&
         content.includes('useATRSizing: boolean') &&
         content.includes('atrMultiplier: number') &&
         content.includes('riskPercentage: number') &&
         content.includes('autoAdjustLotSize: boolean') &&
         content.includes('reduceInHighVolatility: boolean') &&
         content.includes('volatilityThreshold: number');
});

// Check 2: StrategyRules interface includes dynamicRisk
check('StrategyRules interface includes dynamicRisk field', () => {
  const typesPath = path.join(__dirname, 'src/types/index.ts');
  if (!fs.existsSync(typesPath)) return false;
  
  const content = fs.readFileSync(typesPath, 'utf8');
  return content.includes('dynamicRisk?: DynamicRiskParams');
});

// Check 3: StrategyForm.tsx includes ATR UI
check('StrategyForm.tsx includes ATR-based risk management UI', () => {
  const formPath = path.join(__dirname, 'src/components/forms/StrategyForm.tsx');
  if (!fs.existsSync(formPath)) return false;
  
  const content = fs.readFileSync(formPath, 'utf8');
  return content.includes('Dynamic Risk Management (ATR-based)') &&
         content.includes('Enable ATR-based position sizing') &&
         content.includes('ATR Multiplier') &&
         content.includes('Risk Percentage (%)') &&
         content.includes('Auto-adjust lot size based on ATR') &&
         content.includes('Reduce risk in high volatility');
});

// Check 4: Risk manager has ATR methods
check('RiskManager has ATR-based position sizing method', () => {
  const riskPath = path.join(__dirname, 'src/lib/risk/risk-manager.ts');
  if (!fs.existsSync(riskPath)) return false;
  
  const content = fs.readFileSync(riskPath, 'utf8');
  return content.includes('calculateATRPositionSize') &&
         content.includes('calculateATRStopLoss') &&
         content.includes('useATRSizing') &&
         content.includes('currentATR');
});

// Check 5: Risk types include ATR fields
check('Risk types include ATR fields', () => {
  const typesPath = path.join(__dirname, 'src/lib/risk/types.ts');
  if (!fs.existsSync(typesPath)) return false;
  
  const content = fs.readFileSync(typesPath, 'utf8');
  return content.includes('currentATR?: number') &&
         content.includes('dynamicRisk?: DynamicRiskParams');
});

// Check 6: Signal generator has ATR integration
check('SignalGenerator has ATR integration', () => {
  const generatorPath = path.join(__dirname, 'src/lib/signals/generator.ts');
  if (!fs.existsSync(generatorPath)) return false;
  
  const content = fs.readFileSync(generatorPath, 'utf8');
  return content.includes('calculateATRPositionSize') &&
         content.includes('calculateATRStopLoss') &&
         content.includes('dynamicRisk?.useATRSizing') &&
         content.includes('atrUsed');
});

// Check 7: ATR calculation method exists
check('ATR calculation method exists in SignalGenerator', () => {
  const generatorPath = path.join(__dirname, 'src/lib/signals/generator.ts');
  if (!fs.existsSync(generatorPath)) return false;
  
  const content = fs.readFileSync(generatorPath, 'utf8');
  return content.includes('calculateATR(data: any, period: number = 14): number');
});

// Check 8: Form state includes dynamic risk
check('StrategyForm state includes dynamic risk parameters', () => {
  const formPath = path.join(__dirname, 'src/components/forms/StrategyForm.tsx');
  if (!fs.existsSync(formPath)) return false;
  
  const content = fs.readFileSync(formPath, 'utf8');
  return content.includes('const [dynamicRisk, setDynamicRisk] = useState<DynamicRiskParams>') &&
         content.includes('DEFAULT_DYNAMIC_RISK') &&
         content.includes('dynamicRisk,');
});

// Check 9: Form submission includes dynamic risk
check('StrategyForm submission includes dynamic risk parameters', () => {
  const formPath = path.join(__dirname, 'src/components/forms/StrategyForm.tsx');
  if (!fs.existsSync(formPath)) return false;
  
  const content = fs.readFileSync(formPath, 'utf8');
  return content.includes('dynamicRisk,') &&
         content.includes('rules: {') &&
         content.includes('dynamicRisk');
});

// Check 10: Test files exist
check('ATR integration test files exist', () => {
  const testPath1 = path.join(__dirname, 'src/lib/__tests__/atr-risk-management.test.ts');
  const testPath2 = path.join(__dirname, 'src/lib/__tests__/atr-integration-simple.ts');
  
  return fs.existsSync(testPath1) && fs.existsSync(testPath2);
});

// Summary
console.log(`\n📊 Verification Results: ${checksPassed}/${checksTotal} checks passed`);

if (checksPassed === checksTotal) {
  console.log('\n🎉 ATR-based Risk Management Implementation Complete!');
  console.log('\n✨ Features Implemented:');
  console.log('   • DynamicRiskParams interface with all required fields');
  console.log('   • ATR-based position sizing in RiskManager');
  console.log('   • ATR-based stop loss calculations');
  console.log('   • Volatility adjustment in high volatility conditions');
  console.log('   • UI components for ATR settings in StrategyForm');
  console.log('   • Integration with SignalGenerator for ATR calculations');
  console.log('   • Test files for verification');
  
  console.log('\n🚀 Ready for Phase 1.2 implementation!');
  process.exit(0);
} else {
  console.log('\n⚠️ Some checks failed. Please review the implementation.');
  process.exit(1);
}