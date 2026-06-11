# FinGuard Admin Web Portal — Project Summary

> **Project**: FinGuard Admin Web Portal  
> **Version**: 0.0.0  
> **Stack**: React 19 + Vite 8 + Firebase (Auth, Firestore, Cloud Functions, Hosting)  
> **Purpose**: Administrator-only web dashboard for managing the FinGuard financial management mobile app  
> **Author Notes**: LNBTI SEM4 — Financial Manager Project  
> **Generated**: 2026-06-08

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      FINGUARD SYSTEM OVERVIEW                          │
│                                                                         │
│  ┌──────────────────┐          ┌────────────────────────────────────┐  │
│  │  Flutter Mobile  │◄────────►│          Firebase Backend          │  │
│  │     App (iOS/   │          │                                    │  │
│  │     Android)    │          │  ┌──────────┐  ┌───────────────┐  │  │
│  └──────────────────┘          │  │  Auth    │  │   Firestore   │  │  │
│                                │  │ (JWT +   │  │   Database    │  │  │
│  ┌──────────────────┐          │  │  Claims) │  │               │  │  │
│  │  React Admin     │◄────────►│  └──────────┘  └───────────────┘  │  │
│  │  Web Portal      │          │                                    │  │
│  │  (This Project)  │          │  ┌──────────────────────────────┐  │  │
│  └──────────────────┘          │  │     Cloud Functions (V1)     │  │  │
│                                │  │  (Admin SDK, HTTPS Callable) │  │  │
│  ┌──────────────────┐          │  └──────────────────────────────┘  │  │
│  │ Firebase Hosting │          │                                    │  │
│  │   (dist/ SPA)    │          │  ┌──────────────────────────────┐  │  │
│  └──────────────────┘          │  │  Firebase Hosting (Static)   │  │  │
│                                │  └──────────────────────────────┘  │  │
│                                └────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Project File Structure

```
financial manager web/
├── .env                         ← All secrets (VITE_* env vars) — NOT committed to Git
├── .firebaserc                  ← Firebase project alias
├── firebase.json                ← Hosting + Firestore config
├── firestore.rules              ← Firestore Security Rules (server-enforced)
├── firestore.indexes.json       ← Firestore composite index definitions
├── create_admin.mjs             ← One-time bootstrap script to create the admin account
├── package.json                 ← NPM dependencies
├── vite.config.js               ← Vite build configuration
├── index.html                   ← HTML entry point
│
├── functions/
│   ├── package.json             ← Functions dependencies (firebase-functions, firebase-admin)
│   └── index.js                 ← ALL Cloud Functions (7 exported functions)
│
└── src/
    ├── main.jsx                 ← React DOM entry point
    ├── App.jsx                  ← Root: AuthProvider, routing, session management
    ├── index.css                ← Global base styles
    ├── App.css                  ← App-level overrides
    │
    ├── theme/
    │   └── theme.js             ← Material UI dark theme tokens
    │
    ├── data/
    │   ├── firebase.js          ← Firebase app initialisation (auth + db exports)
    │   └── userService.js       ← Client-side user CRUD (Spark plan edition)
    │
    ├── security/
    │   ├── authSecurity.js      ← Rate limiting, session management, input sanitisation
    │   └── encryption.js        ← AES-256-GCM field-level encryption (Web Crypto API)
    │
    ├── components/
    │   └── layout/
    │       ├── DashboardLayout.jsx       ← Sidebar nav + AppBar shell
    │       ├── NotificationsPanel.jsx    ← Real-time slide-in notifications drawer
    │       └── SessionTimeoutModal.jsx   ← Idle-session warning modal
    │
    └── pages/
        ├── LoginPage.jsx          ← Admin sign-in form
        ├── DashboardPage.jsx      ← KPI cards + charts + recent transactions
        ├── UsersPage.jsx          ← Full user CRUD table + dialogs
        ├── TransactionsPage.jsx   ← All transactions view + filters
        ├── AnalyticsPage.jsx      ← Charts: Growth, Bar, Radar, Quick Metrics
        ├── SettingsPage.jsx       ← Password change + notification prefs
        └── AboutPage.jsx          ← App info page (public route)
```

