# Fixing Prisma Migration Error on Render

## Problem
Your Render backend deployment is failing with error **P3005**:
```
The database schema is not empty. Read more about how to baseline an existing production database
```

This happens when your production database already has tables, but Prisma's `_prisma_migrations` tracking table is missing or out of sync.

---

## Solution Options

### ✅ **Option 1: One-Line Command (Recommended)**

Copy and paste this **single command** into your Render shell:

```bash
for migration in 20260909152333_init 20260909154739_use_firebase_uid_as_primary_key 20260912070734_add_phase2_case_pipeline 20260913135112_add_ai_diagnosis_to_observations 20260913154500_enable_pgvector_extension 20260913154600_add_vector_table_for_rag 20261022000000_add_idempotency_key_to_observation 20261023142400_verify_indexes 20261023220758_add_performance_indexes 20261025000000_add_plant_scan_and_response_tracking 20261028000500_formalize_farm_names; do npx prisma migrate resolve --applied "$migration"; done && npx prisma migrate deploy
```

---

### ✅ **Option 2: Use the Baseline Script**

We've created a helper script for you.

#### On Render (Linux):

1. Open your Render service shell
2. Navigate to the backend directory:
   ```bash
   cd /opt/render/project/src/backend
   ```
3. Run the baseline script:
   ```bash
   bash scripts/baseline-migrations.sh
   ```

#### On Windows (Local Testing):

```powershell
cd backend
.\scripts\baseline-migrations.ps1
```

---

### ✅ **Option 3: Manual Step-by-Step**

If you prefer to run each migration individually:

```bash
# Navigate to backend directory
cd /opt/render/project/src/backend

# Mark each migration as applied (in order)
npx prisma migrate resolve --applied "20260909152333_init"
npx prisma migrate resolve --applied "20260909154739_use_firebase_uid_as_primary_key"
npx prisma migrate resolve --applied "20260912070734_add_phase2_case_pipeline"
npx prisma migrate resolve --applied "20260913135112_add_ai_diagnosis_to_observations"
npx prisma migrate resolve --applied "20260913154500_enable_pgvector_extension"
npx prisma migrate resolve --applied "20260913154600_add_vector_table_for_rag"
npx prisma migrate resolve --applied "20261022000000_add_idempotency_key_to_observation"
npx prisma migrate resolve --applied "20261023142400_verify_indexes"
npx prisma migrate resolve --applied "20261023220758_add_performance_indexes"
npx prisma migrate resolve --applied "20261025000000_add_plant_scan_and_response_tracking"
npx prisma migrate resolve --applied "20261028000500_formalize_farm_names"

# Verify everything is in sync
npx prisma migrate deploy
```

---

## How to Access Render Shell

### Method 1: Render Dashboard
1. Go to your Render dashboard: https://dashboard.render.com
2. Select your **backend service**
3. Click the **"Shell"** tab in the top navigation
4. A terminal will open — you can paste commands here

### Method 2: Render CLI (if installed)
```bash
render shell <your-service-name>
```

---

## What This Does

The `prisma migrate resolve --applied` command tells Prisma:
> "This migration has already been applied to the database manually. Don't try to run it again — just mark it as complete in the tracking table."

After marking all existing migrations, `prisma migrate deploy` will:
- Verify the schema matches
- Mark the migration history as complete
- Allow your service to start normally

---

## After Running the Fix

1. **Check your Render logs** — the service should now start successfully
2. **Visit your API health endpoint** — e.g., `https://your-backend.onrender.com/api/v1/health`
3. **Test the dashboard** — filter controls should now fetch data correctly

---

## Prevention for Future Deployments

To avoid this issue in the future, ensure that:

1. **Initial setup uses `prisma migrate deploy`** — this is already in your `package.json` prestart script ✅
2. **Schema changes go through proper migration workflow:**
   ```bash
   # Local development
   npx prisma migrate dev --name descriptive_name
   
   # Push to git
   git add prisma/migrations
   git commit -m "Add migration: descriptive_name"
   git push
   
   # Render will auto-deploy and run `prisma migrate deploy`
   ```
3. **Never manually modify production database schema** without creating a migration

---

## Troubleshooting

### Error: "Migration X has already been applied"
✅ **This is good!** It means the migration was already marked. Continue with the next one.

### Error: "Database connection failed"
❌ Check your `DATABASE_URL` environment variable in Render settings.

### Error: "Migration X is missing in the database"
⚠️ This means your database is missing tables that should exist. You may need to:
1. Run `npx prisma db push` (careful — this can be destructive)
2. Or restore from a backup
3. Or reset the database (if no important data exists)

### Service still won't start after baselining
1. Check Render logs for the **exact error**
2. Verify `DATABASE_URL` is correct
3. Verify all environment variables are set (`FIREBASE_PROJECT_ID`, `OPENAI_API_KEY`, etc.)
4. Try manually running: `npm run start` in the Render shell to see detailed errors

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `npx prisma migrate resolve --applied "migration_name"` | Mark a migration as already applied |
| `npx prisma migrate deploy` | Apply pending migrations (production) |
| `npx prisma migrate dev` | Create and apply migrations (development) |
| `npx prisma db push` | Push schema changes without migrations (dev only) |
| `npx prisma migrate status` | Check which migrations are pending |

---

## Need Help?

If you're still having issues:

1. Share the **full error output** from Render logs
2. Confirm your database type (PostgreSQL, MySQL, etc.)
3. Check if the `_prisma_migrations` table exists in your database
4. Verify the actual database schema matches your `schema.prisma` file

---

**Created:** 2026-10-27  
**Last Updated:** 2026-10-27
