#!/usr/bin/env node

/**
 * ENVIRONMENT VALIDATION SCRIPT
 * Validates all required environment variables before deployment
 * Run: node validate-env.js
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Load .env file
require('dotenv').config();

console.log(`${colors.cyan}====================================`);
console.log('🔍 FX PLATFORM - ENVIRONMENT VALIDATOR');
console.log(`=====================================${colors.reset}\n`);

// Configuration groups
const configs = {
  '🗄️ DATABASE': {
    required: true,
    vars: {
      'DATABASE_URL': {
        required: true,
        validate: (val) => val && val.includes('postgresql://'),
        error: 'Must be a valid PostgreSQL connection string'
      },
    }
  },
  
  '🔐 AUTHENTICATION': {
    required: true,
    vars: {
      'NEXTAUTH_SECRET': {
        required: true,
        validate: (val) => val && val.length >= 32,
        error: 'Must be at least 32 characters (use: openssl rand -base64 32)'
      },
      'NEXTAUTH_URL': {
        required: true,
        validate: (val) => val && (val.startsWith('http://') || val.startsWith('https://')),
        error: 'Must be a valid URL',
        warning: (val) => val.includes('localhost') ? 'Using localhost - update for production' : null
      },
    }
  },

  '📡 PUSHER REALTIME': {
    required: true,
    vars: {
      'PUSHER_APP_ID': {
        required: true,
        validate: (val) => val && val.length > 0,
      },
      'NEXT_PUBLIC_PUSHER_KEY': {
        required: true,
        validate: (val) => val && val.length > 0,
      },
      'PUSHER_SECRET': {
        required: true,
        validate: (val) => val && val.length > 0,
      },
      'NEXT_PUBLIC_PUSHER_CLUSTER': {
        required: true,
        validate: (val) => val && val.length > 0,
      },
    }
  },

  '🤖 AI INTEGRATION': {
    required: true,
    vars: {
      'OPENROUTER_API_KEY': {
        required: true,
        validate: (val) => val && val.startsWith('sk-or-'),
        error: 'Must be a valid OpenRouter API key'
      },
    }
  },

  '📊 MARKET DATA': {
    required: true,
    vars: {
      'TWELVEDATA_API_KEY': {
        required: true,
        validate: (val) => val && val.length > 0,
      },
      'YAHOO_FINANCE_API_KEY': {
        required: false,
        validate: (val) => !val || val.length > 0,
      },
    }
  },

  '💾 CACHE': {
    required: true,
    vars: {
      'UPSTASH_REDIS_REST_URL': {
        required: true,
        validate: (val) => val && val.startsWith('https://'),
        error: 'Must be a valid Upstash URL'
      },
      'UPSTASH_REDIS_REST_TOKEN': {
        required: true,
        validate: (val) => val && val.length > 0,
      },
    }
  },

  '🔒 SECURITY': {
    required: true,
    vars: {
      'JWT_SECRET': {
        required: true,
        validate: (val) => val && val.length >= 32,
        error: 'Must be at least 32 characters',
        warning: (val) => val === 'your-jwt-secret-key-here' ? 'Using default - MUST change for production!' : null
      },
      'API_RATE_LIMIT_MAX_REQUESTS': {
        required: false,
        validate: (val) => !val || parseInt(val) > 0,
      },
    }
  },

  '🌐 CORS': {
    required: false,
    vars: {
      'ALLOWED_ORIGINS': {
        required: false,
        validate: (val) => !val || val.length > 0,
        warning: (val) => !val ? 'No CORS origins set - will use defaults' : null
      },
    }
  },

  '📦 OPTIONAL SERVICES': {
    required: false,
    vars: {
      'BLOB_READ_WRITE_TOKEN': {
        required: false,
        validate: (val) => true,
      },
      'WS_PORT': {
        required: false,
        validate: (val) => !val || parseInt(val) > 0,
      },
    }
  },
};

// Validation results
let errors = [];
let warnings = [];
let passed = [];
let optional = [];

// Validate each configuration group
Object.entries(configs).forEach(([groupName, group]) => {
  console.log(`\n${colors.blue}${groupName}${colors.reset}`);
  console.log('─'.repeat(40));
  
  Object.entries(group.vars).forEach(([varName, config]) => {
    const value = process.env[varName];
    const exists = value !== undefined && value !== '';
    
    // Check if exists
    if (!exists) {
      if (config.required) {
        console.log(`${colors.red}❌ ${varName}: MISSING${colors.reset}`);
        errors.push(`${varName} is required but not set`);
      } else {
        console.log(`${colors.yellow}⭕ ${varName}: Not set (optional)${colors.reset}`);
        optional.push(varName);
      }
      return;
    }
    
    // Validate value
    if (config.validate && !config.validate(value)) {
      console.log(`${colors.red}❌ ${varName}: INVALID${colors.reset}`);
      if (config.error) {
        console.log(`   ${colors.red}└─ ${config.error}${colors.reset}`);
      }
      errors.push(`${varName}: ${config.error || 'Invalid value'}`);
      return;
    }
    
    // Check for warnings
    if (config.warning) {
      const warning = config.warning(value);
      if (warning) {
        console.log(`${colors.yellow}⚠️  ${varName}: ${warning}${colors.reset}`);
        warnings.push(`${varName}: ${warning}`);
        return;
      }
    }
    
    // Passed validation
    const displayValue = varName.includes('SECRET') || varName.includes('TOKEN') || varName.includes('KEY')
      ? value.substring(0, 10) + '...' 
      : value.substring(0, 30) + (value.length > 30 ? '...' : '');
    
    console.log(`${colors.green}✅ ${varName}: ${displayValue}${colors.reset}`);
    passed.push(varName);
  });
});

// Summary
console.log(`\n${colors.cyan}====================================`);
console.log('📊 VALIDATION SUMMARY');
console.log(`=====================================${colors.reset}\n`);

console.log(`${colors.green}✅ Passed: ${passed.length} variables${colors.reset}`);
console.log(`${colors.yellow}⚠️  Warnings: ${warnings.length} warnings${colors.reset}`);
console.log(`${colors.red}❌ Errors: ${errors.length} errors${colors.reset}`);
console.log(`${colors.yellow}⭕ Optional: ${optional.length} not set${colors.reset}`);

// Deployment readiness
console.log(`\n${colors.cyan}====================================`);
console.log('🚀 DEPLOYMENT READINESS');
console.log(`=====================================${colors.reset}\n`);

if (errors.length === 0) {
  if (warnings.length === 0) {
    console.log(`${colors.green}✅ READY FOR PRODUCTION!${colors.reset}`);
    console.log('All required variables are properly configured.');
  } else {
    console.log(`${colors.yellow}⚠️  READY WITH WARNINGS${colors.reset}`);
    console.log('Review warnings above before production deployment.');
  }
} else {
  console.log(`${colors.red}❌ NOT READY FOR DEPLOYMENT${colors.reset}`);
  console.log('\nRequired fixes:');
  errors.forEach((error, i) => {
    console.log(`${i + 1}. ${error}`);
  });
}

// Production tips
if (process.env.NODE_ENV !== 'production') {
  console.log(`\n${colors.yellow}💡 TIP: Currently in ${process.env.NODE_ENV || 'development'} mode`);
  console.log(`Set NODE_ENV=production for production deployment${colors.reset}`);
}

if (process.env.NEXTAUTH_URL && process.env.NEXTAUTH_URL.includes('localhost')) {
  console.log(`\n${colors.yellow}💡 TIP: Update NEXTAUTH_URL to your production domain${colors.reset}`);
}

// Check for default/insecure values
const insecureValues = [
  'your-secret-key-here',
  'your-jwt-secret-key-here',
  'GENERATE-THIS',
  'TODO'
];

const hasInsecureValues = Object.entries(process.env).some(([key, value]) => 
  insecureValues.some(insecure => value && value.includes(insecure))
);

if (hasInsecureValues) {
  console.log(`\n${colors.red}⚠️  WARNING: Detected placeholder/insecure values!`);
  console.log(`Generate secure keys before production deployment.${colors.reset}`);
}

console.log(`\n${colors.cyan}====================================`);
console.log('Run this validator before every deployment!');
console.log(`=====================================${colors.reset}\n`);

// Exit with appropriate code
process.exit(errors.length > 0 ? 1 : 0);