---

## 3. Environment Variables (.env)

All configuration is injected via Vite environment variables. **Never commit `.env` to Git.**

```dotenv
# Firebase Web SDK (client-side)
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...

# AES-256-GCM field encryption key (32 bytes, base64-encoded)
# Must match the key used by the Flutter mobile app
VITE_ENCRYPTION_KEY=...
```

---

## 4. Firebase Configuration

### 4.1 Firebase Initialisation (`src/data/firebase.js`)
```
initializeApp(firebaseConfig)
  → auth  = getAuth(app)     ← exported for Auth calls
  → db    = getFirestore(app) ← exported for Firestore calls
```
Fails loudly at startup if any `VITE_FIREBASE_*` variable is missing.

### 4.2 Hosting (`firebase.json`)
- **Public dir**: `dist/` (Vite production build output)
- **SPA rewrite**: all routes → `/index.html` (React Router handles routing)
- **Clean URLs**: enabled (`cleanUrls: true`)
- **Trailing slash**: disabled

### 4.3 Firestore Rules (`firestore.rules`)

| Collection | Mobile App | Admin Web Panel |
|---|---|---|
| `users/{userId}` | Read own doc | Full CRUD (cannot set role=admin) |
| `transactions/{txnId}` | Create only | Full read/update/delete |
| `notifications/{docId}` | Create only | Full read/update/delete |
| `monthlyRevenue` | ❌ | Full read/write |
| `userDistribution` | ❌ | Full read/write |
| `categorySpending` | ❌ | Full read/write |
| `activityLog` | ❌ | Full read/write |
| `userGrowth` | ❌ | Full read/write |
| `quickMetrics` | ❌ | Full read/write |
| `**` (all else) | ❌ | ❌ |

**Admin verification**: Rules call `isAdmin()` which does a **server-side Firestore read** of the caller's own `users/{uid}` document to check `role == 'admin'`. This is the security gate for every write on the Spark free plan (no Custom Claims admin endpoint).

---

## 5. Firestore Collections (Data Schema)

### `users`
```json
{
  "uid":          "string",
  "email":        "string",
  "name":         "string",
  "phone":        "string",
  "role":         "admin | student | business_owner | company_owner | multi_account",
  "plan":         "Free | Premium | ...",
  "status":       "active | inactive | suspended | deactivated | deleted",
  "balance":      "number (may be AES-encrypted string)",
  "transactions": "number",
  "joined":       "YYYY-MM-DD",
  "createdAt":    "Firestore Timestamp",
  "createdBy":    "string (admin UID)",
  "updatedAt":    "Firestore Timestamp",
  "deactivatedAt":"Firestore Timestamp",
  "deletedAt":    "Firestore Timestamp"
}
```

### `transactions`
```json
{
  "user":     "string (display name)",
  "email":    "string",
  "category": "string",
  "amount":   "number (may be AES-encrypted string)",
  "date":     "YYYY-MM-DD",
  "status":   "completed | pending | failed",
  "avatar":   "string (first letter of name)"
}
```

### `notifications`
```json
{
  "title":     "string",
  "body":      "string",
  "type":      "user | alert | system | report",
  "read":      "boolean",
  "uid":       "string (optional, for user events)",
  "email":     "string (optional)",
  "txnId":     "string (optional, for transaction events)",
  "amount":    "number (optional)",
  "createdAt": "Firestore Timestamp"
}
```

