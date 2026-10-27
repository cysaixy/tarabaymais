#!/bin/bash
# Prisma Migration Baseline Script for Render Deployment
# This script marks all existing migrations as applied without running them
# Use this when your production database already has the schema but Prisma's
# migration history table is missing or out of sync

set -e

echo "=================================="
echo "Prisma Migration Baseline Script"
echo "=================================="
echo ""
echo "This will mark all migrations as applied without running them."
echo "Use this when your database already has the schema."
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL environment variable is not set"
  exit 1
fi

echo "✅ DATABASE_URL is set"
echo ""

# List of all migrations in chronological order
migrations=(
  "20260909152333_init"
  "20260909154739_use_firebase_uid_as_primary_key"
  "20260912070734_add_phase2_case_pipeline"
  "20260913135112_add_ai_diagnosis_to_observations"
  "20260913154500_enable_pgvector_extension"
  "20260913154600_add_vector_table_for_rag"
  "20261022000000_add_idempotency_key_to_observation"
  "20261023142400_verify_indexes"
  "20261023220758_add_performance_indexes"
  "20261025000000_add_plant_scan_and_response_tracking"
  "20261028000500_formalize_farm_names"
)

echo "📋 Found ${#migrations[@]} migrations to baseline"
echo ""

# Mark each migration as applied
for migration in "${migrations[@]}"; do
  echo "⏳ Marking migration as applied: $migration"
  npx prisma migrate resolve --applied "$migration"
  
  if [ $? -eq 0 ]; then
    echo "✅ Successfully marked: $migration"
  else
    echo "❌ Failed to mark: $migration"
    exit 1
  fi
  echo ""
done

echo "=================================="
echo "✅ All migrations have been baselined!"
echo "=================================="
echo ""
echo "Now running 'prisma migrate deploy' to verify..."
echo ""

# Run migrate deploy to verify everything is in sync
npx prisma migrate deploy

if [ $? -eq 0 ]; then
  echo ""
  echo "=================================="
  echo "✅ SUCCESS! Prisma migrations are now in sync."
  echo "Your Render service should now start successfully."
  echo "=================================="
else
  echo ""
  echo "=================================="
  echo "⚠️ WARNING: 'prisma migrate deploy' reported issues."
  echo "Please review the output above."
  echo "=================================="
  exit 1
fi
