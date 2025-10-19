# 🔑 Demo Account Setup Guide

## 📌 **Demo Account Credentials**

```
Email: demo@nexustrade.com
Password: Demo123!
```

## ⚠️ **Status: BELUM ADA di Database**

Demo account **BELUM dibuat** di database production. Anda perlu run seed script setelah deploy.

---

## 🚀 **Cara Setup Demo Account**

### **Option 1: Via Vercel CLI (Recommended)**

1. **Install Vercel CLI** (jika belum):
```bash
npm i -g vercel
```

2. **Link project**:
```bash
vercel link
```

3. **Pull environment variables**:
```bash
vercel env pull .env.local
```

4. **Run seed script**:
```bash
npm run seed
```

### **Option 2: Manual dengan DATABASE_URL**

1. **Get DATABASE_URL dari Vercel/Neon Dashboard**

2. **Set environment variable**:
```bash
export DATABASE_URL="postgresql://[YOUR_CONNECTION_STRING]"
```

3. **Run seed script**:
```bash
npm run seed
```

### **Option 3: Direct Database Push + Seed**

```bash
# Push schema ke database
npm run db:push

# Seed demo data
npm run seed
```

---

## 📊 **Apa yang Dibuat oleh Seed Script?**

1. **Demo User**:
   - Email: `demo@nexustrade.com`
   - Password: `Demo123!`
   - Name: Demo User
   - Email verified: Yes
   - Preferences: Default (light theme, EN, UTC)

2. **Sample Strategy**:
   - Name: "Demo RSI Strategy"
   - Symbol: EURUSD
   - Timeframe: H1
   - Type: Manual
   - Status: Draft
   - Rules: RSI < 30 entry condition

---

## 🔍 **Verify Demo Account Created**

### **Via Prisma Studio**:
```bash
npm run db:studio
```
Then check Users table for demo@nexustrade.com

### **Via SQL Query** (di Neon Dashboard):
```sql
SELECT id, email, "firstName", "lastName", "emailVerified" 
FROM "User" 
WHERE email = 'demo@nexustrade.com';
```

---

## ⚠️ **Important Notes**

1. **Password Hashing**: Password di-hash menggunakan bcrypt, jadi tidak bisa dilihat di database
2. **Run Once**: Seed script sebaiknya hanya dijalankan sekali untuk avoid duplicate
3. **Production Safety**: Seed script aman untuk production karena hanya create demo account

---

## 🛠️ **Troubleshooting**

### **Error: Cannot find module '../src/lib/crypto'**
Solution: Run from project root directory:
```bash
cd /home/luckyn00b/Documents/fx-platform-windows
npm run seed
```

### **Error: Database connection failed**
Solution: Pastikan DATABASE_URL correct dan database accessible:
```bash
# Test connection
npx prisma db pull
```

### **Error: User already exists**
Solution: Demo user sudah ada, skip atau hapus dulu:
```sql
DELETE FROM "User" WHERE email = 'demo@nexustrade.com';
```

---

## 📝 **Alternative: Create via API**

Jika seed script bermasalah, bisa create user via API setelah deploy:

```javascript
// POST to /api/auth/register
{
  "email": "demo@nexustrade.com",
  "password": "Demo123!",
  "firstName": "Demo",
  "lastName": "User"
}
```

---

**Status: ⏳ Waiting for database seed after Vercel deployment**