### Analytics Collections (admin-managed)
| Collection | Key Fields |
|---|---|
| `monthlyRevenue` | `month`, `income`, `expense` |
| `userDistribution` | `name` (plan name), `value` (%) |
| `categorySpending` | `category`, `amount`, `percentage` |
| `activityLog` | `message`, `time`, `color` |
| `userGrowth` | `month`, `users`, `sessions` |
| `quickMetrics` | `label`, `value`, `change`, `up` |

---

## 6. Cloud Functions (`functions/index.js`)

All functions use **Firebase Functions V1** (compatible with Spark free plan).

### 6.1 Auth Trigger: `onNewUserRegistered`
**Trigger**: `functions.auth.user().onCreate`  
**Fires when**: Any new Firebase Auth account is created (mobile app self-registration)

**Pipeline**:
```
Mobile App: createUserWithEmailAndPassword()
    ↓
Firebase Auth creates account
    ↓
[TRIGGER FIRES] onNewUserRegistered(user)
    ↓
db.collection('users').doc(uid).set({
    uid, email, name, photoURL,
    plan: 'Free', status: 'active',
    role: 'student',    ← default for self-registered
    balance: 0, transactions: 0,
    joined, createdAt
}, { merge: true })
    ↓
db.collection('notifications').add({
    title: 'New user registered',
    body: '<name> just created an account.',
    type: 'user', read: false, uid, email, createdAt
})
```

---

### 6.2 Firestore Trigger: `onNewTransaction`
**Trigger**: `functions.firestore.document('transactions/{txnId}').onCreate`  
**Fires when**: Any new document is written to the `transactions` collection (mobile app)

**Pipeline**:
```
Mobile App: adds doc to transactions/{txnId}
    ↓
[TRIGGER FIRES] onNewTransaction(snap, context)
    ↓
Read: amount, userName, currency
    ↓
IF amount >= Rs. 5,000:
    db.collection('notifications').add({
        title: '⚠️ Large transaction flagged',
        body: '<user> made a <amount> transaction — please review.',
        type: 'alert', read: false, txnId, amount, createdAt
    })
ELSE:
    db.collection('notifications').add({
        title: 'New transaction recorded',
        body: '<user> recorded a <amount> transaction (<category>).',
        type: 'system', read: false, txnId, amount, createdAt
    })
```

---

### 6.3 Auth Trigger: `onUserDeleted`
**Trigger**: `functions.auth.user().onDelete`  
**Fires when**: A Firebase Auth account is hard-deleted

**Pipeline**:
```
Admin SDK / hard deletion event
    ↓
[TRIGGER FIRES] onUserDeleted(user)
    ↓
db.collection('users').doc(uid).set(
    { status: 'deleted', deletedAt: serverTimestamp() },
    { merge: true }
)
    ↓
db.collection('notifications').add({
    title: 'User account deleted',
    body: '<name> deleted their account.',
    type: 'alert', read: false, uid, email, createdAt
})
```

---

### 6.4 Callable: `createAdminNotification`
**Trigger**: `functions.https.onCall`  
**Caller**: Admin web panel (authenticated)

**Request payload**:
```json
{ "title": "string", "body": "string", "type": "system | user | alert | report" }
```

**Security check**: Caller must be authenticated AND their `users/{uid}` Firestore doc must have `role == 'admin'`.

**Pipeline**:
```
Admin Panel → Firebase SDK httpsCallable('createAdminNotification')
    ↓
[FUNCTION] verifyAdmin via Firestore doc read
    ↓
Validate: title + body required
    ↓
db.collection('notifications').add({ title, body, type, read: false, createdAt })
    ↓
return { success: true }
```

---

### 6.5 Callable: `adminCreateUser`
**Trigger**: `functions.https.onCall`  
**Caller**: Admin web panel (requires admin JWT Custom Claim)

**Request payload**:
```json
{
  "email":       "string",
  "password":    "string (min 8 chars)",
  "displayName": "string",
  "role":        "student | business_owner | company_owner | multi_account",
  "phone":       "string (optional)"
}
```

