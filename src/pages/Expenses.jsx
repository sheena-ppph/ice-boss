import { useState, useEffect } from 'react';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import db from '../db/database';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';

const CATEGORIES = ['Electricity', 'Ebike Payment', 'Salary', 'Supplies', 'Maintenance', 'Other'];

export default function Expenses() {
  const [form, setForm] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    category: 'Supplies',
    description: '',
    amount: '',
    paid: false,
    paidDate: '',
  });
  const [expenses, setExpenses] = useState([]);
  const [filterMonth, setFilterMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const all = await db.expenses.orderBy('date').reverse().toArray();
    setExpenses(all);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.amount || !form.description) return;
    setSaving(true);
    await db.expenses.add({
      date: form.date,
      category: form.category,
      description: form.description,
      amount: parseFloat(form.amount),
      paid: form.paid,
      paidDate: form.paid ? (form.paidDate || form.date) : null,
    });
    setForm(f => ({ ...f, description: '', amount: '', paid: false, paidDate: '' }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setSaving(false);
    loadData();
  }

  async function markPaid(id) {
    await db.expenses.update(id, { paid: true, paidDate: format(new Date(), 'yyyy-MM-dd') });
    loadData();
  }

  async function deleteExpense(id) {
    if (!confirm('Delete this expense?')) return;
    await db.expenses.delete(id);
    loadData();
  }

  // Filter by month
  const [filterYear, filterMonthNum] = filterMonth.split('-').map(Number);
  const monthStart = startOfMonth(new Date(filterYear, filterMonthNum - 1));
  const monthEnd = endOfMonth(new Date(filterYear, filterMonthNum - 1));

  const filteredExpenses = expenses.filter(e => {
    const d = parseISO(e.date);
    return isWithinInterval(d, { start: monthStart, end: monthEnd });
  });

  const monthTotal = filteredExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);
  const unpaid = expenses.filter(e => !e.paid);

  function categoryColor(cat) {
    const map = {
      Electricity: 'yellow',
      'Ebike Payment': 'blue',
      Salary: 'green',
      Supplies: 'orange',
      Maintenance: 'red',
      Other: 'gray',
    };
    return map[cat] || 'gray';
  }

  return (
    <div className="page-content p-4 space-y-4">
      {/* Unpaid Bills */}
      {unpaid.length > 0 && (
        <Card className="p-4 border-orange-200 bg-orange-50">
          <h2 className="text-sm font-bold text-orange-800 mb-3">⚠️ Unpaid Bills ({unpaid.length})</h2>
          <div className="space-y-2">
            {unpaid.map(e => (
              <div key={e.id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-orange-100">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{e.description}</p>
                  <p className="text-xs text-gray-500">{e.category} — {format(parseISO(e.date), 'MMM d, yyyy')}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-orange-700">₱{e.amount?.toLocaleString()}</span>
                  <button
                    onClick={() => markPaid(e.id)}
                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold min-h-[36px]"
                  >
                    Mark Paid
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Add Expense Form */}
      <Card className="p-4">
        <h2 className="text-base font-bold text-gray-800 mb-4">Add Expense</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Amount (₱)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Category</label>
            <select
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
            <input
              type="text"
              placeholder="e.g. April electricity bill"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.paid}
                onChange={e => setForm(f => ({ ...f, paid: e.target.checked }))}
                className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <span className="text-sm font-medium text-gray-700">Mark as Paid</span>
            </label>
          </div>

          {form.paid && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Paid Date</label>
              <input
                type="date"
                value={form.paidDate || form.date}
                onChange={e => setForm(f => ({ ...f, paidDate: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-orange-500 text-white rounded-xl py-3 font-semibold text-sm hover:bg-orange-600 active:scale-95 transition-all disabled:opacity-50 min-h-[48px]"
          >
            {saved ? '✓ Saved!' : saving ? 'Saving...' : 'Add Expense'}
          </button>
        </form>
      </Card>

      {/* Monthly Filter */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-gray-800">Expense History</h2>
          <input
            type="month"
            value={filterMonth}
            onChange={e => setFilterMonth(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="bg-gray-50 rounded-lg p-3 flex justify-between items-center mb-3">
          <span className="text-sm text-gray-600 font-medium">Month Total</span>
          <span className="text-xl font-bold text-gray-800">₱{monthTotal.toLocaleString()}</span>
        </div>

        {/* By Category */}
        {CATEGORIES.map(cat => {
          const catExpenses = filteredExpenses.filter(e => e.category === cat);
          if (catExpenses.length === 0) return null;
          const catTotal = catExpenses.reduce((a, e) => a + (e.amount || 0), 0);
          return (
            <div key={cat} className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <Badge variant={categoryColor(cat)}>{cat}</Badge>
                  <span className="text-xs text-gray-500">({catExpenses.length})</span>
                </div>
                <span className="text-sm font-bold text-gray-700">₱{catTotal.toLocaleString()}</span>
              </div>
              <div className="space-y-1">
                {catExpenses.map(e => (
                  <div key={e.id} className="flex items-center justify-between bg-white border border-gray-100 rounded-lg p-2.5">
                    <div>
                      <p className="text-sm text-gray-700">{e.description}</p>
                      <p className="text-xs text-gray-400">{format(parseISO(e.date), 'MMM d')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={e.paid ? 'green' : 'red'}>{e.paid ? 'Paid' : 'Unpaid'}</Badge>
                      <span className="text-sm font-bold text-gray-700">₱{e.amount?.toLocaleString()}</span>
                      {!e.paid && (
                        <button onClick={() => markPaid(e.id)} className="text-green-600 text-xs font-semibold">✓</button>
                      )}
                      <button onClick={() => deleteExpense(e.id)} className="text-red-300 hover:text-red-500 p-0.5">×</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {filteredExpenses.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">No expenses for this month.</p>
        )}
      </Card>
    </div>
  );
}
