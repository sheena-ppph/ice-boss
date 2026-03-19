import { useState, useEffect } from 'react';
import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, subMonths } from 'date-fns';
import db from '../db/database';
import Card from '../components/ui/Card';

const PRICES = { bags5kg: 45, bags2kg: 20, bags1kg: 10 };

export default function Reports() {
  const [range, setRange] = useState('month');
  const [customStart, setCustomStart] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [data, setData] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');

  useEffect(() => { loadReports(); }, [range, customStart, customEnd]);

  function getDateRange() {
    const today = new Date();
    if (range === 'week') {
      return { start: startOfWeek(today, { weekStartsOn: 1 }), end: endOfWeek(today, { weekStartsOn: 1 }) };
    }
    if (range === 'month') {
      return { start: startOfMonth(today), end: endOfMonth(today) };
    }
    if (range === 'lastMonth') {
      const lm = subMonths(today, 1);
      return { start: startOfMonth(lm), end: endOfMonth(lm) };
    }
    // custom
    return { start: parseISO(customStart), end: parseISO(customEnd) };
  }

  async function loadReports() {
    const { start, end } = getDateRange();

    function inRange(dateStr) {
      if (!dateStr) return false;
      try {
        return isWithinInterval(parseISO(dateStr), { start, end });
      } catch { return false; }
    }

    const sales = (await db.sales.toArray()).filter(s => inRange(s.date));
    const expenses = (await db.expenses.toArray()).filter(e => inRange(e.date));
    const production = (await db.production.toArray()).filter(p => inRange(p.date));

    // Sales breakdown
    const rev5kg = sales.reduce((a, s) => a + (s.bags5kg || 0) * PRICES.bags5kg, 0);
    const rev2kg = sales.reduce((a, s) => a + (s.bags2kg || 0) * PRICES.bags2kg, 0);
    const rev1kg = sales.reduce((a, s) => a + (s.bags1kg || 0) * PRICES.bags1kg, 0);
    const totalRevenue = rev5kg + rev2kg + rev1kg;

    const cashRevenue = sales.filter(s => s.paymentMethod === 'cash').reduce((a, s) => a + (s.totalAmount || 0), 0);
    const gcashRevenue = sales.filter(s => s.paymentMethod === 'gcash').reduce((a, s) => a + (s.totalAmount || 0), 0);

    // Production
    const prod5kg = production.reduce((a, p) => a + (p.bags5kg || 0), 0);
    const prod2kg = production.reduce((a, p) => a + (p.bags2kg || 0), 0);
    const prod1kg = production.reduce((a, p) => a + (p.bags1kg || 0), 0);

    // Expenses by category
    const expensesByCategory = {};
    expenses.forEach(e => {
      expensesByCategory[e.category] = (expensesByCategory[e.category] || 0) + (e.amount || 0);
    });
    const totalExpenses = expenses.reduce((a, e) => a + (e.amount || 0), 0);
    const profit = totalRevenue - totalExpenses;

    setData({
      dateRange: { start, end },
      sales: {
        count: sales.length,
        bags5kg: sales.reduce((a, s) => a + (s.bags5kg || 0), 0),
        bags2kg: sales.reduce((a, s) => a + (s.bags2kg || 0), 0),
        bags1kg: sales.reduce((a, s) => a + (s.bags1kg || 0), 0),
        rev5kg, rev2kg, rev1kg,
        totalRevenue, cashRevenue, gcashRevenue,
      },
      production: { prod5kg, prod2kg, prod1kg, total: prod5kg + prod2kg + prod1kg },
      expenses: { byCategory: expensesByCategory, total: totalExpenses },
      profit,
    });
  }

  async function exportData() {
    setExporting(true);
    try {
      const exportObj = {
        exportDate: new Date().toISOString(),
        version: 1,
        production: await db.production.toArray(),
        sales: await db.sales.toArray(),
        expenses: await db.expenses.toArray(),
        bagInventory: await db.bagInventory.toArray(),
        coolers: await db.coolers.toArray(),
        ebikePayments: await db.ebikePayments.toArray(),
        ebikeCharging: await db.ebikeCharging.toArray(),
        attendance: await db.attendance.toArray(),
        salaryPayments: await db.salaryPayments.toArray(),
      };
      const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `iceboss-backup-${format(new Date(), 'yyyy-MM-dd')}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  async function importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    setImportMsg('');
    try {
      const text = await file.text();
      const imported = JSON.parse(text);
      if (!imported.version || !imported.production) {
        setImportMsg('Invalid backup file.');
        return;
      }
      // Clear and re-import each table
      if (imported.production) { await db.production.clear(); await db.production.bulkAdd(imported.production.map(r => { const { id, ...rest } = r; return rest; })); }
      if (imported.sales) { await db.sales.clear(); await db.sales.bulkAdd(imported.sales.map(r => { const { id, ...rest } = r; return rest; })); }
      if (imported.expenses) { await db.expenses.clear(); await db.expenses.bulkAdd(imported.expenses.map(r => { const { id, ...rest } = r; return rest; })); }
      if (imported.bagInventory) { await db.bagInventory.clear(); await db.bagInventory.bulkAdd(imported.bagInventory.map(r => { const { id, ...rest } = r; return rest; })); }
      if (imported.coolers) { await db.coolers.clear(); await db.coolers.bulkAdd(imported.coolers.map(r => { const { id, ...rest } = r; return rest; })); }
      if (imported.ebikePayments) { await db.ebikePayments.clear(); await db.ebikePayments.bulkAdd(imported.ebikePayments.map(r => { const { id, ...rest } = r; return rest; })); }
      if (imported.ebikeCharging) { await db.ebikeCharging.clear(); await db.ebikeCharging.bulkAdd(imported.ebikeCharging.map(r => { const { id, ...rest } = r; return rest; })); }
      if (imported.attendance) { await db.attendance.clear(); await db.attendance.bulkAdd(imported.attendance.map(r => { const { id, ...rest } = r; return rest; })); }
      if (imported.salaryPayments) { await db.salaryPayments.clear(); await db.salaryPayments.bulkAdd(imported.salaryPayments.map(r => { const { id, ...rest } = r; return rest; })); }
      setImportMsg('✓ Data imported successfully! Refresh the app.');
      loadReports();
    } catch (err) {
      setImportMsg('Error importing: ' + err.message);
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  }

  const rangeLabel = data ? `${format(data.dateRange.start, 'MMM d')} – ${format(data.dateRange.end, 'MMM d, yyyy')}` : '';

  return (
    <div className="page-content p-4 space-y-4">
      {/* Date Range Selector */}
      <Card className="p-4">
        <h2 className="text-base font-bold text-gray-800 mb-3">Reports</h2>
        <div className="flex gap-2 flex-wrap">
          {[
            { key: 'week', label: 'This Week' },
            { key: 'month', label: 'This Month' },
            { key: 'lastMonth', label: 'Last Month' },
            { key: 'custom', label: 'Custom' },
          ].map(r => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`px-3 py-2 rounded-lg text-sm font-semibold border-2 min-h-[44px] ${
                range === r.key ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {range === 'custom' && (
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">From</label>
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">To</label>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {data && (
          <p className="text-xs text-gray-400 mt-2">{rangeLabel}</p>
        )}
      </Card>

      {data && (
        <>
          {/* Profit Summary */}
          <Card className={`p-4 ${data.profit >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border`}>
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Net Profit</p>
            <p className={`text-4xl font-bold mt-1 ${data.profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              ₱{data.profit.toLocaleString()}
            </p>
            <div className="flex gap-4 mt-2 text-sm">
              <span className="text-green-600">Revenue: ₱{data.sales.totalRevenue.toLocaleString()}</span>
              <span className="text-red-500">Expenses: ₱{data.expenses.total.toLocaleString()}</span>
            </div>
          </Card>

          {/* Revenue Breakdown */}
          <Card className="p-4">
            <h3 className="text-sm font-bold text-gray-800 mb-3">Revenue Breakdown</h3>
            <div className="space-y-2">
              {[
                { label: '5kg Bags', bags: data.sales.bags5kg, rev: data.sales.rev5kg },
                { label: '2kg Bags', bags: data.sales.bags2kg, rev: data.sales.rev2kg },
                { label: '1kg Bags', bags: data.sales.bags1kg, rev: data.sales.rev1kg },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between py-1.5 border-b border-gray-50">
                  <span className="text-sm text-gray-700">{row.label}</span>
                  <div className="text-right">
                    <span className="text-sm text-gray-500 mr-3">{row.bags} bags</span>
                    <span className="text-sm font-bold text-green-700">₱{row.rev.toLocaleString()}</span>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2">
                <span className="text-sm font-bold text-gray-800">Total Revenue</span>
                <span className="text-lg font-bold text-green-700">₱{data.sales.totalRevenue.toLocaleString()}</span>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-2 text-center">
                <p className="text-xs text-gray-500">💵 Cash</p>
                <p className="font-bold text-gray-700">₱{data.sales.cashRevenue.toLocaleString()}</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-2 text-center">
                <p className="text-xs text-gray-500">📱 GCash</p>
                <p className="font-bold text-blue-700">₱{data.sales.gcashRevenue.toLocaleString()}</p>
              </div>
            </div>
          </Card>

          {/* Expenses Breakdown */}
          <Card className="p-4">
            <h3 className="text-sm font-bold text-gray-800 mb-3">Expenses Breakdown</h3>
            {Object.keys(data.expenses.byCategory).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-2">No expenses in this period.</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(data.expenses.byCategory).map(([cat, amt]) => (
                  <div key={cat} className="flex items-center justify-between py-1.5 border-b border-gray-50">
                    <span className="text-sm text-gray-700">{cat}</span>
                    <span className="text-sm font-bold text-red-600">₱{amt.toLocaleString()}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2">
                  <span className="text-sm font-bold text-gray-800">Total Expenses</span>
                  <span className="text-lg font-bold text-red-600">₱{data.expenses.total.toLocaleString()}</span>
                </div>
              </div>
            )}
          </Card>

          {/* Production */}
          <Card className="p-4">
            <h3 className="text-sm font-bold text-gray-800 mb-3">Production Summary</h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { label: '5kg', val: data.production.prod5kg },
                { label: '2kg', val: data.production.prod2kg },
                { label: '1kg', val: data.production.prod1kg },
              ].map(p => (
                <div key={p.label} className="bg-blue-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">{p.label}</p>
                  <p className="text-2xl font-bold text-blue-700">{p.val}</p>
                  <p className="text-xs text-gray-400">bags</p>
                </div>
              ))}
            </div>
            <p className="text-center text-sm text-gray-500 mt-2">
              Total: <span className="font-bold text-gray-800">{data.production.total} bags</span>
            </p>
          </Card>
        </>
      )}

      {/* Export / Import */}
      <Card className="p-4">
        <h3 className="text-base font-bold text-gray-800 mb-3">Backup & Restore</h3>
        <div className="space-y-3">
          <button
            onClick={exportData}
            disabled={exporting}
            className="w-full py-3 bg-blue-700 text-white rounded-xl text-sm font-semibold hover:bg-blue-800 disabled:opacity-50 min-h-[48px] flex items-center justify-center gap-2"
          >
            <span>⬇️</span>
            {exporting ? 'Exporting...' : 'Export All Data (JSON)'}
          </button>

          <label className="block">
            <div className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 cursor-pointer min-h-[48px] flex items-center justify-center gap-2 border-2 border-dashed border-gray-300">
              <span>⬆️</span>
              {importing ? 'Importing...' : 'Import Backup (JSON)'}
            </div>
            <input
              type="file"
              accept=".json"
              onChange={importData}
              className="hidden"
            />
          </label>

          {importMsg && (
            <div className={`p-3 rounded-lg text-sm font-medium ${importMsg.startsWith('✓') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {importMsg}
            </div>
          )}

          <p className="text-xs text-gray-400 text-center">
            Export regularly to keep a backup of your data.
            Imported data will replace all existing records.
          </p>
        </div>
      </Card>
    </div>
  );
}
