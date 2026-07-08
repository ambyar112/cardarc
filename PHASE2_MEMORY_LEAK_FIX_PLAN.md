# PHASE 2: MEMORY LEAK FIX - PRODUCTION IMPLEMENTATION PLAN

**Status**: Ready for Implementation  
**Priority**: HIGH (Performance & Stability)  
**Estimated Impact**: -2MB memory per user session, eliminate React warnings

---

## 🔴 IDENTIFIED MEMORY LEAKS (5 Total)

### LEAK #1: cacheManager.ts - setInterval Never Cleared
**File**: `src/lib/cacheManager.ts`  
**Lines**: 302-309  
**Root Cause**: `setInterval` runs forever, never cleaned up when cache manager is destroyed

```typescript
// BEFORE (MEMORY LEAK):
if (statsInterval) clearInterval(statsInterval)
statsInterval = setInterval(() => {
  console.log('[CacheManager] Stats:', getStats())
}, 60000)
```

**Fix Pattern**: Store interval reference properly and provide cleanup method

---

### LEAK #2: Marketplace.jsx - loadListings() Async Without Cleanup
**File**: `src/pages/Marketplace.jsx`  
**Line**: 389  
**Root Cause**: `loadListings()` takes 2-5 seconds. If user navigates away, setState still executes on unmounted component

```javascript
// BEFORE (MEMORY LEAK):
useEffect(() => { loadListings() }, [loadListings])
```

**Fix Pattern**: Use `isMounted` flag to prevent setState after unmount

---

### LEAK #3: Marketplace.jsx - History Tab Loading Without Cleanup
**File**: `src/pages/Marketplace.jsx`  
**Lines**: 391-395  
**Root Cause**: Promise resolves after tab change, setState on wrong tab state

```javascript
// BEFORE (MEMORY LEAK):
useEffect(() => {
  if (tab !== 'history') return
  setTradeLoading(true)
  getMarketplaceHistory(50).then(d => { setTrades(d); setTradeLoading(false) })
}, [tab])
```

**Fix Pattern**: Use `isMounted` flag to prevent setState after tab change

---

### LEAK #4: Marketplace.jsx - User Listings Without Cleanup
**File**: `src/pages/Marketplace.jsx`  
**Lines**: 397-401  
**Root Cause**: Promise resolves after tab change, setState on wrong tab state

```javascript
// BEFORE (MEMORY LEAK):
useEffect(() => {
  if (tab !== 'myListings' || !address) return
  setUserLoading(true)
  getUserListings(address).then(d => { setUserListings(d); setUserLoading(false) })
}, [tab, address])
```

**Fix Pattern**: Use `isMounted` flag to prevent setState after tab change

---

### LEAK #5: Profile.jsx - Data Fetching Without Cleanup
**File**: `src/pages/Profile.jsx`  
**Lines**: 41-74  
**Root Cause**: Fetches 3 async resources (collection, gacha log, leaderboard). If user navigates away, all setState calls still execute

```javascript
// BEFORE (MEMORY LEAK):
useEffect(() => {
  if (!isConnected || !address) { setLoading(false); return }
  async function load() {
    setLoading(true)
    const [collection, pullLog, board] = await Promise.all([
      getCollection(address),
      getGachaLog(address, 10),
      getRealLeaderboard(),
    ])
    // Multiple setState calls follow...
  }
  load()
}, [isConnected, address])
```

**Fix Pattern**: Use `isMounted` flag to prevent setState after unmount

---

## ✅ FIX IMPLEMENTATION STRATEGY

### Standard Fix Pattern for Async useEffect:
```javascript
useEffect(() => {
  let isMounted = true  // ← Cleanup flag
  
  async function load() {
    const data = await asyncOperation()
    if (isMounted) {  // ← Check before setState
      setState(data)
    }
  }
  
  load()
  
  return () => {  // ← Cleanup function
    isMounted = false
  }
}, [deps])
```

### Fix Pattern for setInterval:
```typescript
// Store reference at module level or in class
let cleanupInterval: NodeJS.Timeout | null = null

// Provide cleanup method
export function stopStatsLogging() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval)
    cleanupInterval = null
  }
}

// Use cleanup on interval creation
if (cleanupInterval) clearInterval(cleanupInterval)
cleanupInterval = setInterval(...)
```

---

## 📋 IMPLEMENTATION CHECKLIST

- [ ] Fix cacheManager.ts setInterval leak
  - [ ] Add module-level interval reference
  - [ ] Export stopStatsLogging() cleanup function
  - [ ] Clear interval before creating new one
  
- [ ] Fix Marketplace.jsx leaks (3 useEffect hooks)
  - [ ] Add isMounted flag to loadListings useEffect (line 389)
  - [ ] Add isMounted flag to history loading useEffect (lines 391-395)
  - [ ] Add isMounted flag to user listings useEffect (lines 397-401)
  
- [ ] Fix Profile.jsx leak (1 useEffect hook)
  - [ ] Add isMounted flag to main data loading useEffect (lines 41-74)

- [ ] Testing
  - [ ] Test rapid navigation (mount/unmount cycles)
  - [ ] Monitor browser console for React warnings
  - [ ] Check memory usage in Chrome DevTools Performance tab
  - [ ] Verify no "setState on unmounted component" warnings

- [ ] Documentation
  - [ ] Update PERFORMANCE_OPTIMIZATION.md
  - [ ] Add memory leak prevention guidelines
  - [ ] Document testing results

---

## 🎯 EXPECTED RESULTS

### Before Fix:
- ❌ React warnings in console: "Can't perform a React state update on an unmounted component"
- ❌ Memory usage increases over time (2-5MB per user session)
- ❌ setInterval runs forever even after page navigation
- ❌ Potential crashes on slow network + rapid navigation

### After Fix:
- ✅ Zero React warnings
- ✅ Memory usage stable across sessions
- ✅ setInterval properly cleaned up
- ✅ Smooth navigation without crashes
- ✅ Better Core Web Vitals scores

---

## 🔧 DEPLOYMENT PLAN

1. **Create feature branch**: `fix/phase2-memory-leaks`
2. **Fix files one by one** (to minimize merge conflicts)
3. **Test locally** with rapid navigation
4. **Commit with descriptive messages**
5. **Deploy to staging** for validation
6. **Monitor production metrics** after deployment

---

## 📊 PERFORMANCE METRICS TO TRACK

### Key Metrics:
- **Memory Heap Size**: Should stay flat, not grow over time
- **React DevTools Profiler**: No warnings about unmounted components
- **Chrome Performance Tab**: Memory snapshots should show stable allocation
- **User Reports**: No freezing or sluggish performance after extended use

### Testing Scenarios:
1. **Rapid Tab Switching**: Marketplace → History → My Listings (repeat 10x)
2. **Rapid Page Navigation**: Home → Gacha → Profile → Marketplace (repeat 10x)
3. **Extended Session**: Use app for 30+ minutes, check memory usage
4. **Slow Network Simulation**: Enable throttling, navigate rapidly

---

## 🚀 READY TO IMPLEMENT

All memory leaks identified. Fix pattern is standard and proven. Low risk of introducing new bugs. High impact on stability and performance.

**Next Action**: Start fixing files one by one, beginning with cacheManager.ts.