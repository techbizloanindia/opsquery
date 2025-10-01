# Automatic Removal from Sanctioned Cases - Feature Documentation

## ✅ Feature Status: **ALREADY IMPLEMENTED**

Your system **already has** the functionality to automatically remove Application Numbers from Sanctioned Cases when all their queries are resolved.

---

## 🎯 How It Works

### When Does Removal Happen?

The application is automatically removed from Sanctioned Cases when:

1. **All queries** associated with an Application No. are resolved
2. A query is marked with any of these statuses:
   - ✅ `approved`
   - ⏸️ `deferred`
   - 💰 `otc` (One Time Charge)
   - 🎫 `waived`
   - ✔️ `resolved`

---

## 🔄 Automatic Process Flow

```
Query Resolved → Check All Queries for App No. → All Resolved? → Remove from Sanctioned Cases
     ↓                      ↓                           ↓
  Status:           Fetch all queries          Yes: Delete Application
  approved,         for Application No.         No: Keep in Sanctioned
  deferred,                                     
  otc, waived      Check each query status
```

---

## 📍 Implementation Locations

### 1. **Query Actions API** (`/api/query-actions/route.ts`)
```typescript
// Lines 554-590
if (['approve', 'deferral', 'otc', 'waiver'].includes(action) && successData.data?.appNo) {
  const wasDeleted = await checkAndDeleteFromSanctionedCases(successData.data.appNo);
  
  if (wasDeleted) {
    // Broadcasts real-time update to refresh Operations Dashboard
    broadcastQueryUpdate({
      status: 'sanctioned_case_removed',
      action: 'sanctioned_case_removed'
    });
  }
}
```

### 2. **Queries API** (`/api/queries/route.ts`)
```typescript
// Lines 1463-1465
if (['approved', 'deferred', 'otc', 'waived', 'resolved'].includes(updateData.status)) {
  await checkAndDeleteFromSanctionedCases(foundQuery.appNo);
}
```

---

## 🔍 Validation Logic

The `checkAndDeleteFromSanctionedCases()` function:

1. **Fetches all queries** for the specific Application No.
2. **Validates each query group** status
3. **Validates each individual query** within groups
4. **Only removes** if 100% of queries are resolved
5. **Updates/Deletes** from both collections:
   - Sets status to `QUERY_RESOLVED` in `applications` collection
   - Deletes from `sanctioned_applications` collection
6. **Broadcasts** real-time update to UI

---

## 📊 Example Scenarios

### Scenario 1: Single Query - Resolved ✅
```
Application: APP001
├─ Query 1: Status = "approved"
└─ Result: APP001 removed from Sanctioned Cases
```

### Scenario 2: Multiple Queries - All Resolved ✅
```
Application: APP002
├─ Query 1: Status = "approved"
├─ Query 2: Status = "deferred"
├─ Query 3: Status = "waived"
└─ Result: APP002 removed from Sanctioned Cases
```

### Scenario 3: Multiple Queries - Not All Resolved ❌
```
Application: APP003
├─ Query 1: Status = "approved"
├─ Query 2: Status = "pending"  ← Still pending
├─ Query 3: Status = "deferred"
└─ Result: APP003 KEPT in Sanctioned Cases
```

### Scenario 4: Query with Sub-queries - All Resolved ✅
```
Application: APP004
├─ Query Group 1: Status = "approved"
│  ├─ Sub-query 1.1: Status = "approved"
│  ├─ Sub-query 1.2: Status = "approved"
│  └─ Sub-query 1.3: Status = "approved"
└─ Result: APP004 removed from Sanctioned Cases
```

---

## 🎬 Real-Time Updates

When an application is removed:
1. **Backend** deletes the record
2. **Broadcasts** via Server-Sent Events (SSE)
3. **Operations Dashboard** auto-refreshes
4. **Sanctioned Cases** list updates instantly
5. **Dashboard stats** recalculate automatically

---

## 🧪 How to Test

### Test Case 1: Approve All Queries for One Application

1. Go to **Operations Dashboard** → **Sanctioned Cases**
2. Select an application (e.g., APP123)
3. Click "Raise Query" if no queries exist
4. Go to **Queries Raised** tab
5. Approve/resolve ALL queries for APP123
6. **Expected Result**: APP123 disappears from Sanctioned Cases

