#!/bin/bash

# GENERATE SECURE KEYS SCRIPT
# Generates secure keys for production deployment

echo "======================================"
echo "🔐 GENERATING SECURE KEYS"
echo "======================================"
echo ""

# Generate NEXTAUTH_SECRET
NEXTAUTH_SECRET=$(openssl rand -base64 32)
echo "NEXTAUTH_SECRET:"
echo "$NEXTAUTH_SECRET"
echo ""

# Generate JWT_SECRET
JWT_SECRET=$(openssl rand -base64 32)
echo "JWT_SECRET:"
echo "$JWT_SECRET"
echo ""

echo "======================================"
echo "📝 UPDATE YOUR .env FILE WITH:"
echo "======================================"
echo ""
echo "NEXTAUTH_SECRET=\"$NEXTAUTH_SECRET\""
echo "JWT_SECRET=\"$JWT_SECRET\""
echo ""
echo "======================================"
echo "✅ Keys generated successfully!"
echo "======================================"
echo ""
echo "Next steps:"
echo "1. Copy the keys above to your .env file"
echo "2. Update NEXTAUTH_URL to your Vercel domain"
echo "3. Run: node validate-env.js"
echo "4. Deploy: vercel --prod"
echo ""
