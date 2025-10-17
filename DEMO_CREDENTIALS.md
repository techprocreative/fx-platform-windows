# 🔐 Demo Login Credentials - NexusTrade Supervisor

**Status**: ✅ Demo Account Created  
**Date**: October 17, 2024  
**Database**: Neon Tech PostgreSQL

---

## 📧 Demo Account Details

### Login Credentials

```
Email: demo@nexustrade.com
Password: Demo123!
```

### User Profile

- **Name**: Demo User
- **Email**: demo@nexustrade.com
- **Email Verified**: Yes ✅
- **Account Type**: Standard User
- **Created**: October 17, 2024

### Preferences

- **Theme**: Light
- **Language**: English (en)
- **Timezone**: UTC

---

## 📊 Demo Data Included

### Sample Strategy: "Demo RSI Strategy"

**Strategy Details**:
- **Name**: Demo RSI Strategy
- **Description**: A sample RSI-based trading strategy for demonstration
- **Symbol**: EURUSD
- **Timeframe**: H1 (1 Hour)
- **Type**: Manual
- **Status**: Draft

**Trading Rules**:

**Entry Conditions**:
- Indicator: RSI (Relative Strength Index)
- Period: 14
- Condition: RSI < 30 (Oversold)
- Logic: AND

**Exit Rules**:
- Take Profit: 50 pips
- Stop Loss: 25 pips

**Risk Management**:
- Lot Size: 0.1
- Max Open Positions: 5
- Max Daily Loss: $500

---

## 🚀 How to Use Demo Account

### 1. Access the Application

**Local Development**:
```
http://localhost:3000
```

**Production (Vercel)**:
```
https://your-project.vercel.app
```

### 2. Login Steps

1. Navigate to the login page: `/login`
2. Enter credentials:
   - Email: `demo@nexustrade.com`
   - Password: `Demo123!`
3. Click "Sign In"
4. You'll be redirected to the dashboard

### 3. What You Can Do

**Dashboard**:
- ✅ View account statistics
- ✅ See active strategies (1 demo strategy)
- ✅ Monitor trading activity
- ✅ Access analytics

**Strategy Management**:
- ✅ View demo RSI strategy
- ✅ Edit strategy parameters
- ✅ Create new strategies
- ✅ Delete strategies (including demo)

**Settings**:
- ✅ Update profile information
- ✅ Change password
- ✅ Modify preferences (theme, language, timezone)
- ✅ Manage API keys (future feature)

---

## 🔄 Reset Demo Account

If you need to reset the demo account to its original state:

### Option 1: Delete and Recreate

```bash
cd /media/d88k/01D9C5CA3CB3C3E0/edo/nexustrade/supervisor

# Delete demo user
export $(cat .env.local | grep -v '^#' | xargs)
node -e "const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); prisma.user.delete({ where: { email: 'demo@nexustrade.com' } }).then(() => { console.log('✅ Demo user deleted'); prisma.\$disconnect(); });"

# Recreate demo user
node seed-demo.js
```

### Option 2: Reset Password Only

```bash
cd /media/d88k/01D9C5CA3CB3C3E0/edo/nexustrade/supervisor

export $(cat .env.local | grep -v '^#' | xargs)
node -e "const { PrismaClient } = require('@prisma/client'); const bcrypt = require('bcryptjs'); const prisma = new PrismaClient(); bcrypt.hash('Demo123!', 10).then(hash => { return prisma.user.update({ where: { email: 'demo@nexustrade.com' }, data: { passwordHash: hash } }); }).then(() => { console.log('✅ Password reset'); prisma.\$disconnect(); });"
```

---

## 👥 Creating Additional Test Users

### Via Seed Script

Create `supervisor/seed-users.js`:

```javascript
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  // Create test users
  const users = [
    {
      email: 'test1@nexustrade.com',
      password: 'Test123!',
      firstName: 'Test',
      lastName: 'User 1',
    },
    {
      email: 'test2@nexustrade.com',
      password: 'Test123!',
      firstName: 'Test',
      lastName: 'User 2',
    },
  ];

  for (const userData of users) {
    const user = await prisma.user.create({
      data: {
        email: userData.email,
        passwordHash: await bcrypt.hash(userData.password, 10),
        firstName: userData.firstName,
        lastName: userData.lastName,
        emailVerified: new Date(),
        preferences: {
          create: {
            theme: 'light',
            language: 'en',
            timezone: 'UTC',
          },
        },
      },
    });
    console.log('✅ Created:', user.email);
  }
}

main()
  .finally(() => prisma.$disconnect());
```

