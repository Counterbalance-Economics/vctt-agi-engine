
# MIN Self-Maintenance System
**Autonomous API Integrity & Breakage Prevention**

## 🎯 Overview

The MIN Self-Maintenance System prevents future breakages when switching between DeepAgent instances by:

1. **Backend (vctt-agi-engine)**: MIN performs self-diagnostics and maintains an API reference in memory
2. **Frontend (vctt-agi-ui)**: DeepAgent instances fetch the reference before taking actions
3. **Result**: Autonomous system integrity with zero manual intervention

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     MIN (Backend System)                         │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  SystemIntegrityService (Stage 5 - Self-Maintenance)       │ │
│  │                                                              │ │
│  │  1. Startup Diagnostic (onModuleInit):                      │ │
│  │     - Fetch API reference from memory                       │ │
│  │     - Compare against running routes                        │ │
│  │     - Log discrepancies to memory                           │ │
│  │     - Create diagnostic reports                             │ │
│  │                                                              │ │
│  │  2. Daily Review (Scheduled at 2 AM):                       │ │
│  │     - Analyze API usage via Analytics                       │ │
│  │     - Identify underused endpoints                          │ │
│  │     - Check error rates                                     │ │
│  │     - Update reference in memory                            │ │
│  │     - Propose improvements                                  │ │
│  │                                                              │ │
│  │  Dependencies:                                              │ │
│  │  - MemoryService (persistent storage)                       │ │
│  │  - AnalyticsService (usage data)                            │ │
│  │  - SchedulerService (recurring tasks)                       │ │
│  │  - HttpAdapterHost (route introspection)                    │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  Memory Storage (MIN's Permanent Memory):                        │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  user_id: 'min_system'                                      │ │
│  │  type: 'system_api_reference'                               │ │
│  │  content: {                                                 │ │
│  │    version: "1.0.0",                                        │ │
│  │    last_updated: "2025-11-22T...",                          │ │
│  │    endpoints: {                                             │ │
│  │      core: { "POST /api/v1/session/start": {...} },        │ │
│  │      analytics: { "GET /api/v1/analytics/sessions": {...} }│ │
│  │    }                                                        │ │
│  │  }                                                          │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              ▼
                  API: GET /api/memory/retrieve
                  ?userId=min_system&type=system_api_reference
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              DeepAgent Instances (Frontend)                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  API Reference Service (api-reference.ts)                   │ │
│  │                                                              │ │
│  │  Startup Protocol:                                          │ │
│  │  1. Fetch API reference from MIN's memory                   │ │
│  │  2. Parse and cache reference                               │ │
│  │  3. Provide validation methods                              │ │
│  │  4. Fallback to essential endpoints if unavailable          │ │
│  │                                                              │ │
│  │  Usage in Components:                                       │ │
│  │  const { validateEndpoint } = useApiReference();            │ │
│  │  const result = validateEndpoint('POST', '/api/session');   │ │
│  │  if (!result.valid) throw new Error(result.message);        │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  UI Indicator (ApiReferenceStatus.tsx):                          │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  [Bottom-right corner]                                      │ │
│  │  ✅ API Reference: v1.0.0          (Loaded successfully)    │ │
│  │  ⚠️  Using fallback API reference   (MIN unavailable)       │ │
│  │  ⏳ Loading API reference...        (Fetching from MIN)     │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 File Structure

### Backend (`vctt-agi-engine`)

```
nodejs_space/src/
├── app.module.ts                          # Added SystemIntegrityService provider
└── services/
    └── system-integrity.service.ts         # ⭐ NEW: Core self-maintenance logic
```

### Frontend (`vctt-agi-ui`)

```
src/
├── services/
│   ├── api-reference.ts                   # ⭐ NEW: API reference service
│   └── api.ts                             # MODIFIED: Added getMemories() method
├── hooks/
│   └── useApiReference.ts                 # ⭐ NEW: React hook for components
├── components/
│   └── ApiReferenceStatus.tsx             # ⭐ NEW: UI status indicator
└── pages/
    └── ChatbotLanding.tsx                 # MODIFIED: Added status component
```

---

## 🚀 Implementation Details

### 1. Backend: Startup Diagnostic

**File:** `nodejs_space/src/services/system-integrity.service.ts`

**Runs:** On every backend restart (Render redeploy)

**Process:**
```typescript
async runStartupDiagnostic() {
  // 1. Fetch API reference from MIN's memory
  const apiRef = await this.getApiReferenceFromMemory();
  
  // 2. Get current running routes from NestJS
  const currentRoutes = this.extractRunningRoutes();
  
  // 3. Validate (compare expected vs actual)
  const discrepancies = this.validateApiRoutes(apiRef, currentRoutes);
  
  // 4. Store results in memory for MIN's review
  if (discrepancies.length > 0) {
    await this.memoryService.storeMemory({
      user_id: 'min_system',
      content: JSON.stringify({ discrepancies, timestamp: ... }),
      type: 'system_diagnostic_report',
    });
    this.logger.warn(`Found ${discrepancies.length} API discrepancies`);
  }
}
```

**Logs:**
```
🔍 MIN Startup Diagnostic: Initiating...
📚 Loaded API reference v1.0.0 (updated 2025-11-22)
🔍 Found 84 running routes
✅ Startup diagnostic: All APIs match reference
```

**If Issues Found:**
```
⚠️ Found 3 API discrepancies
📝 Discrepancies:
[
  { "type": "missing", "message": "Missing endpoint: POST /api/coach/proposals" },
  { "type": "unexpected", "message": "Unexpected endpoint: GET /test-endpoint" }
]
📝 Diagnostic report stored in MIN memory
```

---

### 2. Backend: Daily Review

**Runs:** Daily at 2 AM UTC (scheduled via Scheduler)

**Process:**
```typescript
async runDailyReview() {
  // 1. Fetch current API reference
  const apiRef = await this.getApiReferenceFromMemory();
  
  // 2. Fetch usage analytics
  const aggregate = await this.analyticsService.getAggregateAnalytics();
  const sessions = await this.analyticsService.getSessions(undefined, 100);
  
  // 3. Analyze patterns
  const underused = this.findUnderusedEndpoints(apiRef);
  const errors = this.analyzeErrorRates(aggregate);
  
  // 4. Generate report and store in memory
  const report = {
    timestamp: new Date().toISOString(),
    total_endpoints: 84,
    underused_endpoints: 12,
    error_rate: 2.5,
    recommendations: ['Connect 12 underused endpoints'],
  };
  
  await this.memoryService.storeMemory({
    user_id: 'min_system',
    content: JSON.stringify(report),
    type: 'daily_integrity_report',
  });
  
  // 5. Reschedule for tomorrow
  await this.rescheduleDailyReview();
}
```

**Logs:**
```
📊 MIN Daily Review: Starting...
📚 Loaded API reference v1.0.0
📊 Analyzed 127 sessions
⚠️ Found 12 underused endpoints
✅ Daily review complete: 1 recommendation
📊 Report stored in MIN memory
📅 Rescheduled for 2025-11-23 02:00:00 UTC
```

---

### 3. Frontend: DeepAgent Protocol

**File:** `src/services/api-reference.ts`

**Runs:** On every DeepAgent instance startup

**Process:**
```typescript
async initialize(): Promise<boolean> {
  // 1. Fetch API reference from MIN's memory
  const memories = await api.getMemories('min_system', 'system_api_reference', 1);
  
  // 2. Parse and cache
  this.apiReference = JSON.parse(memories[0].content);
  
  // 3. Log status
  console.log(`✅ API Reference loaded: v${this.apiReference.version}`);
  console.log(`📊 Total endpoints: ${this.countEndpoints(this.apiReference)}`);
  
  return true;
}

// Validate before API calls
validateEndpoint(method: string, path: string): { valid: boolean; message: string } {
  const endpoint = `${method.toUpperCase()} ${path}`;
  
  for (const category in this.apiReference.endpoints) {
    if (endpoint in this.apiReference.endpoints[category]) {
      return { valid: true, message: `Valid endpoint in category: ${category}` };
    }
  }
  
  return { valid: false, message: `Endpoint not found: ${endpoint}` };
}
```

**Console Output:**
```
🔄 DeepAgent: Fetching API reference from MIN...
✅ API Reference loaded: v1.0.0 (2025-11-22T10:00:00Z)
📊 Total endpoints: 84
```

**If MIN Unavailable:**
```
⚠️ No API reference found in MIN memory. Using fallback mode.
✅ API Reference loaded: vfallback-1.0.0
📊 Total endpoints: 7 (essential endpoints only)
```

---

## 🧪 Testing Guide

### Test 1: Backend Startup Diagnostic

**Steps:**
1. Deploy backend to Render (or restart locally)
2. Check logs for startup diagnostic
3. Look for: `✅ Startup diagnostic: All APIs match reference`

**Expected Result:**
```bash
# In Render logs:
🔍 MIN Startup Diagnostic: Initiating...
📚 Loaded API reference v1.0.0 (updated 2025-11-22T...)
🔍 Found 84 running routes
✅ Startup diagnostic: All APIs match reference
📝 Diagnostic report stored in MIN memory
```

**If No API Reference Exists:**
```bash
⚠️ No API reference found in memory. Creating initial reference...
✅ Created initial API reference in memory
```

---

### Test 2: Frontend API Reference Loading

**Steps:**
1. Deploy frontend to Vercel
2. Open https://vctt-agi-ui.vercel.app
3. Check browser console for API reference logs
4. Look in bottom-right corner for status indicator

**Expected Result:**
```javascript
// Browser console:
🔄 DeepAgent: Fetching API reference from MIN...
✅ API Reference loaded: v1.0.0 (2025-11-22T10:00:00Z)
📊 Total endpoints: 84

// Bottom-right corner UI:
[Green badge with checkmark icon]
API Reference: v1.0.0
```

**If Backend Not Available:**
```javascript
// Browser console:
❌ Failed to load API reference: [error details]
⚠️ Using fallback reference

// Bottom-right corner UI:
[Orange badge with warning icon]
Using fallback API reference
```

---

### Test 3: Endpoint Validation (Manual)

**Using Browser Console:**
```javascript
// After page loads, test in console:
import { apiReferenceService } from './services/api-reference';

// Valid endpoint
apiReferenceService.validateEndpoint('POST', '/api/v1/session/start');
// Returns: { valid: true, message: "Valid endpoint in category: core" }

// Invalid endpoint
apiReferenceService.validateEndpoint('POST', '/api/invalid/endpoint');
// Returns: { valid: false, message: "Endpoint not found: POST /api/invalid/endpoint" }

// Get endpoint details
apiReferenceService.getEndpointInfo('GET', '/api/v1/analytics/sessions');
// Returns: { method: "GET", path: "/api/v1/analytics/sessions", description: "...", ... }
```

---

### Test 4: Daily Review (Simulated)

**Manual Trigger** (requires backend access):
```typescript
// In backend codebase or via admin endpoint:
import { SystemIntegrityService } from './services/system-integrity.service';

// Inject service and call manually:
await systemIntegrityService.runDailyReview();
```

**Check Logs:**
```bash
📊 MIN Daily Review: Starting...
📚 Loaded API reference v1.0.0
📊 Analyzed 127 sessions, 1542 messages
⚠️ Found 12 underused endpoints
✅ Daily review complete: 1 recommendation
📊 Report stored in MIN memory
```

**Check Memory Storage:**
```javascript
// Query MIN's memory for report:
GET /api/memory/retrieve?userId=min_system&type=daily_integrity_report&limit=1

// Response:
{
  "memories": [{
    "content": "{\"timestamp\":\"2025-11-22T02:00:00Z\",\"total_endpoints\":84,\"underused_endpoints\":12,...}"
  }]
}
```

---

## 🔧 Maintenance & Future Enhancements

### Viewing MIN's Diagnostic Reports

**Option 1: Direct Memory Query** (via API):
```bash
curl "https://vctt-agi-backend.onrender.com/api/memory/retrieve?userId=min_system&type=system_diagnostic_report&limit=10"
```

**Option 2: Admin UI** (planned):
- Create `AdminDashboard.tsx` with memory viewer
- Display diagnostic and daily review reports
- Allow manual triggering of diagnostics

### Adding New Endpoints

When creating new endpoints, ensure they're automatically detected:

1. **Backend creates route** → Next restart, startup diagnostic detects it
2. **MIN stores in memory** → Daily review updates reference
3. **Frontend fetches updated reference** → DeepAgent uses latest version

**No manual updates needed!** The system is self-maintaining.

### Forcing Reference Refresh

**Backend:**
```typescript
// Delete old reference to force recreation:
await memoryService.deleteMemories('min_system', 'system_api_reference');

// Restart backend:
// → Startup diagnostic creates new reference from running routes
```

**Frontend:**
```typescript
// Clear cache and reload:
localStorage.clear();
window.location.reload();

// → Fetches fresh reference from MIN
```

---

## 📊 Monitoring & Alerts

### Key Metrics to Track

1. **Startup Diagnostic Success Rate**
   - Log: `Startup diagnostic: All APIs match reference`
   - Alert if: Discrepancies > 5

2. **Daily Review Completion**
   - Log: `Daily review complete: N recommendations`
   - Alert if: Misses 2+ consecutive days

3. **Frontend Reference Load Rate**
   - Console: `API Reference loaded: v1.0.0`
   - Alert if: Fallback mode > 10% of sessions

4. **Endpoint Validation Failures**
   - Log: `Endpoint not found: POST /api/...`
   - Alert if: Failures > 1% of API calls

---

## 🎯 Success Criteria

✅ **Backend (MIN):**
- [ ] Startup diagnostic runs on every restart
- [ ] API reference stored in memory
- [ ] Daily review runs at 2 AM UTC
- [ ] Discrepancies logged to memory
- [ ] Zero manual reference updates

✅ **Frontend (DeepAgent):**
- [ ] API reference loaded on startup
- [ ] Status indicator visible in UI
- [ ] Validation methods available to all components
- [ ] Graceful fallback if MIN unavailable

✅ **Integration:**
- [ ] Frontend fetches from backend memory
- [ ] Reference version matches between backend/frontend
- [ ] New endpoints automatically detected
- [ ] Zero breakages when switching DeepAgent instances

---

## 🚨 Troubleshooting

### Issue: "No API reference found in memory"

**Cause:** First-time deployment or memory cleared

**Solution:**
1. Backend automatically creates initial reference on first startup
2. If persists, manually create via admin endpoint (to be implemented)
3. Frontend uses fallback reference until backend ready

---

### Issue: "Using fallback API reference"

**Cause:** Backend memory endpoint unreachable or MIN not initialized

**Solution:**
1. Check backend health: `GET https://vctt-agi-backend.onrender.com/health`
2. Check memory endpoint: `GET /api/memory/retrieve?userId=min_system&type=system_api_reference`
3. If backend healthy but no reference, restart backend to trigger creation

---

### Issue: "Endpoint not found: POST /api/..."

**Cause:** DeepAgent trying to call endpoint not in reference

**Solution:**
1. Check if endpoint exists in backend
2. If yes: Restart backend to update reference
3. If no: Endpoint may have been removed/renamed (check API docs)

---

## 📚 Related Documentation

- `API_ENDPOINTS_DOCUMENTATION.md` - Complete API reference (986 lines)
- `ENDPOINT_CONNECTION_STATUS.md` - Which endpoints are connected (17/84)
- `ENDPOINT_QUICK_REFERENCE.txt` - Cheat sheet

---

## 👥 Credits

**Designed by:** User (based on breaking changes experience)  
**Implemented by:** DeepAgent (NestJS Backend Specialist)  
**Purpose:** Prevent future breakages when switching AI instances  
**Status:** ✅ Implemented & Ready for Testing

---

**Next Steps:**
1. Deploy backend to Render
2. Deploy frontend to Vercel
3. Monitor logs for startup diagnostic
4. Check UI for API reference status indicator
5. Verify daily review runs at 2 AM UTC

🎉 **MIN is now self-maintaining!**