**Security checks**:
- Caller must hold `role: 'admin'` JWT Custom Claim (`context.auth.token.role`)
- `role` must NOT be `'admin'` (cannot promote via web panel)
- `role` must be in `VALID_ROLES`
- Password must be ≥ 8 characters

**Pipeline**:
```
Admin Panel → httpsCallable('adminCreateUser')({ email, password, displayName, role, phone })
    ↓
[FUNCTION] verifyAdmin(context) — checks JWT Custom Claim
    ↓
Validate inputs
    ↓
admin.auth().createUser({ email, password, displayName })
    → Returns: { uid }
    ↓
admin.auth().setCustomUserClaims(newUser.uid, { role })
    ↓
db.collection('users').doc(newUser.uid).set({
    uid, email, name, phone, role,
    plan: 'Free', status: 'active',
    balance: 0, transactions: 0,
    joined, createdAt, createdBy: callerUID
})
    ↓
db.collection('notifications').add({
    title: 'Admin created new user',
    body: 'Admin created account for <name> (<email>) with role <role>.',
    type: 'user', read: false, uid, email, createdAt
})
    ↓
return { success: true, uid: newUser.uid }
```

**Errors handled**:
- `auth/email-already-exists` → `already-exists` HttpsError
- Any other error → `internal` HttpsError

---

### 6.6 Callable: `adminUpdateUser`
**Trigger**: `functions.https.onCall`  
**Caller**: Admin web panel (requires admin JWT Custom Claim)

**Request payload**:
```json
{
  "uid":         "string (required)",
  "displayName": "string (optional)",
  "email":       "string (optional)",
  "role":        "student | business_owner | company_owner | multi_account (optional)",
  "status":      "active | inactive | suspended (optional)",
  "phone":       "string (optional)"
}
```

**Security checks**:
- Caller must hold `role: 'admin'` JWT Custom Claim
- `role` must NOT be `'admin'`
- `status` must be one of `['active', 'inactive', 'suspended']`

**Pipeline**:
```
Admin Panel → httpsCallable('adminUpdateUser')({ uid, ...fields })
    ↓
[FUNCTION] verifyAdmin(context)
    ↓
Validate: uid required, role/status values checked
    ↓
IF displayName OR email changed:
    admin.auth().updateUser(uid, { displayName?, email? })
    ↓
IF role changed:
    admin.auth().setCustomUserClaims(uid, { role })
    ↓
db.collection('users').doc(uid).update({
    name?, email?, role?, status?, phone?,
    updatedAt: serverTimestamp()
})
    ↓
return { success: true }
```

**Errors handled**:
- `auth/user-not-found` → `not-found` HttpsError
- `auth/email-already-exists` → `already-exists` HttpsError

---

### 6.7 Callable: `adminDeleteUser`
**Trigger**: `functions.https.onCall`  
**Caller**: Admin web panel (requires admin JWT Custom Claim)

**Request payload**:
```json
{ "uid": "string" }
```

**Security checks**:
- Caller must hold `role: 'admin'` JWT Custom Claim
- `uid` must NOT equal caller's own UID (cannot self-delete)
- Target user's Custom Claim must NOT be `role: 'admin'` (cannot delete other admins)

**Pipeline**:
```
Admin Panel → httpsCallable('adminDeleteUser')({ uid })
    ↓
[FUNCTION] verifyAdmin(context)
    ↓
Guard: uid !== context.auth.uid
    ↓
admin.auth().getUser(uid)
    → Check: customClaims.role !== 'admin'
    ↓
admin.auth().deleteUser(uid)    ← Hard Auth deletion
    ↓
db.collection('users').doc(uid).delete()  ← Firestore document deletion
    ↓
[onUserDeleted trigger fires automatically]
    ↓
return { success: true }
```

**Errors handled**:
- `auth/user-not-found` → `not-found` HttpsError

---

## 7. Client-Side API Calls (Firestore SDK)

