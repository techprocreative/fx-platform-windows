#!/usr/bin/env node

/**
 * SIMPLE ENVIRONMENT VALIDATION
 * Only checks critical variables that will break the app
 */

require("dotenv").config();

console.log("🔍 Simple Environment Validation\n");

// Only critical variables that will break the app
const critical = [
  { name: "DATABASE_URL", required: true },
  { name: "NEXTAUTH_SECRET", required: true },
  { name: "NEXTAUTH_URL", required: false }, // Optional for development
];

// Check critical variables
critical.forEach(({ name, required }) => {
  const value = process.env[name];
  if (!value) {
    if (required) {
      console.log(`❌ ${name}: Missing`);
      errors.push(name);
    } else {
      console.log(`⭕ ${name}: Not set (optional)`);
    }
  } else {
    console.log(`✅ ${name}: OK`);
  }
});

const optional = [
  "NEXT_PUBLIC_PUSHER_KEY",
  "PUSHER_APP_ID",
  "OPENROUTER_API_KEY",
  "UPSTASH_REDIS_REST_URL",
];

let errors = [];

// Check optional variables
optional.forEach((name) => {
  const value = process.env[name];
  if (!value) {
    console.log(`⭕ ${name}: Not set (optional)`);
  } else {
    console.log(`✅ ${name}: OK`);
  }
});

// Summary
console.log("\n" + "=".repeat(40));
if (errors.length > 0) {
  console.log(`❌ ${errors.length} critical variables missing`);
  console.log("App may not work properly");
  process.exit(1);
} else {
  console.log("✅ All critical variables present");
  console.log("Ready to start development");
}
