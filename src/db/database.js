import Dexie from 'dexie';

const db = new Dexie('IceBossDB');

db.version(1).stores({
  production: '++id, date',
  sales: '++id, date',
  expenses: '++id, date, category',
  bagInventory: '++id, size',
  coolers: '++id, status',
  ebikePayments: '++id, monthNum',
  ebikeCharging: '++id, date',
  attendance: '++id, date',
  salaryPayments: '++id, periodStart',
});

db.version(2).stores({
  production: '++id, date',
  sales: '++id, date',
  expenses: '++id, date, category',
  bagInventory: '++id, size',
  coolers: '++id, status',
  ebikePayments: '++id, monthNum',
  ebikeCharging: '++id, date',
  attendance: '++id, date',
  salaryPayments: '++id, periodStart',
  supplies: '++id, category, name',
  settings: '++id, key',
});

let seedInProgress = false;

export async function initSeedData() {
  if (seedInProgress) return;
  seedInProgress = true;

  try {
    const flag = await db.settings.where('key').equals('initialized').first();
    if (flag) return;

    // Mark initialized first to prevent race condition
    await db.settings.add({ key: 'initialized', value: '1' });

    // Bag Inventory
    await db.bagInventory.bulkAdd([
      { size: '5kg', packsCount: 5, lastUpdated: new Date().toISOString() },
      { size: '2kg', packsCount: 5, lastUpdated: new Date().toISOString() },
      { size: '1kg', packsCount: 5, lastUpdated: new Date().toISOString() },
    ]);

    // Coolers
    await db.coolers.bulkAdd([
      { label: 'Cooler #1', size: 'long', status: 'ebike', borrower: null, dateOut: null },
      { label: 'Cooler #2', size: 'mid', status: 'ebike', borrower: null, dateOut: null },
      { label: 'Cooler #3', size: 'mid', status: 'ebike', borrower: null, dateOut: null },
      { label: 'Cooler #4', size: 'mid', status: 'out', borrower: 'Juls', dateOut: null },
      { label: 'Cooler #5', size: 'mid', status: 'out', borrower: 'Palmones Dancalan', dateOut: null },
      { label: 'Cooler #6', size: 'redPlastic', status: 'out', borrower: 'Smiles', dateOut: null },
      { label: 'Cooler #7', size: 'mid', status: 'available', borrower: null, dateOut: null },
      { label: 'Cooler #8', size: 'mid', status: 'available', borrower: null, dateOut: null },
      { label: 'Cooler #9', size: 'mid', status: 'available', borrower: null, dateOut: null },
      { label: 'Cooler #10', size: 'mid', status: 'collect', borrower: 'Pilar', dateOut: null },
      { label: 'Cooler #11', size: 'mid', status: 'collect', borrower: 'Pilar', dateOut: null },
    ]);

    // Supplies
    await db.supplies.bulkAdd([
      { category: 'Filters', name: 'Water Filter', quantity: 0, unit: 'pcs', notes: '' },
      { category: 'Cleaning', name: 'Cleaning Supplies', quantity: 0, unit: 'set', notes: '' },
      { category: 'Office', name: 'Notebook', quantity: 0, unit: 'pcs', notes: '' },
      { category: 'Office', name: 'Pen', quantity: 0, unit: 'pcs', notes: '' },
    ]);

    // Ebike Payments
    await db.ebikePayments.bulkAdd([
      { monthNum: 1, dueDate: '2025-10-14', paidDate: '2025-10-14', amount: 5750, status: 'paid' },
      { monthNum: 2, dueDate: '2025-11-14', paidDate: '2025-11-14', amount: 5750, status: 'paid' },
      { monthNum: 3, dueDate: '2025-12-14', paidDate: '2025-12-14', amount: 5750, status: 'paid' },
      { monthNum: 4, dueDate: '2026-01-14', paidDate: '2026-01-14', amount: 5750, status: 'paid' },
      { monthNum: 5, dueDate: '2026-02-14', paidDate: '2026-02-14', amount: 5750, status: 'paid' },
      { monthNum: 6, dueDate: '2026-03-14', paidDate: '2026-03-17', amount: 5750, status: 'paid' },
      { monthNum: 7, dueDate: '2026-04-14', paidDate: null, amount: 5750, status: 'pending' },
      { monthNum: 8, dueDate: '2026-05-14', paidDate: null, amount: 5750, status: 'pending' },
      { monthNum: 9, dueDate: '2026-06-14', paidDate: null, amount: 5750, status: 'pending' },
      { monthNum: 10, dueDate: '2026-07-14', paidDate: null, amount: 5750, status: 'pending' },
      { monthNum: 11, dueDate: '2026-08-14', paidDate: null, amount: 5750, status: 'pending' },
      { monthNum: 12, dueDate: '2026-09-14', paidDate: null, amount: 5750, status: 'pending' },
    ]);

    // Salary Payments
    await db.salaryPayments.bulkAdd([
      { periodStart: '2026-03-01', periodEnd: '2026-03-15', amount: 1250, paidDate: '2026-03-01', status: 'paid' },
      { periodStart: '2026-03-16', periodEnd: '2026-03-31', amount: 1250, paidDate: null, status: 'pending' },
      { periodStart: '2026-04-01', periodEnd: '2026-04-15', amount: 1250, paidDate: null, status: 'pending' },
      { periodStart: '2026-04-16', periodEnd: '2026-04-30', amount: 1250, paidDate: null, status: 'pending' },
    ]);
  } finally {
    seedInProgress = false;
  }
}

export async function clearDuplicates() {
  // Utility: remove duplicate coolers and bag inventory if they exist
  const allCoolers = await db.coolers.toArray();
  const seen = new Set();
  for (const c of allCoolers) {
    if (seen.has(c.label)) {
      await db.coolers.delete(c.id);
    } else {
      seen.add(c.label);
    }
  }

  const allBags = await db.bagInventory.toArray();
  const seenBags = new Set();
  for (const b of allBags) {
    if (seenBags.has(b.size)) {
      await db.bagInventory.delete(b.id);
    } else {
      seenBags.add(b.size);
    }
  }
}

export default db;