All client-side calls use the **Firebase Web SDK v12** (modular API).

### 7.1 Authentication Layer (`src/App.jsx`)

| Call | SDK | Purpose |
|---|---|---|
| `onAuthStateChanged(auth, cb)` | `firebase/auth` | Listen to login/logout state changes |
| `signOut(auth)` | `firebase/auth` | Sign admin out |
| `getDoc(doc(db,'users', uid))` | `firebase/firestore` | Verify user has `role: 'admin'` in Firestore |

### 7.2 Login Page (`src/pages/LoginPage.jsx`)

| Call | SDK | Purpose |
|---|---|---|
| `signInWithEmailAndPassword(auth, email, password)` | `firebase/auth` | Authenticate admin |

**Client-side security before the call**:
1. `sanitiseInput(email)` — strip XSS chars, null bytes
2. `validateEmail(email)` — RFC-5321 format check
3. `validatePassword(password)` — length check
4. `checkLockout()` — brute-force check (5 attempts → 15 min lock)
5. On failure: `recordFailedAttempt()` → increments attempt counter
6. On success: `clearLockout()` + `startSession()`

### 7.3 Dashboard Page (`src/pages/DashboardPage.jsx`)

| Call | Collection | Query | Purpose |
|---|---|---|---|
| `getDocs(collection(db,'users'))` | `users` | No filter | Count total users |
| `getDocs(collection(db,'transactions'))` | `transactions` | No filter | Count total transactions |
| `getDocs(query(..., orderBy('date','desc'), limit(8)))` | `transactions` | Latest 8 | Recent transactions table |
| `getDocs(query(..., orderBy('timestamp','desc'), limit(6)))` | `activityLog` | Latest 6 | System activity feed |
| `getDocs(collection(db,'monthlyRevenue'))` | `monthlyRevenue` | All docs | Revenue area chart |
| `getDocs(collection(db,'userDistribution'))` | `userDistribution` | All docs | User plan pie chart |
| `getDocs(collection(db,'categorySpending'))` | `categorySpending` | All docs | Category spending bars |

All calls fire in parallel on page load and on each manual refresh.

### 7.4 Users Page (`src/pages/UsersPage.jsx`)

| Call | Type | Purpose |
|---|---|---|
| `onSnapshot(collection(db,'users'), cb)` | **Real-time listener** | Live user table (updates instantly when Firestore changes) |
| `createUser({ email, password, displayName, role, phone })` | Client SDK | Create new user (see §7.4.1 below) |
| `updateUser({ uid, ...fields })` | `updateDoc(doc(db,'users',uid), update)` | Update Firestore profile |
| `deleteUser(uid)` | `updateDoc(doc(db,'users',uid), { status:'deactivated' })` | Soft-delete |

#### 7.4.1 Client-Side User Creation Flow (`src/data/userService.js`)

Since the project runs on the Firebase **Spark (free) plan**, Cloud Functions requiring Admin SDK for user creation are used when available, otherwise a secondary app approach is used:

```
Admin initiates "Create User"
    ↓
Validate locally (email, password ≥ 8 chars, displayName)
    ↓
initializeApp(firebaseConfig, 'secondary-user-creation')
    ↓  (named secondary app instance — does not disturb admin session)
createUserWithEmailAndPassword(secondaryAuth, email, password)
    → Returns credential.user.uid
    ↓
secondaryAuth.signOut()
    ↓
deleteApp(secondaryApp)  ← cleanup
    ↓
setDoc(doc(db, 'users', newUid), {
    uid, email, name, phone, role, plan:'Free',
    status:'active', balance:0, transactions:0,
    joined, createdAt, createdBy: auth.currentUser.uid
})
    ↓
[onNewUserRegistered trigger fires] → writes notification
```

> **Note**: When Cloud Functions are deployed, `adminCreateUser` callable is the preferred path and also sets JWT Custom Claims.