Run:
```bash
export $(cat .env.local | grep -v '^#' | xargs)
node seed-users.js
```

### Via Registration Page

1. Go to `/register`
2. Fill in the form:
   - Email: your-email@example.com
   - Password: YourPassword123!
   - First Name: Your Name
   - Last Name: Last Name
3. Click "Create Account"
4. Login with the new credentials

---

## 🔒 Security Notes

### Demo Account Security

- ⚠️ **DO NOT** use demo credentials in production
- ⚠️ Demo password is publicly documented
- ⚠️ Anyone with access can login as demo user
- ✅ Safe for local development and testing
- ✅ Safe for internal beta testing

### Best Practices

For production deployment:

1. **Delete Demo Account**:
   ```bash
   node -e "const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); prisma.user.delete({ where: { email: 'demo@nexustrade.com' } }).then(() => { console.log('Deleted'); prisma.\$disconnect(); });"
   ```

2. **Change Default Passwords**:
   - All test accounts should use strong, unique passwords
   - Never use `Demo123!` or `Test123!` in production

3. **Implement Email Verification**:
   - Require email verification for new accounts
   - Send verification link via email
   - Disable unverified accounts

4. **Add Rate Limiting**:
   - Limit login attempts (e.g., 5 tries per 15 minutes)
   - Implement CAPTCHA for suspicious activity
   - Log failed login attempts

---

## 📊 Database Verification

### Check if Demo User Exists

```bash
cd /media/d88k/01D9C5CA3CB3C3E0/edo/nexustrade/supervisor

export $(cat .env.local | grep -v '^#' | xargs)
node -e "const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); prisma.user.findUnique({ where: { email: 'demo@nexustrade.com' }, include: { preferences: true, strategies: true } }).then(user => { if (user) { console.log('✅ Demo user found'); console.log('Email:', user.email); console.log('Name:', user.firstName, user.lastName); console.log('Strategies:', user.strategies.length); } else { console.log('❌ Demo user not found'); } prisma.\$disconnect(); });"
```

### List All Users

```bash
export $(cat .env.local | grep -v '^#' | xargs)
node -e "const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); prisma.user.findMany({ select: { email: true, firstName: true, lastName: true, createdAt: true } }).then(users => { console.log('Total users:', users.length); users.forEach(u => console.log('-', u.email, '|', u.firstName, u.lastName)); prisma.\$disconnect(); });"
```

---

## 🎯 Quick Reference

### Demo Credentials (Copy-Paste Ready)

```
Email: demo@nexustrade.com
Password: Demo123!
```

### Login URL

**Local**:
```
http://localhost:3000/login
```

**Production**:
```
https://your-project.vercel.app/login
```

### API Testing

Test authentication API:

```bash
curl -X POST http://localhost:3000/api/auth/callback/credentials \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@nexustrade.com",
    "password": "Demo123!"
  }'
```

---

## 📝 Summary

### Demo Account Status: ✅ ACTIVE

| Item | Value |
|------|-------|
| Email | demo@nexustrade.com |
| Password | Demo123! |
| Status | Active ✅ |
| Email Verified | Yes ✅ |
| Strategies | 1 (Demo RSI Strategy) |
| Created | October 17, 2024 |
| Database | Neon Tech PostgreSQL |

### What's Included

- ✅ Pre-configured user account
- ✅ Email verified
- ✅ User preferences set
- ✅ Sample trading strategy
- ✅ Ready for immediate use

---

## 🆘 Troubleshooting

### Issue: Can't Login

**Solutions**:
1. Verify credentials (case-sensitive)
2. Check if demo user exists (see Database Verification above)
3. Try resetting password
4. Check browser console for errors

### Issue: Demo User Not Found

**Solution**:
```bash
# Recreate demo user
cd /media/d88k/01D9C5CA3CB3C3E0/edo/nexustrade/supervisor
export $(cat .env.local | grep -v '^#' | xargs)
node seed-demo.js
```

### Issue: "Invalid Credentials" Error

**Possible Causes**:
- Wrong password (ensure `Demo123!` with capital D and exclamation mark)
- Database connection issue
- Password hash mismatch

**Solution**:
```bash
# Reset password
cd /media/d88k/01D9C5CA3CB3C3E0/edo/nexustrade/supervisor
export $(cat .env.local | grep -v '^#' | xargs)
node seed-demo.js  # Will skip if exists
```

---

## 🎉 Ready to Use!

Demo account is fully configured and ready for testing. Login with the credentials above and explore the NexusTrade platform!

---

**Document Created**: October 17, 2024  
**Status**: ✅ Demo Account Active  
**Next**: Login at http://localhost:3000/login
