-- Migration: Add branch_id to services table
-- Date: 2026-05-11
-- Purpose: Allow services to be assigned to specific branches

-- 1. Add branch_id column to services table (nullable for backward compatibility)
ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;

-- 2. Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_services_org_branch 
ON public.services(org_id, branch_id);

-- 3. Create index for branch-specific queries
CREATE INDEX IF NOT EXISTS idx_services_branch_active
ON public.services(branch_id, active) 
WHERE branch_id IS NOT NULL;

-- 4. Update RLS policies if they exist
-- (Check if RLS is enabled and update accordingly)

-- 5. Optional: Backfill branch_id for existing services
-- Only run this if all services should belong to the primary branch
-- Commented out by default to preserve existing data
/*
-- Get the first branch for each org
WITH primary_branches AS (
  SELECT org_id, MIN(id) as primary_branch_id
  FROM public.branches
  GROUP BY org_id
)
UPDATE public.services s
SET branch_id = pb.primary_branch_id
FROM primary_branches pb
WHERE s.org_id = pb.org_id
  AND s.branch_id IS NULL;
*/

-- 6. Verify the change
DO $$
BEGIN
  -- Check column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'services' AND column_name = 'branch_id'
  ) THEN
    RAISE NOTICE 'Column branch_id added to services table successfully';
  ELSE
    RAISE WARNING 'Column branch_id was NOT added to services table';
  END IF;
END $$;

-- Output success message
SELECT 
  'Migration complete: services.branch_id' as status,
  NOW() as executed_at;