### 7.5 Transactions Page (`src/pages/TransactionsPage.jsx`)

| Call | Collection | Query |
|---|---|---|
| `getDocs(query(collection(db,'transactions'), orderBy('date','desc')))` | `transactions` | All, ordered by date desc |

Client-side filtering: `search` (user/category text) + `filter` (All/Completed/Pending/Failed).

### 7.6 Analytics Page (`src/pages/AnalyticsPage.jsx`)

| Call | Collection | Query |
|---|---|---|
| `getDocs(collection(db,'monthlyRevenue'))` | `monthlyRevenue` | All docs |
| `getDocs(collection(db,'categorySpending'))` | `categorySpending` | All docs |
| `getDocs(query(..., orderBy('month','asc'), limit(12)))` | `userGrowth` | Ordered, latest 12 months |
| `getDocs(collection(db,'quickMetrics'))` | `quickMetrics` | All docs |

### 7.7 Settings Page (`src/pages/SettingsPage.jsx`)

| Call | SDK | Purpose |
|---|---|---|
| `reauthenticateWithCredential(auth.currentUser, credential)` | `firebase/auth` | Re-authenticate before password change |
| `updatePassword(auth.currentUser, newPassword)` | `firebase/auth` | Change admin password |
| `EmailAuthProvider.credential(email, currentPassword)` | `firebase/auth` | Build credential for re-auth |

### 7.8 Notifications Panel (`src/components/layout/NotificationsPanel.jsx`)

| Call | Type | Purpose |
|---|---|---|
| `onSnapshot(query(collection(db,'notifications'), orderBy('createdAt','desc')), cb)` | **Real-time listener** | Live notification feed |
| `updateDoc(doc(db,'notifications', id), { read: true })` | One-shot write | Mark single notification as read |
| `writeBatch(db)` + `batch.update(...)` × N + `batch.commit()` | Batch write | Mark ALL unread notifications as read atomically |

---

## 8. Security Architecture

### 8.1 Authentication Security (`src/security/authSecurity.js`)

| Feature | Implementation |
|---|---|
| **Input Sanitisation** | `sanitiseInput()` — strips null bytes, C0/C1 control chars, HTML tags (`<>"'\``) |
| **Email Validation** | RFC-5321 regex, max 320 chars |
| **Password Validation** | Min 6 chars (login), min 8 chars (creation) |
| **Brute-Force Protection** | Max 5 failed attempts → 15-minute lockout (stored in `localStorage`) |
| **Idle Session Timeout** | 30-minute inactivity → warning modal → 2-minute grace → forced logout |
| **Absolute Session Cap** | 8-hour maximum session regardless of activity |
| **Activity Tracking** | Mouse, keyboard, touch, scroll events refresh idle timer via `touchSession()` |
| **Session Polling** | Every 60 seconds: `isSessionValid()` checks both idle and absolute expiry |

### 8.2 Field-Level Encryption (`src/security/encryption.js`)

| Property | Value |
|---|---|
| **Algorithm** | AES-256-GCM |
| **Key source** | `VITE_ENCRYPTION_KEY` (32-byte, base64-encoded) |
| **IV** | 12-byte random, generated fresh per encryption call |
| **Storage format** | `"<base64-iv>:<base64-ciphertext>"` in Firestore |
| **API used** | Browser Web Crypto API (`window.crypto.subtle`) — no dependencies |
| **Key extractability** | `false` — CryptoKey cannot be exported from the browser |

**Encrypted fields** (`USER_SENSITIVE_FIELDS`):
- `salary`, `loanAmount`, `loanBalance`, `income`, `expenses`, `netWorth`, `balance`, `accountNumber`, `cardNumber`

**Encrypted transaction fields** (`TRANSACTION_SENSITIVE_FIELDS`):
- `amount`, `description`

**Flutter mobile app compatibility**: must use the same 32-byte key, AES-GCM 256-bit, 12-byte IV, same storage format.

