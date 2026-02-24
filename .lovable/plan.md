
## Understanding
You are seeing persistent mobile alignment issues:
- visible empty space at the top and bottom
- bottom nav feels lifted above the screen edge
- top navigation sits lower than expected

## Root cause analysis (what’s actually wrong)
I reviewed the current implementation and identified multiple compounding causes:

1. **Forced safe-area padding is always added**
- In `src/index.css`:
  - `.safe-top { padding-top: max(12px, env(safe-area-inset-top)); }`
  - `.safe-bottom { padding-bottom: max(8px, env(safe-area-inset-bottom)); }`
- This guarantees extra top (+12px) and bottom (+8px) space even on devices where inset is zero.

2. **Viewport sizing is conflicting**
- In `src/index.css`, `html/body/#root` set both:
  - `height: 100dvh;`
  - `height: 100%;`
- The later `height: 100%` overrides `100dvh`, which can produce unstable mobile viewport behavior and visible edge gaps.

3. **Sticky headers across pages stack with safe-top**
- Many pages (`CategoriesPage`, `CategoryPage`, `SearchPage`, etc.) use sticky wrappers + `.safe-top`.
- Because `.safe-top` is currently forced, headers appear pushed down globally.

4. **Bottom nav alignment is affected by global spacing strategy**
- `BottomNav` is fixed to `bottom-0`, but global safe spacing and mixed padding behavior make it look visually detached from the bottom.

## Implementation plan

### Phase 1 — Fix global viewport baseline
**File:** `src/index.css`
- Remove conflicting duplicate height declarations (`height: 100%`) from `html, body, #root`.
- Keep a single viewport source of truth based on `100dvh`.
- Add/reset:
  - `margin: 0; padding: 0;` on `html, body`
  - ensure background on `html, body, #root` so no edge strip can appear.

### Phase 2 — Correct safe-area utilities (no forced phantom space)
**File:** `src/index.css`
- Replace:
  - `.safe-top` from `max(12px, env(...))` → `env(safe-area-inset-top)`
  - `.safe-bottom` from `max(8px, env(...))` → `env(safe-area-inset-bottom)`
- Add optional utility for components that intentionally need extra comfort spacing:
  - `.safe-bottom-comfort { padding-bottom: calc(env(safe-area-inset-bottom) + 8px); }`

### Phase 3 — Bottom nav visual anchoring
**File:** `src/components/layout/BottomNav.tsx`
- Keep functional behavior unchanged.
- Normalize safe-area handling to utility class usage for consistency.
- Tune internal vertical padding so nav appears flush while preserving touch targets.

### Phase 4 — Top header lift adjustment
**File:** `src/components/layout/Header.tsx`
- Keep logic and actions identical.
- After global `.safe-top` correction, fine-tune header row spacing (`pt/pb`) so it sits slightly higher without clipping status-bar-safe content.

### Phase 5 — Screen-level verification and targeted polish
Validate and apply only minimal class tweaks (if needed) on pages that use custom sticky headers:
- `src/pages/CategoriesPage.tsx`
- `src/pages/CategoryPage.tsx`
- `src/pages/SearchPage.tsx`
- `src/pages/CartPage.tsx`
- `src/pages/SocietyDashboardPage.tsx`

## Technical details (dedicated)

```text
Current:
safe-top    = max(12px, insetTop)
safe-bottom = max(8px, insetBottom)
viewport    = 100dvh overridden by 100%

Target:
safe-top    = insetTop
safe-bottom = insetBottom
viewport    = 100dvh only
```

Expected impact:
- removes fixed phantom spacing on devices with no inset
- keeps proper notch/home-indicator safety on devices that need it
- aligns bottom nav to edge consistently
- lifts top nav to intended position
- no changes to routing, data, cart, or user flows

## Non-technical summary
The layout issue is not a single component bug; it’s caused by global spacing rules adding extra space by default. I’ll correct the base mobile sizing and safe-area behavior, then lightly retune header/nav spacing. This will eliminate the top/bottom blank space and properly anchor navigation without changing app functionality.

## Acceptance checklist
1. Home: no visible gap above header or below bottom nav.
2. Categories and Category pages: top header sits correctly; bottom nav flush to edge.
3. Works consistently on iPhone-size and Android-size viewports.
4. Scrolling and route changes do not reintroduce gaps.
5. All interactions (tabs, cart, badges, search, navigation) remain unchanged.
