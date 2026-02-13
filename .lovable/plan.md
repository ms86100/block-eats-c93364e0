

# Dynamic Category Management Refactor

## Overview

This refactor makes both parent categories (groups) and subcategories fully database-driven, removing all hardcoded constants while preserving backward compatibility with existing data and functionality.

## Current State

- **Parent groups** (Food, Classes, Services, etc.) are hardcoded as the `PARENT_GROUPS` constant in `src/types/categories.ts` -- used across 6 files
- **Subcategories** (home_food, bakery, yoga, etc.) are stored in `category_config` table but also duplicated as the hardcoded `CATEGORIES` constant in `src/types/database.ts` -- used across 5+ files
- The `category_config` table references parent groups via a plain `parent_group` text column with no relational integrity
- Admin can CRUD subcategories but parent groups are fixed in code

## What Changes

### 1. Database: New `parent_groups` Table

Create a new table to store parent categories:

```text
parent_groups
  id          uuid (PK)
  slug        text (unique) -- e.g. "food", "classes"
  name        text          -- e.g. "Food & Groceries"
  icon        text          -- emoji
  color       text          -- tailwind classes
  description text
  is_active   boolean (default true)
  sort_order  integer (default 0)
  created_at  timestamptz
  updated_at  timestamptz
```

Migration will:
- Create the table with RLS (anyone can read active groups, admins can manage)
- Seed it with all 10 existing parent groups from the hardcoded constant
- Add a foreign key from `category_config.parent_group` referencing `parent_groups.slug`
- Add indexes on `slug` and `sort_order`

### 2. Cascading Toggle Logic

- When a parent group is toggled OFF, all its subcategories in `category_config` are set to `is_active = false`
- When toggled ON, subcategories retain their individual state (not auto-enabled)
- Product/seller visibility checks: listings only show if BOTH the parent group AND subcategory are active

### 3. New Hook: `useParentGroups`

A new hook in `src/hooks/useParentGroups.ts` that:
- Fetches parent groups from the database
- Provides grouped data (parent + its subcategories)
- Replaces all imports of the hardcoded `PARENT_GROUPS` constant

### 4. Remove Hardcoded Constants

- **Delete** the `PARENT_GROUPS` array from `src/types/categories.ts`
- **Delete** the `CATEGORIES` array from `src/types/database.ts`
- **Keep** the TypeScript types (`ParentGroup`, `ServiceCategory`, etc.) but make them `string` types since values are now dynamic
- Update all 6+ files that import `PARENT_GROUPS` to use the new hook
- Update all 5+ files that import `CATEGORIES` to use `useCategoryConfigs()` instead

### 5. Admin UI: Full CRUD for Parent Groups

Refactor `CategoryManager.tsx` to:
- Fetch parent groups from DB instead of iterating over a constant
- Add "Create Parent Category" button with modal (name, icon, color, description)
- Edit parent category (name, icon, color, description)
- Delete parent category (soft-delete if subcategories exist with active listings)
- Toggle parent category (with cascading disable of subcategories)
- Reorder parent categories via sort_order

### 6. Files Affected

| File | Change |
|---|---|
| `src/types/categories.ts` | Remove `PARENT_GROUPS` constant, keep types |
| `src/types/database.ts` | Remove `CATEGORIES` constant |
| `src/hooks/useParentGroups.ts` | **New** -- DB-driven parent group hook |
| `src/hooks/useCategoryBehavior.ts` | Update `groupedConfigs` to use DB parent groups |
| `src/components/admin/CategoryManager.tsx` | Full CRUD for parent groups + subcategories |
| `src/components/category/CategoryGroupGrid.tsx` | Use hook instead of constant |
| `src/components/category/CategoryGrid.tsx` | Use `useCategoryConfigs` instead of `CATEGORIES` |
| `src/pages/BecomeSellerPage.tsx` | Use hook instead of constant |
| `src/pages/CategoryGroupPage.tsx` | Use hook instead of constant |
| `src/pages/SellerSettingsPage.tsx` | Use hook instead of constant |
| `src/pages/SellerDetailPage.tsx` | Use hook instead of `CATEGORIES` |
| `src/pages/SellerProductsPage.tsx` | Use hook instead of `CATEGORIES` |
| `src/pages/CategoryPage.tsx` | Use hook instead of `CATEGORIES` |

### 7. Backward Compatibility

- The `parent_groups.slug` values match the existing `parent_group` text values in `category_config`, so no data migration needed for subcategories
- Existing `seller_profiles.primary_group` and `seller_profiles.categories` continue to work because they reference slugs/category keys
- Existing orders, products, and listings are unaffected -- they reference category text keys which remain the same
- The `DEFAULT_GROUP_BEHAVIORS` map in `types/categories.ts` will be kept as a fallback but behavior flags already exist per-subcategory in `category_config`

### 8. Safety Checks

- Delete parent group: check if any active subcategories have products/sellers; if so, soft-delete (set `is_active = false`) with a warning
- Delete subcategory: existing logic already checks for sellers using it
- All changes are additive -- no columns removed, no data deleted