### 8.3 Role & Access Control

```
Web Panel Access:
  ┌─────────────────────┐
  │  User logs in with  │
  │  email + password   │
  └──────────┬──────────┘
             ↓
  onAuthStateChanged fires
             ↓
  getDoc('users/{uid}') — check role field
             ↓
    role === 'admin'?
     YES ──────────► Allow access, startSession()
     NO  ──────────► signOut() immediately, redirect to /login
```

**Route protection**: `<ProtectedRoute>` in `App.jsx` checks `user.role === 'admin'` for all dashboard routes.  
**Cloud Functions**: `verifyAdmin(context)` checks `context.auth.token.role === 'admin'` (JWT Custom Claim).  
**Firestore Rules**: `isAdmin()` function reads Firestore document server-side for every write.

---

## 9. Application Routing

```
/ ──────────────────── Redirects to /dashboard
/login ─────────────── LoginPage (public)
/about ─────────────── AboutPage (public)
/dashboard ─────────── DashboardPage (protected: admin only)
/users ─────────────── UsersPage (protected: admin only)
/transactions ──────── TransactionsPage (protected: admin only)
/analytics ─────────── AnalyticsPage (protected: admin only)
/settings ──────────── SettingsPage (protected: admin only)
/* ─────────────────── Catch-all → /login
```

All protected routes live under `<DashboardLayout>` which renders the sidebar, AppBar, and `<Outlet>`.

---

## 10. UI Component Hierarchy

```
App.jsx
└── ThemeProvider (MUI dark theme)
    └── AuthProvider (AuthContext: user, logout, loading)
        └── BrowserRouter
            └── NavigateBridge (injects navigate into AuthContext ref)
            └── Routes
                ├── /login        → LoginPage
                ├── /about        → AboutPage
                └── / (ProtectedRoute)
                    └── DashboardLayout
                        ├── Drawer (260px sidebar)
                        │   ├── Brand logo + name
                        │   ├── Nav: Dashboard, Users, Transactions, Analytics
                        │   ├── Nav: Settings, About App
                        │   └── Admin profile + logout button
                        ├── AppBar (sticky)
                        │   ├── NotificationsPanel (bell icon + slide-in drawer)
                        │   └── Admin avatar
                        └── <main> → <Outlet>
                            ├── /dashboard    → DashboardPage
                            ├── /users        → UsersPage
                            ├── /transactions → TransactionsPage
                            ├── /analytics    → AnalyticsPage
                            └── /settings     → SettingsPage
            └── SessionTimeoutModal (shown when idle)
```

---

## 11. Technology Stack & Dependencies

### Production Dependencies

| Package | Version | Purpose |
|---|---|---|
| `react` | ^19.2.6 | UI framework |
| `react-dom` | ^19.2.6 | React DOM renderer |
| `react-router-dom` | ^7.17.0 | Client-side routing |
| `firebase` | ^12.14.0 | Firebase Web SDK (Auth, Firestore) |
| `@mui/material` | ^9.0.1 | Material UI component library |
| `@mui/icons-material` | ^9.0.1 | MUI icon set |
| `@mui/x-charts` | ^9.4.0 | MUI chart components |
| `@emotion/react` | ^11.14.0 | CSS-in-JS runtime for MUI |
| `@emotion/styled` | ^11.14.1 | Styled component support for MUI |
| `recharts` | ^3.8.1 | SVG chart library (AreaChart, BarChart, PieChart, LineChart, RadarChart) |

### Cloud Functions Dependencies (`functions/package.json`)
- `firebase-functions` — V1 function triggers & HTTPS callables
- `firebase-admin` — Admin SDK for Auth user management and Firestore writes

### Dev Dependencies
| Package | Purpose |
|---|---|
| `vite` ^8.0.12 | Build tool + dev server |
| `@vitejs/plugin-react` | React JSX transform |
| `eslint` ^10.3.0 | Linting |

