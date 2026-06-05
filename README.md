# FinGuard Admin Portal Dashboard

FinGuard Admin Portal is a premium web dashboard built with **React**, **Vite**, and **Material UI (MUI)**. It connects directly to your Cloud Firestore database to monitor financial transactions, manage user accounts, and view real-time analytics synchronized with your mobile app.

---

## Key Features

- **Admin-Only Secure Authentication**: Integrated with Firebase Authentication. Restricts dashboard access to registered users holding the `admin` role in Cloud Firestore.
- **Real-Time KPI Metrics**: Dynamic cards displaying Total Users, Total Transactions, Active Alerts, and App Session volumes calculated live from your database collections.
- **Interactive Revenue Charts**: Area charts powered by Recharts mapping monthly income and expenses.
- **Transaction Logs**: Searchable, categorizable, and filterable tables showcasing live financial records.
- **User Directory**: Clean list displaying registered users, their subscription tier, total balance, total transaction count, and account status.
- **Responsive Theme Layout**: A modern glassmorphism design system tailored with Outfit and Roboto typography.

---

## Tech Stack

- **Core**: React 19, React Router 7
- **Bundler**: Vite 8
- **UI & Iconography**: Material UI (MUI) v9
- **Database & Auth**: Firebase JS SDK (Authentication & Firestore)
- **Charts**: Recharts, MUI Charts

---

## Installation & Setup

### 1. Install Dependencies
Navigate to your project root folder and run:
```bash
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the root directory (based on the `.env` template provided) and add your Firebase Web Application keys:

```env
VITE_FIREBASE_API_KEY=YOUR_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN=YOUR_PROJECT_ID.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET=YOUR_PROJECT_ID.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=YOUR_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID=YOUR_APP_ID
VITE_FIREBASE_MEASUREMENT_ID=YOUR_MEASUREMENT_ID
```

---

## Running the Application

### Start Development Server
Run the Vite development server locally:
```bash
npm run dev
```
Open your browser and navigate to the address shown in your terminal (typically `http://localhost:5173`).

### Build for Production
Generate a minified and optimized production build:
```bash
npm run build
```

---

## Programmatic Admin User Creation

We have provided a helper utility script `create_admin.mjs` to quickly provision new administrator accounts in your Firebase environment without using the online console manually.

To create an administrator, run the following command in your terminal, passing in the desired **email**, **password**, and **display name**:

```bash
node create_admin.mjs <user-email> <user-password> "<user-display-name>"
```

*(This will register the user in Firebase Authentication and set up their document in the Firestore `users` collection with the required `role: "admin"` field).*
