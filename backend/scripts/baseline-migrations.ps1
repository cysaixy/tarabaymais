# Prisma Migration Baseline Script for Render Deployment (PowerShell)
# This script marks all existing migrations as applied without running them

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Prisma Migration Baseline Script" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This will mark all migrations as applied without running them." -ForegroundColor Yellow
Write-Host "Use this when your database already has the schema." -ForegroundColor Yellow
Write-Host ""

# Check if DATABASE_URL is set
if (-not $env:DATABASE_URL) {
  Write-Host "❌ ERROR: DATABASE_URL environment variable is not set" -ForegroundColor Red
  exit 1
}

Write-Host "✅ DATABASE_URL is set" -ForegroundColor Green
Write-Host ""

# List of all migrations in chronological order
$migrations = @(
  "20260909152333_init",
  "20260909154739_use_firebase_uid_as_primary_key",
  "20260912070734_add_phase2_case_pipeline",
  "20260913135112_add_ai_diagnosis_to_observations",
  "20260913154500_enable_pgvector_extension",
  "20260913154600_add_vector_table_for_rag",
  "20261022000000_add_idempotency_key_to_observation",
  "20261023142400_verify_indexes",
  "20261023220758_add_performance_indexes",
  "20261025000000_add_plant_scan_and_response_tracking",
  "20261028000500_formalize_farm_names"
)

Write-Host "📋 Found $($migrations.Count) migrations to baseline" -ForegroundColor Cyan
Write-Host ""

# Mark each migration as applied
foreach ($migration in $migrations) {
  Write-Host "⏳ Marking migration as applied: $migration" -ForegroundColor Yellow
  
  npx prisma migrate resolve --applied "$migration"
  
  if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Successfully marked: $migration" -ForegroundColor Green
  } else {
    Write-Host "❌ Failed to mark: $migration" -ForegroundColor Red
    exit 1
  }
  Write-Host ""
}

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "✅ All migrations have been baselined!" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Now running 'prisma migrate deploy' to verify..." -ForegroundColor Yellow
Write-Host ""

# Run migrate deploy to verify everything is in sync
npx prisma migrate deploy

if ($LASTEXITCODE -eq 0) {
  Write-Host ""
  Write-Host "==================================" -ForegroundColor Cyan
  Write-Host "✅ SUCCESS! Prisma migrations are now in sync." -ForegroundColor Green
  Write-Host "Your Render service should now start successfully." -ForegroundColor Green
  Write-Host "==================================" -ForegroundColor Cyan
} else {
  Write-Host ""
  Write-Host "==================================" -ForegroundColor Cyan
  Write-Host "⚠️ WARNING: 'prisma migrate deploy' reported issues." -ForegroundColor Yellow
  Write-Host "Please review the output above." -ForegroundColor Yellow
  Write-Host "==================================" -ForegroundColor Cyan
  exit 1
}
