# Database Migration Plan

## Goal: Move ALL admin data operations from localStorage to PostgreSQL

## Files to Create:

1. **API Routes for Orders:**
   - `src/app/api/orders/route.ts` — GET (list all), POST (create order + items)
   - `src/app/api/orders/[id]/route.ts` — PUT (update status, payment, fields, deliver)

2. **API Routes for Menu:**
   - `src/app/api/menu/route.ts` — GET (list), POST (create)
   - `src/app/api/menu/[id]/route.ts` — PUT (update), DELETE

3. **API Routes for Settings:**
   - `src/app/api/settings/route.ts` — GET, PUT

4. **Update `src/data/store.ts`:**
   - Replace all localStorage operations with async API fetch calls
   - Keep same function signatures but make them async
   - Functions: getOrders, getOrder, createOrder, updateOrderStatus, updateOrderPaymentStatus, updateOrderFields, loadMenu, saveMenu, loadSettings, saveSettings

5. **Migrate existing localStorage data to PostgreSQL on first run**

## Implementation Notes:

For the API routes:
- Use the existing `src/lib/db.ts` for database access
- Set audit user via `setAuditUser(userId)` for each request
- Accept/return JSON the same format as the current localStorage data
- Order items are stored as JSON in the order_items table

For store.ts:
- Make all functions async (return Promises)
- Handle the case where the API is unavailable (fallback to localStorage for now)
- Cache data locally for performance (but always sync with DB)

The admin page and RoutePlanner components use store.ts functions. Since we're changing them to async, we need to update all callers. The simplest approach:
- Keep `getOrders()` synchronous but return cached data + trigger a background refresh
- Actually, just make all store functions async and update the callers with `useEffect` + state

Better approach: Create a thin wrapper that:
1. On mount, fetches from API and caches in state
2. On mutations, calls API and updates state
3. Falls back to localStorage if API is unavailable
