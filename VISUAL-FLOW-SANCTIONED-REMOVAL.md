# Automatic Sanctioned Cases Removal - Visual Flow

## 📊 Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    OPERATIONS DASHBOARD                                  │
│                                                                          │
│  ┌──────────────────┐      ┌──────────────────┐                        │
│  │ Sanctioned Cases │      │  Queries Raised  │                        │
│  │                  │      │                  │                        │
│  │  • APP001        │      │  • APP001 Q1 ✓   │                        │
│  │  • APP002        │      │  • APP001 Q2 ✓   │                        │
│  │  • APP003        │      │  • APP002 Q1 ❌  │                        │
│  └──────────────────┘      └──────────────────┘                        │
└─────────────────────────────────────────────────────────────────────────┘

                              ↓ User Resolves Query

┌─────────────────────────────────────────────────────────────────────────┐
│                    BACKEND AUTOMATIC PROCESS                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1️⃣  TRIGGER: Query resolved (approved/deferred/otc/waived)             │
│      └─→ checkAndDeleteFromSanctionedCases(appNo)                       │
│                                                                          │
│  2️⃣  FETCH: Get all queries for Application No.                         │
│      ├─→ Query from MongoDB: queries collection                         │
│      └─→ Filter by appNo                                                │
│                                                                          │
│  3️⃣  VALIDATE: Check status of each query                               │
│      ├─→ Main query group status                                        │
│      └─→ Each individual sub-query status                               │
│                                                                          │
│  4️⃣  DECISION: Are ALL queries resolved?                                │
│      ├─→ YES: Continue to step 5 ✅                                     │
│      └─→ NO: Keep in Sanctioned Cases ❌ STOP                           │
│                                                                          │
│  5️⃣  UPDATE: Mark application as QUERY_RESOLVED                         │
│      ├─→ Update applications collection                                 │
│      └─→ appStatus = "QUERY_RESOLVED"                                   │
│                                                                          │
│  6️⃣  DELETE: Remove from sanctioned_applications                        │
│      ├─→ Delete from sanctioned_applications collection                 │
│      └─→ Record completely removed                                      │
│                                                                          │
│  7️⃣  BROADCAST: Send real-time update                                   │
│      ├─→ SSE (Server-Sent Events)                                       │
│      └─→ status: 'sanctioned_case_removed'                              │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

                              ↓ Real-time Update

┌─────────────────────────────────────────────────────────────────────────┐
│                    OPERATIONS DASHBOARD (UPDATED)                        │
│                                                                          │
│  ┌──────────────────┐      ┌──────────────────┐                        │
│  │ Sanctioned Cases │      │  Queries Raised  │                        │
│  │                  │      │                  │                        │
│  │  • APP002 ✓      │      │  • APP001 Q1 ✅  │                        │
│  │  • APP003        │      │  • APP001 Q2 ✅  │                        │
│  │                  │      │  • APP002 Q1 ❌  │                        │
│  │  [APP001 GONE!]  │      │                  │                        │
│  └──────────────────┘      └──────────────────┘                        │
│                                                                          │
│  🎉 APP001 automatically removed - all queries resolved!                │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 State Transitions for Application with Multiple Queries

```
Application: APP001
├─ Query 1: Status = pending
├─ Query 2: Status = pending  
└─ Query 3: Status = pending
     
     STATUS: ❌ In Sanctioned Cases (Has unresolved queries)

                    ↓ User resolves Query 1

Application: APP001
├─ Query 1: Status = approved ✅
├─ Query 2: Status = pending ❌
└─ Query 3: Status = pending ❌
     
     STATUS: ❌ STILL In Sanctioned Cases (Not all resolved)
     
                    ↓ User resolves Query 2

Application: APP001
├─ Query 1: Status = approved ✅
├─ Query 2: Status = deferred ✅
└─ Query 3: Status = pending ❌
     
     STATUS: ❌ STILL In Sanctioned Cases (1 pending)
     
                    ↓ User resolves Query 3

Application: APP001
├─ Query 1: Status = approved ✅
├─ Query 2: Status = deferred ✅
└─ Query 3: Status = waived ✅
     
     STATUS: ✅ REMOVED from Sanctioned Cases (All resolved!)
     
                    ↓ Automatic Cleanup
                    
🗑️ APP001 deleted from sanctioned_applications
📊 Dashboard automatically refreshed
✨ Application no longer visible in Sanctioned Cases
```

---

## 🎯 Multiple Query Groups Example

```
Application: APP002 (Complex Case)

Query Group A (Main Loan Query)
├─ Status: approved ✅
├─ Sub-query A1: approved ✅
├─ Sub-query A2: approved ✅
└─ Sub-query A3: approved ✅

Query Group B (Documentation Query)
├─ Status: deferred ✅
├─ Sub-query B1: deferred ✅
└─ Sub-query B2: deferred ✅

Query Group C (Verification Query)
├─ Status: otc ✅
└─ No sub-queries

VALIDATION RESULT:
├─ Total Query Groups: 3
├─ Resolved Query Groups: 3 ✅
├─ Total Individual Queries: 6
└─ Resolved Individual Queries: 6 ✅

✅ ALL QUERIES RESOLVED
🗑️ APPLICATION AUTOMATICALLY REMOVED FROM SANCTIONED CASES
```

---

