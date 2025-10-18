#!/bin/bash

# NexusTrade Supervisor - Quick Start Script
# This script automates the deployment setup process

set -e  # Exit on error

echo "🚀 NexusTrade Supervisor - Quick Start"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Check prerequisites
echo -e "${YELLOW}Step 1: Checking prerequisites...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install from https://nodejs.org${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Node.js found: $(node --version)${NC}"

if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm not found${NC}"
    exit 1
fi
echo -e "${GREEN}✅ npm found: $(npm --version)${NC}"
echo ""

# Step 2: Install dependencies
echo -e "${YELLOW}Step 2: Installing dependencies...${NC}"
echo "This may take 2-3 minutes..."
npm install --legacy-peer-deps 2>&1 | grep -E "(added|up to date|ERR)"
echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

# Step 3: Generate Prisma Client
echo -e "${YELLOW}Step 3: Generating Prisma Client...${NC}"
npx prisma generate
echo -e "${GREEN}✅ Prisma Client generated${NC}"
echo ""

# Step 4: Sync Database
echo -e "${YELLOW}Step 4: Syncing database schema...${NC}"
npx prisma db push --skip-generate
echo -e "${GREEN}✅ Database schema synced${NC}"
echo ""

# Step 5: Optional seed
read -p "Would you like to seed demo data? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Seeding database...${NC}"
    npm run seed
    echo -e "${GREEN}✅ Demo data seeded${NC}"
fi
echo ""

# Step 6: Build
echo -e "${YELLOW}Step 5: Building application...${NC}"
npm run build
echo -e "${GREEN}✅ Build successful${NC}"
echo ""

# Step 7: Summary
echo -e "${GREEN}🎉 Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Start local server: npm run start"
echo "2. Test at http://localhost:3000"
echo "3. Deploy to Vercel: vercel --prod"
echo ""
echo "Demo credentials (if seeded):"
echo "Email: demo@nexustrade.com"
echo "Password: Demo123!"
echo ""