### Test Case 2: Multiple Applications with Mixed Status

1. Create queries for 3 different applications
2. Resolve ALL queries for APP456
3. Leave some queries pending for APP789
4. **Expected Result**: 
   - APP456 removed from Sanctioned Cases
   - APP789 remains in Sanctioned Cases

---

## 🔧 Console Logs to Monitor

When the feature runs, you'll see these console logs:

```javascript
// Starting check
🔍 SINGLE APPLICATION CHECK: Verifying if all queries for application APP001 are resolved...

// Per query validation
📋 Checking query group 123 with status: approved
✅ Individual query Q1 resolved (approved)
✅ Individual query Q2 resolved (deferred)

// Summary
📈 Query Resolution Summary for APP001:
   Total individual queries: 2
   Resolved individual queries: 2
   All queries resolved: true

// Deletion
🎯 SINGLE APPLICATION DELETION: All queries for APP001 are resolved...
✅ Successfully updated application APP001 status to QUERY_RESOLVED
✅ Successfully deleted application APP001 from sanctioned_applications collection
🎉 SINGLE APPLICATION SUCCESSFULLY REMOVED

// Broadcasting
📡 SUCCESS: Broadcasted single application removal for: APP001
```

---

## ⚙️ Configuration

### Resolved Statuses (Can be modified in code)
```typescript
const resolvedStatuses = ['approved', 'deferred', 'otc', 'waived', 'resolved'];
```

If you want to add/remove statuses that trigger removal, modify this array in:
- `src/app/api/query-actions/route.ts` (line ~119)
- `src/app/api/queries/route.ts` (line ~174)

---

## 🐛 Troubleshooting

### Application Not Removed After Resolving All Queries

**Check:**
1. ✅ Are ALL queries actually in resolved status?
2. ✅ Check browser console for error messages
3. ✅ Check server logs for deletion confirmation
4. ✅ Try manual refresh (the UI auto-refreshes every 25 seconds)

**Debug Command:**
```javascript
// Check query statuses in browser console
fetch('/api/queries?appNo=APP001')
  .then(r => r.json())
  .then(data => console.log('Queries:', data.data))
```

### Still Seeing Old Applications

**Solutions:**
1. **Hard Refresh**: Ctrl+F5 or Cmd+Shift+R
2. **Check Database**: Verify record was deleted
3. **Auto-refresh**: Wait up to 25 seconds for auto-refresh
4. **Manual Trigger**: Click the refresh button in Sanctioned Cases

---

## 📝 Database Collections Affected

### 1. `applications` Collection
```javascript
// Status updated to exclude from sanctioned filter
{
  appId: "APP001",
  appStatus: "QUERY_RESOLVED", // ← Marks as resolved
  updatedBy: "System - Auto Cleanup",
  remarks: "All 3 queries resolved - automatic removal from sanctioned cases"
}
```

### 2. `sanctioned_applications` Collection
```javascript
// Record completely deleted
// No longer appears in Sanctioned Cases view
```

---

## 🚀 Benefits

✅ **Automatic cleanup** - No manual intervention needed
✅ **Real-time updates** - Instant UI refresh
✅ **Precise validation** - Checks every query and sub-query
✅ **Safe operation** - Only removes when 100% resolved
✅ **Audit trail** - All actions logged in console
✅ **Multi-collection sync** - Updates both databases

---

## 📞 Need Changes?

If you want to modify this behavior:

1. **Change trigger statuses**: Modify `resolvedStatuses` array
2. **Add conditions**: Edit `checkAndDeleteFromSanctionedCases()` function
3. **Disable auto-removal**: Comment out the function calls
4. **Add manual approval**: Add a confirmation step before deletion

---

## ✨ Summary

Your feature request is **already implemented and working**! The system automatically removes Application Numbers from Sanctioned Cases when all associated queries are resolved. The removal happens instantly with real-time UI updates.

**No additional code changes are needed.**

Just test it by resolving all queries for an application and watch it automatically disappear from the Sanctioned Cases list!

---

**Last Updated**: October 1, 2025
**Status**: ✅ Production Ready
**Version**: 2.0.0
