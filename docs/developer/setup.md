# 🛠️ FX Trading Platform - Development Setup Guide

## Overview

This guide provides comprehensive instructions for setting up a development environment for the FX Trading Platform. Follow these steps to get your local development environment running smoothly.

## Prerequisites

### System Requirements

#### Minimum Requirements
- **Operating System**: Windows 10/11, macOS 10.15+, or Ubuntu 18.04+
- **Processor**: 4-core CPU
- **Memory**: 8GB RAM
- **Storage**: 20GB free disk space
- **Network**: Stable internet connection

#### Recommended Requirements
- **Operating System**: Windows 11, macOS 12+, or Ubuntu 20.04+
- **Processor**: 8-core CPU
- **Memory**: 16GB RAM
- **Storage**: 50GB free disk space (SSD recommended)
- **Network**: High-speed internet connection

### Required Software

#### Core Dependencies
- **Node.js**: Version 18.0.0 or higher
- **npm**: Version 9.0.0 or higher (comes with Node.js)
- **Git**: Latest version

#### Database Systems
- **PostgreSQL**: Version 15 or higher
- **Redis**: Version 7 or higher

#### Development Tools
- **Visual Studio Code**: Latest version (recommended)
- **Postman**: Latest version (for API testing)
- **Docker Desktop**: Latest version (optional but recommended)

#### Browser
- **Google Chrome**: Latest version
- **Mozilla Firefox**: Latest version (for cross-browser testing)

## Installation Steps

### 1. Install Node.js

#### Windows
1. Download Node.js from [nodejs.org](https://nodejs.org/)
2. Run the installer with default settings
3. Verify installation:
```bash
node --version
npm --version
```

#### macOS
```bash
# Using Homebrew
brew install node@18

# Or download from nodejs.org
```

#### Ubuntu/Debian
```bash
# Using NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

### 2. Install Git

#### Windows
1. Download Git from [git-scm.com](https://git-scm.com/)
2. Run the installer with recommended settings
3. Verify installation:
```bash
git --version
```

#### macOS
```bash
# Using Homebrew
brew install git

# Or download from git-scm.com
```

#### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install git
```

### 3. Install PostgreSQL

#### Windows
1. Download PostgreSQL from [enterprisedb.com](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads)
2. Run the installer and remember your password
3. Add PostgreSQL to PATH (optional but recommended)

#### macOS
```bash
# Using Homebrew
brew install postgresql@15
brew services start postgresql@15

# Create database user
createuser -s postgres
```

#### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 4. Install Redis

#### Windows
```bash
# Using WSL2 (recommended)
wsl --install
# Then follow Ubuntu instructions

# Or download Redis for Windows from Microsoft Archive
```

#### macOS
```bash
# Using Homebrew
brew install redis
brew services start redis
```

#### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

## Project Setup

### 1. Clone the Repository

```bash
# Clone the repository
git clone https://github.com/your-org/fx-platform.git
cd fx-platform

# Verify the repository structure
ls -la
```

### 2. Install Dependencies

```bash
# Install npm dependencies
npm install

# Verify installation
npm list --depth=0
```

### 3. Environment Configuration

#### Copy Environment Template
```bash
# Copy the environment template
cp .env.example .env
```

#### Configure Environment Variables
Edit `.env` file with your configuration:

```env
# Database Configuration
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/fx_platform_dev"

# Authentication
NEXTAUTH_SECRET="your-super-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"

# Redis Configuration
UPSTASH_REDIS_REST_URL="http://localhost:6379"
UPSTASH_REDIS_REST_TOKEN=""

# Pusher Configuration (for real-time features)
PUSHER_APP_ID="your-pusher-app-id"
NEXT_PUBLIC_PUSHER_KEY="your-pusher-key"
PUSHER_SECRET="your-pusher-secret"
NEXT_PUBLIC_PUSHER_CLUSTER="your-pusher-cluster"

# AI Services
OPENROUTER_API_KEY="sk-or-v1-your-openrouter-key"

# Market Data
TWELVEDATA_API_KEY="your-twelve-data-key"

# Security
JWT_SECRET="your-jwt-secret-key"

# Development Settings
NODE_ENV="development"
```

#### Generate Secure Keys
```bash
# Generate NextAuth secret
openssl rand -base64 32

# Generate JWT secret
openssl rand -hex 32
```

### 4. Database Setup

#### Create Database
```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE fx_platform_dev;

# Create user (optional)
CREATE USER fx_platform_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE fx_platform_dev TO fx_platform_user;

# Exit PostgreSQL
\q
```

#### Generate Prisma Client
```bash
# Generate Prisma client
npx prisma generate

# Push database schema
npx prisma db push

# (Optional) Run migrations
npx prisma migrate dev
```

#### Seed Database (Optional)
```bash
# Seed with sample data
npm run db:seed
```

### 5. Verify Installation

#### Check Prisma Configuration
```bash
# Validate Prisma schema
npx prisma validate

# View database schema
npx prisma db pull
```

#### Test Database Connection
```bash
# Test database connection
npx prisma db pull --preview-feature
```

## Development Workflow

### 1. Start Development Server

```bash
# Start the development server
npm run dev

# The server will start on http://localhost:3000
```

### 2. Start Additional Services

#### WebSocket Server
```bash
# Start development server with WebSocket
npm run dev:ws
```

#### Database Studio
```bash
# Open Prisma Studio
npm run db:studio
```

### 3. Development Scripts

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Format code
npm run format

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Build for production
npm run build

# Start production server
npm start
```

## IDE Configuration

### Visual Studio Code Setup

#### Recommended Extensions
Install these extensions from VS Code Marketplace:

```json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-eslint",
    "prisma.prisma",
    "ms-vscode.vscode-json",
    "redhat.vscode-yaml",
    "ms-vscode-remote.remote-containers",
    "ms-vscode.vscode-docker"
  ]
}
```

#### Workspace Settings
Create `.vscode/settings.json`:

```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "files.associations": {
    "*.css": "tailwindcss"
  },
  "emmet.includeLanguages": {
    "typescript": "html",
    "typescriptreact": "html"
  },
  "tailwindCSS.includeLanguages": {
    "typescript": "html",
    "typescriptreact": "html"
  }
}
```

#### Debug Configuration
Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: debug server-side",
      "type": "node-terminal",
      "request": "launch",
      "command": "npm run dev"
    },
    {
      "name": "Next.js: debug client-side",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:3000"
    }
  ]
}
```

## Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use different port
PORT=3001 npm run dev
```

#### Database Connection Issues
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Start PostgreSQL
sudo systemctl start postgresql

# Check Redis status
redis-cli ping

# Start Redis
sudo systemctl start redis
```

#### Node Modules Issues
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Reinstall dependencies
npm install
```

#### Prisma Issues
```bash
# Reset Prisma
npx prisma generate --force

# Reset database (WARNING: This deletes all data)
npx prisma migrate reset

# Re-migrate
npx prisma migrate dev
```

### Performance Optimization

#### Development Performance
```bash
# Use Next.js turbo mode
npm run dev --turbo

# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm run dev
```

#### Database Performance
```sql
-- Check slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;
```

## Testing Setup

### Unit Tests
```bash
# Run all unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Integration Tests
```bash
# Set up test database
createdb fx_platform_test

# Run integration tests
npm run test:integration
```

### End-to-End Tests
```bash
# Install Playwright
npx playwright install

# Run E2E tests
npm run test:e2e
```

## Development Best Practices

### Code Organization
- Follow the existing folder structure
- Use TypeScript for all new code
- Keep components small and focused
- Use descriptive variable and function names

### Git Workflow
```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Commit changes
git add .
git commit -m "feat: add your feature description"

# Push to remote
git push origin feature/your-feature-name

# Create pull request
```

### Environment Management
- Never commit `.env` files
- Use different environments for development, staging, and production
- Keep secrets secure and separate from code

## Additional Resources

### Documentation
- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)

### Community
- [GitHub Repository](https://github.com/your-org/fx-platform)
- [Discord Community](https://discord.gg/fxplatform)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/fx-platform)

### Support
- Development Team: dev@fxplatform.com
- Technical Support: support@fxplatform.com
- Documentation Issues: docs@fxplatform.com

---

**Last Updated**: 2024-01-20  
**Version**: 1.0.0  
**Maintainer**: Development Team

---

*This setup guide is maintained by the FX Trading Platform development team. For issues or questions, please contact the development team or create an issue in the repository.*