## ⚡ Real-Time Update Flow

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   Backend    │         │  SSE Stream  │         │   Frontend   │
│   (Server)   │         │              │         │  (Browser)   │
└──────┬───────┘         └──────┬───────┘         └──────┬───────┘
       │                        │                        │
       │ Query Resolved         │                        │
       │──────────────────────→ │                        │
       │                        │                        │
       │ Check All Queries      │                        │
       │ for App No.            │                        │
       │────────────►           │                        │
       │                        │                        │
       │ All Resolved: TRUE     │                        │
       │◄────────────           │                        │
       │                        │                        │
       │ Delete from DB         │                        │
       │────────────►           │                        │
       │                        │                        │
       │ Broadcast Update       │                        │
       │──────────────────────→ │                        │
       │                        │                        │
       │                        │ SSE Event:             │
       │                        │ sanctioned_case_removed│
       │                        │──────────────────────→ │
       │                        │                        │
       │                        │                        │ UI Auto-Refresh
       │                        │                        │────────────►
       │                        │                        │
       │                        │                        │ Application
       │                        │                        │ Disappears
       │                        │                        │────────────►
       ▼                        ▼                        ▼
```

---

## 🔍 Database State Changes

### BEFORE Resolution

**applications collection:**
```json
{
  "_id": "...",
  "appId": "APP001",
  "customerName": "John Doe",
  "status": "sanctioned",
  "appStatus": "APPROVED"
}
```

**sanctioned_applications collection:**
```json
{
  "_id": "...",
  "appId": "APP001",
  "customerName": "John Doe",
  "sanctionedAmount": 1000000,
  "status": "active"
}
```

**queries collection:**
```json
[
  {
    "id": 1,
    "appNo": "APP001",
    "status": "pending"  ← Not resolved
  }
]
```

### AFTER All Queries Resolved

**applications collection:**
```json
{
  "_id": "...",
  "appId": "APP001",
  "customerName": "John Doe",
  "status": "sanctioned",
  "appStatus": "QUERY_RESOLVED",  ← Updated
  "updatedBy": "System - Auto Cleanup",
  "remarks": "All queries resolved - automatic removal"
}
```

**sanctioned_applications collection:**
```json
// 🗑️ RECORD DELETED - No longer exists
```

**queries collection:**
```json
[
  {
    "id": 1,
    "appNo": "APP001",
    "status": "approved"  ← Resolved
  }
]
```

---

## 📱 User Experience Timeline

```
Time  Event                          Operations Dashboard View
────  ─────────────────────────────  ────────────────────────────────
00:00 User opens Sanctioned Cases    • APP001 ✓ (visible)
                                     • APP002 ✓
                                     • APP003 ✓

00:30 User clicks "Raise Query"      • Creating query for APP001
      for APP001                     

01:00 Query created                  • Query appears in "Queries Raised"
                                     • APP001 still in Sanctioned Cases

02:00 User goes to "Queries Raised"  • Sees APP001 Query 1 (pending)
      
02:30 User clicks "Approve"          • Query status changing...

03:00 ✅ Query approved               • Query marked as approved
      [TRIGGER: Auto-removal check]  

03:01 Backend checks all queries     [Server processing...]

03:02 ✅ All queries resolved!        [Server validates]

03:03 Delete from sanctioned_apps    [Server deletes record]

03:04 📡 Broadcast SSE update         [Real-time event sent]

03:05 🔄 UI receives update           • APP001 disappears! ✨
      APP001 automatically removed   • APP002 ✓
                                     • APP003 ✓

03:06 User sees updated list          🎉 Automatic removal successful!
```

---

## 🧪 Testing Checklist

### ✅ Test Case 1: Single Query Resolution
- [ ] Create application in Sanctioned Cases
- [ ] Raise 1 query for the application
- [ ] Approve/resolve the query
- [ ] Verify application removed from Sanctioned Cases

### ✅ Test Case 2: Multiple Queries - All Resolved
- [ ] Create application with 3 queries
- [ ] Resolve query 1 (approved) - App still visible
- [ ] Resolve query 2 (deferred) - App still visible
- [ ] Resolve query 3 (waived) - App removed! ✅

### ✅ Test Case 3: Multiple Queries - Partial Resolution
- [ ] Create application with 3 queries
- [ ] Resolve 2 out of 3 queries
- [ ] Verify application REMAINS in Sanctioned Cases

### ✅ Test Case 4: Query with Sub-queries
- [ ] Create query with multiple sub-queries
- [ ] Resolve all sub-queries
- [ ] Verify application removed

### ✅ Test Case 5: Real-time Update
- [ ] Open two browser tabs
- [ ] Resolve query in tab 1
- [ ] Verify tab 2 auto-updates (within 25 seconds)

---

## 🎨 Visual Status Indicators

```
Query Statuses that REMOVE from Sanctioned Cases:
╔════════════╦══════════╦═══════════════════════════╗
║   Status   ║  Icon    ║  Description              ║
╠════════════╬══════════╬═══════════════════════════╣
║ approved   ║    ✅    ║ Query approved            ║
║ deferred   ║    ⏸️    ║ Deferred for later        ║
║ otc        ║    💰    ║ One-time charge applied   ║
║ waived     ║    🎫    ║ Fee/requirement waived    ║
║ resolved   ║    ✔️    ║ Query resolved            ║
╚════════════╩══════════╩═══════════════════════════╝

Query Statuses that KEEP in Sanctioned Cases:
╔════════════╦══════════╦═══════════════════════════╗
║   Status   ║  Icon    ║  Description              ║
╠════════════╬══════════╬═══════════════════════════╣
║ pending    ║    ⏳    ║ Awaiting action           ║
║ rejected   ║    ❌    ║ Query rejected            ║
║ escalated  ║    ⚠️    ║ Escalated to management   ║
╚════════════╩══════════╩═══════════════════════════╝
```

---

## 📋 Summary

This visual guide shows:
- ✅ Feature is **already implemented**
- ✅ Works automatically when all queries resolved
- ✅ Real-time updates to dashboard
- ✅ Safe validation (checks every query)
- ✅ Multiple removal methods (dual collection cleanup)
- ✅ Broadcast notifications for instant UI refresh

**No code changes needed - just use it!** 🚀
