# FinGuard Admin Portal — gemini.md

> A complete technical reference for the FinGuard Admin Dashboard project.  
> Use this file to quickly understand the codebase, architecture, security model, and conventions before making changes.

---

## 1. Project Overview

**FinGuard Admin Portal** is a **React 19 + Vite 8** single-page admin dashboard that connects to **Firebase** (Authentication + Cloud Firestore) to manage the FinGuard mobile app's users, transactions, and real-time analytics.

- **Purpose**: Admin-only web panel for monitoring and managing a financial manager mobile app.
- **Auth model**: Firebase Auth + Firestore role-based access (`role: "admin"` field gates all protected routes).
- **Deployment**: Firebase Hosting (deployed from the `/dist` build output).

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Core framework | React 19, React Router 7 |
| Bundler | Vite 8 |
| UI library | Material UI (MUI) v9 |
| Charts | Recharts 3, MUI X-Charts 9 |
| Backend/Auth | Firebase JS SDK v12 (Auth + Firestore) |
| Cloud Functions | Firebase Functions V1 (Node.js, Spark plan compatible) |
| Styling | MUI ThemeProvider + custom dark glassmorphism theme |
| Field Encryption | Browser Web Crypto API (AES-256-GCM) |

---

## 3. Directory Structure

```
financial manager web/
├── src/
│   ├── main.jsx                    # React entry point
│   ├── App.jsx                     # Root: AuthProvider, routes, ProtectedRoute
│   ├── App.css                     # Global overrides
│   ├── index.css                   # Base reset / fonts
│   │
│   ├── theme/
│   │   └── theme.js                # MUI dark theme — single source of truth for design tokens
│   │
│   ├── data/
│   │   ├── firebase.js             # Firebase app init, exports: auth, db
│   │   └── userService.js          # CRUD helpers: createUser, updateUser, deleteUser
│   │
│   ├── security/
│   │   ├── authSecurity.js         # Input sanitisation, brute-force protection, session management
│   │   └── encryption.js           # AES-256-GCM field-level encryption via Web Crypto API
│   │
│   ├── components/
│   │   └── layout/
│   │       ├── DashboardLayout.jsx     # Sidebar + AppBar shell; wraps all protected pages
│   │       ├── NotificationsPanel.jsx  # Slide-in drawer reading Firestore notifications
│   │       └── SessionTimeoutModal.jsx # Idle-timeout warning modal with 2-min countdown
│   │
│   └── pages/
│       ├── LoginPage.jsx           # Auth form with rate-limiting, lockout, sanitisation
│       ├── DashboardPage.jsx       # KPI stat cards + revenue area chart + recent transactions
│       ├── UsersPage.jsx           # Full user CRUD: list, create, edit, suspend, delete
│       ├── TransactionsPage.jsx    # Read-only transaction log with search/filter
│       ├── AnalyticsPage.jsx       # Bar, Area, Radar charts from live Firestore data
│       ├── SettingsPage.jsx        # Admin password change (re-auth required)
│       └── AboutPage.jsx           # Public about/info page (unprotected route)
│
├── functions/
│   ├── index.js                    # Firebase Cloud Functions (V1): triggers + callable endpoints
│   └── package.json                # Functions dependencies (firebase-admin, firebase-functions)
│
├── public/
│   ├── favicon.svg
│   ├── icons.svg
│   └── images/                     # Static assets (logo.png, etc.)
│
├── index.html                      # Vite HTML entry, root div
├── vite.config.js                  # Vite config: React plugin, sourcemap disabled for prod
├── firebase.json                   # Firebase Hosting config + Firestore rules link + security headers
├── firestore.rules                 # Firestore security rules (server-side enforcement)
├── firestore.indexes.json          # Composite index definitions
├── .firebaserc                     # Firebase project alias
├── .gitignore                      # Excludes .env, node_modules, dist, service-account.json
├── package.json                    # Root dependencies + npm scripts
├── eslint.config.js                # ESLint flat config
├── create_admin.mjs                # CLI utility: creates an admin user via Admin SDK
├── list_users.mjs                  # CLI utility: lists all Firebase Auth users
└── test_query.mjs / test_txns.mjs  # Firestore query test scripts
```

