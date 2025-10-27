# Admin Role Implementation

## Overview
Added role-based access control to hide admin panel from non-admin users and protect admin routes.

## Changes Made

### 1. Database Schema (`prisma/schema.prisma`)
Added `role` field to User model:
```prisma
model User {
  // ... other fields
  role String @default("user") // "user" or "admin"
  // ... other fields
}
```

### 2. Authentication (`src/lib/auth.ts`)
Updated NextAuth callbacks to include role in session:
```typescript
// In authorize callback
return {
  id: user.id,
  email: user.email,
  name: `${user.firstName} ${user.lastName}`.trim() || user.email,
  image: user.avatarUrl,
  role: user.role || 'user',
};

// In JWT callback
if (user) {
  token.id = user.id;
  token.email = user.email;
  token.role = user.role || 'user';
}

// In session callback
if (session.user) {
  session.user.id = token.id as string;
  session.user.email = token.email as string;
  session.user.role = token.role as string;
}
```

### 3. TypeScript Types (`src/types/next-auth.d.ts`)
Extended NextAuth types to include role:
```typescript
declare module 'next-auth' {
  interface User {
    id: string;
    role?: string;
  }

  interface Session {
    user: {
      id: string;
      role?: string;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role?: string;
  }
}
```

### 4. Frontend Layout (`src/app/(dashboard)/layout.tsx`)
Added conditional rendering for admin section:
```typescript
{/* Admin Section - Only show for admin users */}
{session?.user?.role === 'admin' && (
  <div className="pt-4 mt-4 border-t border-primary">
    <div className="px-4 mb-2">
      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
        Admin
      </span>
    </div>
    {adminNavItems.map((item) => (
      // ... admin nav items
    ))}
  </div>
)}
```

### 5. Backend Protection (`src/app/api/supervisor/usage-stats/route.ts`)
Added role check in admin API routes:
```typescript
// Check if user is admin
if (session.user.role !== 'admin') {
  return NextResponse.json(
    { error: 'Forbidden: Admin access required' },
    { status: 403 }
  );
}
```

## Database Migration

### Create Migration
```bash
npx prisma migrate dev --name add_user_role
```

### Apply Migration to Production
```bash
npx prisma migrate deploy
```

## Setting Admin Users

### Script: `scripts/set-admin-user.ts`
```bash
# Set a user as admin
npm run set-admin -- admin@example.com

# Or using ts-node directly
npx ts-node scripts/set-admin-user.ts admin@example.com
```

### Manual SQL (if needed)
```sql
-- Set specific user as admin
UPDATE "User" SET role = 'admin' WHERE email = 'admin@example.com';

-- Check admin users
SELECT id, email, role FROM "User" WHERE role = 'admin';
```

## Security Considerations

### Frontend
✅ Admin panel hidden from non-admin users in navigation  
✅ No admin menu items rendered for regular users  
✅ Clean UI without admin clutter for demo users  

### Backend
✅ API routes check `session.user.role === 'admin'`  
✅ 403 Forbidden returned for non-admin access attempts  
✅ Proper error messages for unauthorized access  

### Session Management
✅ Role included in JWT token  
✅ Role included in session object  
✅ Role persists across page refreshes  
✅ Role updated on next login after database change  

## User Roles

### `user` (Default)
- Access to dashboard, strategies, backtesting
- Can create and manage own strategies
- Can run backtests and view analytics
- Cannot access admin panel or admin routes

### `admin`
- All `user` permissions
- Access to admin panel (`/dashboard/admin/supervisor`)
- Access to LLM usage statistics
- Access to system-wide supervisor features

## Testing

### Frontend Testing
1. Login as regular user → Admin panel should NOT appear
2. Login as admin user → Admin panel SHOULD appear
3. Click admin panel link → Should load successfully

### Backend Testing
1. Call `/api/supervisor/usage-stats` as regular user → 403 Forbidden
2. Call `/api/supervisor/usage-stats` as admin → 200 OK with data
3. Verify error message is clear and informative

### Migration Testing
1. Run migration on development database
2. Verify `role` column exists with default `'user'`
3. Verify existing users have `role = 'user'`
4. Run `set-admin-user` script and verify role update
5. Login and verify admin panel appears

## Rollback Plan

If issues occur, rollback migration:
```bash
# Revert migration
npx prisma migrate resolve --rolled-back add_user_role

# Drop column manually if needed
ALTER TABLE "User" DROP COLUMN "role";
```

## Future Enhancements

1. **More Granular Roles**
   - `super_admin`: Full system access
   - `moderator`: Limited admin features
   - `analyst`: Read-only admin access

2. **Permission System**
   - Replace role string with permissions array
   - Fine-grained access control per feature

3. **Admin Dashboard Improvements**
   - User management (promote/demote admins)
   - System monitoring and health checks
   - Bulk operations and reports

4. **Audit Logging**
   - Log admin actions
   - Track role changes
   - Monitor unauthorized access attempts

## Files Modified

1. `prisma/schema.prisma` - Added role field
2. `src/lib/auth.ts` - Include role in session
3. `src/types/next-auth.d.ts` - TypeScript types
4. `src/app/(dashboard)/layout.tsx` - Conditional rendering
5. `src/app/api/supervisor/usage-stats/route.ts` - Backend protection
6. `scripts/set-admin-user.ts` - Admin management script
7. `prisma/migrations/add_user_role/migration.sql` - Database migration

## Date
2025-10-26
