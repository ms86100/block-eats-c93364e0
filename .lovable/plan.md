

# Plan: AI Auto-Review Production Fix — Config.toml Entry

## Identified Gap (P1)
The `supabase/config.toml` file is missing the `[functions.ai-auto-review]` entry with `verify_jwt = false`. This is the only production-blocking issue found in the audit.

## Implementation Step

**File: `supabase/config.toml`**
Add the following entry (alongside existing function declarations):
```toml
[functions.ai-auto-review]
verify_jwt = false
```

## Evidence of Completion
After the fix, I will:
1. Verify the config.toml contains the new entry
2. Invoke the edge function to confirm it still responds correctly
3. Check edge function logs for any JWT-related errors

## What Does NOT Change
- Edge function code (`supabase/functions/ai-auto-review/index.ts`)
- `ai_review_log` table schema or RLS
- Any existing approval flows
- Admin UI components
- Cron schedule

## Accepted Limitations (Documented, No Fix Required)
- Items cannot be re-reviewed by AI after admin override
- Seller approval cascades to all products without per-product AI review
- No backlog alerting (acceptable at current scale)