---

## 4. Environment Variables

All secrets live in `.env` (git-ignored). **Never hardcode credentials**.

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
VITE_ENCRYPTION_KEY=         # Base64-encoded 32-byte AES-256 key for field encryption
```

Accessed in code as `import.meta.env.VITE_*`. Firebase init (`src/data/firebase.js`) throws a hard error if `VITE_FIREBASE_API_KEY` or `VITE_FIREBASE_PROJECT_ID` is missing.

---

## 5. NPM Scripts

```bash
npm run dev       # Start Vite dev server (localhost:5173)
npm run build     # Production build → /dist
npm run preview   # Serve production build locally
npm run lint      # ESLint check
```

---

## 6. Routing Architecture

Routes are defined in `src/App.jsx`:

| Path | Component | Protection |
|---|---|---|
| `/login` | `LoginPage` | Public |
| `/about` | `AboutPage` | Public |
| `/dashboard` | `DashboardPage` | Admin only |
| `/users` | `UsersPage` | Admin only |
| `/transactions` | `TransactionsPage` | Admin only |
| `/analytics` | `AnalyticsPage` | Admin only |
| `/settings` | `SettingsPage` | Admin only |
| `/*` (catch-all) | → `/login` | Redirect |

All protected routes are children of `DashboardLayout` and wrapped in `ProtectedRoute`.

### Auth Flow

1. `onAuthStateChanged` fires in `AuthProvider`.
2. If a Firebase user exists, their Firestore document is fetched.
3. Only users with `role === "admin"` are allowed in — others are signed out immediately.
4. Auth state is exposed via `AuthContext` (`useAuth()` hook).

---

## 7. Security Model

### 7.1 Client-Side (`src/security/authSecurity.js`)

| Feature | Detail |
|---|---|
| Input sanitisation | `sanitiseInput()` — strips null bytes, HTML chars, control characters; enforces max length |
| Email validation | RFC-5321 subset pattern, same as Firebase Auth accepts |
| Brute-force protection | Max **5** failed login attempts, then **15-minute** lockout (stored in `localStorage`) |
| Session idle timeout | **30-minute** idle → warning modal → auto logout after 2 more minutes |
| Absolute session cap | **8-hour** max session, forced logout regardless of activity |
| Activity tracking | `mousemove`, `mousedown`, `keydown`, `touchstart`, `scroll`, `click` extend the idle timer |

### 7.2 Field-Level Encryption (`src/security/encryption.js`)

- Algorithm: **AES-256-GCM** via browser `window.crypto.subtle`
- Key: loaded from `VITE_ENCRYPTION_KEY` (base64, 32 bytes)
- Format stored in Firestore: `"<base64-iv>:<base64-ciphertext>"`
- A fresh 12-byte random IV is generated for every encryption call
- Compatible with Flutter's `encrypt` package (same algorithm + key format)

**Fields always encrypted:**
- Users: `salary`, `loanAmount`, `loanBalance`, `income`, `expenses`, `netWorth`, `balance`, `accountNumber`, `cardNumber`
- Transactions: `amount`, `description`

### 7.3 Firestore Security Rules (`firestore.rules`)

```
users/         → admin: full CRUD | self: read own doc only
               → GUARD: admin role can NEVER be set via client SDK (only bootstrap script)
transactions/  → admin: read/update/delete | signed-in: create (mobile app)
notifications/ → admin: read/update/delete | signed-in: create (mobile app)
monthlyRevenue, userDistribution, categorySpending,
activityLog, userGrowth, quickMetrics → admin only
/* (catch-all) → DENY ALL
```

Admin verification is done server-side by reading the Firestore user document (`role === 'admin'`). This creates a circular write-protection: the client cannot self-promote because the Firestore write rule itself calls `isAdmin()`.

### 7.4 Firebase Hosting Security Headers (`firebase.json`)

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-XSS-Protection: 1; mode=block
```

---

## 8. Firestore Collections

### `users/{uid}`
```
uid, email, name, fullName, phone, mobile, role, plan, status,
balance, transactions, joined, createdAt, updatedAt,
age, hasLoan, hasSavingPlan, loanAmount, currentSavings,
checkEmail, checkSms, checkPush, checkReport, checkPromo
```

#### User Roles
| Value | Label | Color |
|---|---|---|
| `Student` | Student | `#38BDF8` (cyan) |
| `Business owner` | Business Owner | `#FBBF24` (amber) |
| `Company worker` | Company Worker | `#A78BFA` (purple) |
| `Multiple account holder` | Multi Account Holder | `#FB923C` (orange) |
| `admin` | Admin | `#F87171` (red, display only) |

#### User Statuses
| Value | Label | Color |
|---|---|---|
| `active` | Active | `#34D399` (green) |
| `inactive` | Inactive | `#94A3B8` (gray) |
| `suspended` | Suspended | `#FBBF24` (amber) |
| `deactivated` | Deactivated | `#F87171` (red) |

#### Role-Specific Subcollections
- `users/{uid}/student_profile/profile_data` — `university`, `course`, `studentId`
- `users/{uid}/worker_profile/profile_data` — `companyName`, `designation`, `monthlySalary`
- `users/{uid}/business_profile/profile_data` — `businessName`, `regNumber`, `industryType`
- `users/{uid}/multi_profile/profile_data` — `linkedAccountsCount`, `primaryWorkspace`

### `transactions/{txnId}`
```
user, email, category, amount, date, status, description, type
```
Status: `completed` | `pending` | `failed`

### `notifications/{docId}`
```
title, body, type, read, uid?, email?, txnId?, amount?, createdAt
```
Types: `user` | `alert` | `system` | `report`

### Analytics Collections (admin read/write only)
- `monthlyRevenue/{docId}` — monthly income/expenses data
- `userDistribution/{docId}` — user role distribution
- `categorySpending/{docId}` — spending by category
- `activityLog/{docId}` — activity log entries
- `userGrowth/{docId}` — user growth over time
- `quickMetrics/{docId}` — dashboard KPI metrics

---

## 9. Key Components Reference

### `AuthProvider` (in `App.jsx`)
- Provides `user`, `logout`, `loading`, `navigateRef` via `AuthContext`
- `useAuth()` hook: import from `../../App` (or `../App`)
- `logout(reason)` — signs out, clears session, redirects to `/login?reason=<reason>`

### `DashboardLayout`
- 260px permanent sidebar on desktop, temporary drawer on mobile
- Nav items: Dashboard, Users, Transactions, Analytics, Settings, About App
- Shows admin name/avatar at bottom of sidebar
- Logout confirmation dialog
- Renders `<Outlet />` for child page content

### `NotificationsPanel`
- Real-time `onSnapshot` listener on `notifications` collection
- Badge shows unread count on bell icon in AppBar
- Slide-in Drawer with mark-as-read / mark-all-read / batch write
- Notification types: `user` (cyan), `alert` (amber), `system` (green), `report` (purple)

### `SessionTimeoutModal`
- Shown when session idle timer expires
- 2-minute countdown with animated LinearProgress bar
- Urgent pulse animation below 30 seconds
- "Stay Logged In" resets session; "Log Out Now" immediately signs out

### `userService.js`
```js
createUser({ email, password, displayName, role, phone })  // Uses secondary Firebase app
updateUser({ uid, displayName, email, role, status, phone })
deleteUser(uid)  // Soft-delete: sets status='deactivated'
getRoleMeta(roleValue)   // Returns { value, label, color, bg, border }
getStatusMeta(statusValue)
ROLES    // Array of role metadata objects
STATUSES // Array of status metadata objects
```

**Create User strategy**: A secondary named Firebase app instance (`'secondary-user-creation'`) is used to call `createUserWithEmailAndPassword` without signing the admin out of their current session.

---

## 10. Cloud Functions (`functions/index.js`)

All functions use Firebase Functions **V1** (free Spark plan compatible).

### Event Triggers

| Function | Trigger | What it does |
|---|---|---|
| `onNewUserRegistered` | Auth `user().onCreate` | Creates Firestore profile + sends `user` notification |
| `onNewTransaction` | Firestore `transactions/{txnId}` onCreate | Sends notification; flags large transactions (>= $5,000) as `alert` type |
| `onUserDeleted` | Auth `user().onDelete` | Marks user Firestore doc `status: 'deleted'` + sends `alert` notification |

### Callable Functions (HTTPS)

| Function | Admin required | What it does |
|---|---|---|
| `createAdminNotification` | Yes | Creates a manual notification document |
| `adminCreateUser` | Yes | Creates Auth user + sets custom claims + Firestore profile (cannot create `admin` role) |
| `adminUpdateUser` | Yes | Updates Auth record + custom claims + Firestore (cannot promote to `admin`) |
| `adminDeleteUser` | Yes | Hard-deletes Auth user + Firestore doc (cannot delete self or other admins) |

Admin verification in functions uses `context.auth.token.role === 'admin'` (JWT custom claim). This is the server-side authoritative check — completely independent of Firestore.

---

## 11. MUI Theme Design System (`src/theme/theme.js`)

**Mode**: Dark

| Token | Value |
|---|---|
| Primary | `#2DD4BF` (teal) |
| Secondary | `#6366F1` (indigo) |
| Background default | `#070D18` |
| Background paper | `#0D1B2A` |
| Text primary | `#F0F6FF` |
| Text secondary | `#94A3B8` |
| Font | `'Inter', -apple-system, BlinkMacSystemFont` |
| Border radius | 12px |

**Key component overrides**:
- `MuiPaper` / `MuiCard`: glassmorphism (`backdrop-filter: blur(20px)`)
- `MuiCard`: hover lift animation (`translateY(-2px)`) with teal glow
- `MuiButton` contained primary: teal gradient with glow box-shadow
- `MuiTextField`: dark background, teal focus ring
- `MuiListItemButton` selected: teal left border + gradient background
- `MuiDrawer` / `MuiAppBar`: dark glass with teal border

---

## 12. Admin User Creation

Use the provided CLI utility to create admin accounts without using the Firebase Console:

```bash
node create_admin.mjs <email> <password> "<display-name>"
```

This registers the user via the Admin SDK and writes a Firestore document with `role: "admin"`. The `admin` role **cannot** be set through the web UI — only through this script or directly via Admin SDK.

---

## 13. Deployment

```bash
# Build production bundle
npm run build

# Deploy to Firebase Hosting
firebase deploy --only hosting

# Deploy Firestore rules
firebase deploy --only firestore:rules

# Deploy Cloud Functions
firebase deploy --only functions
```

The hosting config rewrites all paths to `/index.html` (SPA mode). `cleanUrls: true` removes `.html` extensions.

---

## 14. Important Conventions & Rules

1. **Never hardcode Firebase credentials** — always use `import.meta.env.VITE_*`.
2. **Admin role cannot be set via client SDK** — only via `create_admin.mjs` or Admin SDK. The Firestore rule guards this by rejecting writes that set `role: 'admin'`.
3. **Soft delete only** — `deleteUser()` in `userService.js` sets `status: 'deactivated'`; hard Auth deletion requires Cloud Functions (`adminDeleteUser`).
4. **Secondary Firebase app for user creation** — to avoid signing the admin out when creating new users, `createUser()` uses a separate named Firebase app instance.
5. **All sensitive financial fields must be encrypted** — use `encryptSensitiveFields()` / `decryptSensitiveFields()` from `encryption.js` before writing to / after reading from Firestore.
6. **Session security** — 30 min idle timeout, 8 hour max session cap, enforced by `authSecurity.js` + `AuthProvider`.
7. **`.env` is git-ignored** — never commit it. Use `service-account.json` only for local Admin SDK scripts, also git-ignored.
