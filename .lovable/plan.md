

## Add Deep Search to Catalog Manager

Add a search bar at the top of `AdminCatalogManager` that filters across all three levels (sections, categories, subcategories) plus attribute blocks in real-time.

### Implementation

**File: `src/components/admin/AdminCatalogManager.tsx`**

1. Add a `searchQuery` state and a search input with the `Search` icon at the top, below the tab list.

2. Create a `filterBySearch` function that matches the query (case-insensitive) against:
   - Parent group names (sections)
   - Category `display_name`, `category` slug
   - Subcategory `display_name`, `slug`
   - Attribute block `display_name`, `block_type`, `description`

3. **Overview tab**: Filter the categories list — show only categories whose name matches OR that have a matching subcategory or matching linked attribute block. Highlight matches.

4. **Taxonomy tree**: Filter the tree to only show branches containing a match at any level.

5. When search is active, auto-expand matching categories in the overview and show a result count badge next to the search bar (e.g., "3 results").

6. Clear button (X) to reset search.

### Search matching logic
```text
query = searchQuery.toLowerCase()

match(item) = item.name includes query
           OR item.slug includes query
           OR item.description includes query

filteredCategories = categories where:
  - category itself matches, OR
  - any subcategory under it matches, OR
  - any linked attribute block matches

filteredTaxonomy = groups where:
  - group name matches, OR
  - any child category/subcategory matches
```

### UI placement
- Search bar sits between the tab list and the taxonomy collapsible
- Sticky position so it stays visible while scrolling
- Small, consistent with existing design (rounded-xl, bg-muted, 9px height input)