---

## 12. Build & Deployment Pipeline

### Development
```bash
npm run dev          # Starts Vite dev server (HMR)
```

### Production Build
```bash
npm run build        # Vite builds → dist/
                     # All VITE_* env vars baked in at build time
```

### Deploying to Firebase Hosting
```bash
npx firebase-tools deploy --only hosting
# → Uploads dist/ to Firebase CDN
# → SPA rewrite rule ensures /index.html serves all routes
```

### Deploying Cloud Functions
```bash
cd functions
npx firebase-tools deploy --only functions
# Deploys all 7 exported functions
# NOTE: Requires Blaze (pay-as-you-go) plan for outbound requests
```

### Admin Account Bootstrap
```bash
node create_admin.mjs
# → Uses Admin SDK to create admin Firebase Auth account
# → Sets Custom JWT Claim: { role: 'admin' }
# → Writes Firestore profile with role: 'admin'
# → Must be run ONCE before the web panel can be used
```

### Full Deploy Order (first time)
```
1. node create_admin.mjs          ← Create admin account
2. npx firebase-tools deploy --only firestore:rules   ← Security rules
3. cd functions && npx firebase-tools deploy --only functions  ← Cloud Functions
4. npm run build && npx firebase-tools deploy --only hosting   ← Web app
```

---

## 13. User Roles Reference

| Role Value | Display Label | Created By | Notes |
|---|---|---|---|
| `admin` | Admin 🔴 | Bootstrap script only | Cannot be set from web panel |
| `student` | Student 🔵 | Mobile app registration (default) or admin | |
| `business_owner` | Business Owner 🟡 | Admin only | |
| `company_owner` | Company Owner 🟣 | Admin only | |
| `multi_account` | Multi Account Holder 🟠 | Admin only | |

**User Statuses**: `active` (default) → `inactive` → `suspended` → `deactivated` → `deleted`

---

## 14. Notification System

Notifications are automatically created by Cloud Functions and appear in the admin's real-time slide-in drawer.

| Event | Notification Type | Triggered By |
|---|---|---|
| New mobile user registered | `user` | `onNewUserRegistered` Cloud Function |
| New transaction (< Rs. 5,000) | `system` | `onNewTransaction` Cloud Function |
| Large transaction (≥ Rs. 5,000) | `alert` | `onNewTransaction` Cloud Function |
| User account deleted (hard) | `alert` | `onUserDeleted` Cloud Function |
| Admin created a user | `user` | `adminCreateUser` Cloud Function |
| Manual admin notification | `system/user/alert/report` | `createAdminNotification` Callable |

**Read state**: Updated via individual `updateDoc` or batch `writeBatch` operations.

---

## 15. Dashboard Charts & Data Sources

| Chart | Component | Firestore Collection | Fields Used |
|---|---|---|---|
| Monthly Revenue (Area) | `AreaChart` (Recharts) | `monthlyRevenue` | `month`, `income`, `expense` |
| User Distribution (Donut) | `PieChart` (Recharts) | `userDistribution` | `name`, `value` (%) |
| Spending by Category (Progress bars) | `LinearProgress` (MUI) | `categorySpending` | `category`, `amount`, `percentage` |
| User Growth (Line) | `LineChart` (Recharts) | `userGrowth` | `month`, `users`, `sessions` |
| Income vs Expense (Bar) | `BarChart` (Recharts) | `monthlyRevenue` | `month`, `income`, `expense` |
| Spending Pattern (Radar) | `RadarChart` (Recharts) | `categorySpending` | `category`, `percentage` |
| Quick Metrics (List) | Custom MUI | `quickMetrics` | `label`, `value`, `change`, `up` |

---

*This document is the canonical technical reference for the FinGuard Admin Web Portal.*  
*Last updated: 2026-06-08 by Antigravity AI Coding Assistant.*
