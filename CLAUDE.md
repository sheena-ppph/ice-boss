# Ice Boss — CLAUDE.md

## Project Overview
PWA business tracking app for **Ice Boss**, an ice cube business in a small town in the Philippines.
Owner: Sheena (sole user). Built with React + Vite + Tailwind CSS + Dexie.js (IndexedDB).

## Business Context
- **Products**: 5kg bags (₱45), 2kg bags (₱20), 1kg bags (₱10) — same price wholesale/retail
- **Chest freezer max**: 24×5kg, 10×2kg, 10×1kg bags
- **Delivery**: 1 ebike, solar-charged. Installment ₱5,750/mo due 14th (grace 14–17), 12 months total. Downpayment ₱10,000.
- **Delivery boy**: Mon–Sun 2–5pm, ₱2,500/month paid semi-monthly (₱1,250 on 1st and 16th)
- **Electricity**: Due 6th of each month, ~₱2,000 business share (house+ice machine+freezer ≈ ₱3,500 total)
- **Payment accepted**: Cash or GCash only (no credit)
- **Water**: Deep well (no water bill)
- **Ebike charging**: Solar powered, log battery % before/after

## Tech Stack
- **Frontend**: React 18 + Vite 8
- **Styling**: Tailwind CSS v4
- **Database**: Dexie.js v4 (IndexedDB — offline-first, browser storage)
- **Routing**: React Router v7
- **Dates**: date-fns v4
- **PWA**: vite-plugin-pwa (service worker, installable via Safari "Add to Home Screen")

## Running the App
```bash
npm run dev          # dev server at http://localhost:5173
npm run dev -- --host  # expose to network (for iPhone on same WiFi)
npm run build        # production build
npm run preview      # preview production build
```

## Deployment
- **GitHub**: https://github.com/sheena-ppph/ice-boss
- **Vercel**: Auto-deploys from GitHub `master` branch
- **Install on iPhone**: Open Vercel URL in Safari → Share → "Add to Home Screen"

## Database (Dexie.js)
All data is stored locally in IndexedDB via Dexie. Tables:
- `production` — ice production logs (machine start/stop, 1st drop, bags per size)
- `sales` — sales transactions (bag quantities, total, cash/gcash)
- `expenses` — expense records (category, amount, paid status)
- `bagInventory` — plastic bag pack counts (5kg, 2kg, 1kg)
- `coolers` — cooler tracker (label, size, status: available/ebike/out/collect, borrower)
- `supplies` — general supplies (filters, cleaning, office items)
- `ebikePayments` — 12-month installment schedule
- `ebikeCharging` — battery % log (before/after)
- `attendance` — delivery boy daily time in/out
- `salaryPayments` — semi-monthly salary records
- `settings` — internal flags (e.g., `initialized` seed guard)

**DB versioning**: Currently on version 2. When adding new tables/indexes, increment the version number and add a new `db.version(N).stores({...})` block. Do NOT remove old version blocks.

**Seeding**: `initSeedData()` in `database.js` runs once on first app launch, guarded by a `settings.initialized` flag. `clearDuplicates()` also runs on startup to fix any duplicate records caused by React StrictMode double-rendering in development.

## App Structure
```
src/
├── db/database.js          # Dexie DB setup, seed data, clearDuplicates
├── components/
│   ├── layout/
│   │   ├── Header.jsx      # Top bar with page title and date
│   │   └── BottomNav.jsx   # Mobile bottom navigation
│   └── ui/
│       ├── Card.jsx
│       ├── Badge.jsx
│       └── Alert.jsx
└── pages/
    ├── Dashboard.jsx       # Home: daily summary + smart alerts
    ├── Production.jsx      # Log ice production (machine times, 1st drop, cycles, bags)
    ├── Sales.jsx           # Log sales transactions
    ├── Inventory.jsx       # Bags packs | Coolers tracker | Supplies
    ├── Expenses.jsx        # Expense logging and tracking
    ├── Ebike.jsx           # Payment schedule + battery charging log
    ├── Attendance.jsx      # Delivery boy daily time in/out
    ├── Salary.jsx          # Semi-monthly salary payments
    └── Reports.jsx         # Revenue/expense/profit reports + JSON backup/restore
```

## Key Features
- **Dashboard alerts**: Low bag stock, upcoming ebike payment (3 days), upcoming electricity bill, coolers to collect
- **Production**: Machine start/stop time → auto-calculates total runtime. 1st drop duration + kilos → auto-calculates estimated cycles.
- **Freezer stock**: Auto-calculated as total production minus total sales (resets on manual inventory reset)
- **Bag inventory**: Alert when ≤1 pack left. Order threshold = 1 pack remaining (order online, ~1 week delivery)
- **Coolers**: 11 coolers pre-labeled #1–#11, grouped by status (On Ebike / Out on Loan / To Collect / Available)
- **Ebike payments**: 12-month timeline, months 1–6 paid (Oct 2025–Mar 2026), months 7–12 pending (Apr–Sep 2026)
- **Reports**: JSON export/import for manual backup to iCloud

## Design Conventions
- Mobile-first, max-width `max-w-lg mx-auto`
- Primary color: `blue-700` / `blue-800`
- All prices in Philippine Peso (₱)
- Dates: "March 19, 2026" or "Mar 19" format
- Times: 12-hour format with AM/PM
- Minimum touch target: 48px height for primary buttons, 44px for secondary
- Bottom nav: Home, Production, Sales, Inventory, Ebike, More (→ Attendance, Salary, Reports, Expenses)

## Future Plans
- **Supabase**: Add cloud sync when multi-device access is needed. Will replace Dexie as primary DB or add as sync layer.
- Keep `clearDuplicates()` in production until Supabase migration is confirmed clean.
