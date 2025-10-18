# Production Deployment Guide

## NexusTrade Supervisor - Production Ready

This project has been migrated from the `supervisor` subfolder to the root directory and optimized for Vercel deployment.

### ✅ What's Been Done

1. **Project Migration**: Moved entire Next.js application from `supervisor/` to root
2. **Production Optimization**: 
   - Updated build scripts to include Prisma generation
   - Enabled strict TypeScript and ESLint checks
   - Configured production-grade security headers
   - Optimized image loading and caching
3. **Vercel Configuration**: 
   - Updated `vercel.json` with proper build commands
   - Added environment variable placeholders
   - Configured security headers and redirects
4. **Code Quality**: 
   - Added validation scripts
   - Fixed dependency consistency
   - Prepared for CI/CD pipeline

### 🚀 Quick Deployment to Vercel

#### Step 1: Environment Variables

Set these in your Vercel dashboard (`Settings > Environment Variables`):

**Required:**
```
DATABASE_URL=your_postgresql_connection_string
NEXTAUTH_SECRET=your_secure_random_string (generate with: openssl rand -base64 32)
NEXTAUTH_URL=https://your-domain.com
```

**Optional (but recommended for production):**
```
STRIPE_SECRET_KEY=your_stripe_secret_key
SENTRY_DSN=your_sentry_dsn
OPENROUTER_API_KEY=your_openrouter_key
LOG_LEVEL=info (or debug for development)
```

#### Step 2: Prisma Database Migration

Before deployment:

```bash
# Locally (with DATABASE_URL set)
pnpm run db:push
```

This ensures your database schema is up to date with Prisma schema.

#### Step 3: Deploy to Vercel

**Option A: Git Integration (Recommended)**
1. Push to GitHub/GitLab
2. Connect repository to Vercel
3. Vercel automatically deploys on push to main

**Option B: Vercel CLI**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### 📋 Deployment Checklist

- [ ] Environment variables set in Vercel dashboard
- [ ] Database URL is correct (PostgreSQL)
- [ ] NEXTAUTH_SECRET is a strong random string (32+ chars)
- [ ] NEXTAUTH_URL matches your production domain
- [ ] Database migrations applied (`pnpm run db:push`)
- [ ] Prisma schema is up to date
- [ ] All security headers configured
- [ ] CORS configured if needed
- [ ] SSL/HTTPS enabled (Vercel default)
- [ ] Custom domain configured (if needed)

### 🔒 Security Configuration

The following security headers are automatically applied:

```
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

**Additional Security Steps:**

1. **Rotate Secrets Regularly**
   - Generate new `NEXTAUTH_SECRET` monthly
   - Update in Vercel dashboard and redeploy

2. **Enable Rate Limiting** (if backend API exists)
   - Configure API rate limits
   - Set per environment

3. **Monitor Errors**
   - Enable Sentry for error tracking
   - Set up alerts in Vercel dashboard

4. **Database Backups**
   - Enable automated backups on PostgreSQL
   - Test recovery procedures

### 📊 Production Monitoring

#### Vercel Dashboard
- Monitor deployments and rollbacks
- View analytics and performance metrics
- Check error logs

#### Performance Tips

1. **Image Optimization**
   - Images are automatically optimized (AVIF, WebP)
   - Cache TTL: 30 days
   - Consider using CDN for large assets

2. **Database Performance**
   - Add indexes to frequently queried fields
   - Use connection pooling (Prisma client already does this)
   - Monitor slow queries

3. **Build Optimization**
   - Build time should be < 5 minutes
   - Install size monitored by Vercel
   - Unused dependencies removed in this migration

### 🆘 Troubleshooting

#### Build Fails on Vercel

**Issue**: Build fails with "Cannot find module" or similar

**Solution**:
1. Check `vercel.json` install command uses `--frozen-lockfile`
2. Ensure `pnpm-lock.yaml` is committed
3. Verify all dependencies in `package.json`
4. Run locally: `pnpm install && pnpm run build`

#### Database Connection Error

**Issue**: "ECONNREFUSED" or "Connection timeout"

**Solution**:
1. Verify DATABASE_URL is correct
2. Check if database is publicly accessible
3. For Vercel: Database must be accessible from Vercel servers
4. Use connection pooling if available

#### Prisma Generation Error

**Issue**: "Prisma schema validation failed" during build

**Solution**:
1. Run locally: `prisma generate`
2. Check `prisma/schema.prisma` for syntax errors
3. Verify all required env vars are set
4. Commit `prisma/schema.prisma` to git

### 📞 Support & Resources

- **Next.js Docs**: https://nextjs.org/docs
- **Vercel Docs**: https://vercel.com/docs
- **Prisma Docs**: https://www.prisma.io/docs
- **NextAuth Docs**: https://next-auth.js.org

### 🔄 Rollback Procedure

If deployment fails:

1. Go to Vercel Dashboard
2. Find the previous successful deployment
3. Click "..." > "Promote to Production"
4. View logs to identify the issue
5. Fix locally and redeploy

### 📝 Post-Deployment Verification

1. **Health Check**
   ```bash
   curl https://your-domain.com
   ```

2. **Login Test**
   - Visit https://your-domain.com/login
   - Test login with test credentials

3. **API Test**
   ```bash
   curl https://your-domain.com/api/auth/session
   ```

4. **Database Test**
   - Access database admin if available
   - Verify recent records created

### 🎯 Next Steps

1. Set up monitoring and alerts
2. Configure automated backups
3. Plan scaling strategy
4. Document runbook for common issues
5. Schedule regular security audits

---

**Last Updated**: October 2024
**Status**: Production Ready ✅
