import { useState, useEffect } from 'react';
import { format, parseISO, differenceInDays } from 'date-fns';
import db from '../db/database';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';

export default function Salary() {
  const [periods, setPeriods] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({
    periodStart: '',
    periodEnd: '',
    amount: '1250',
    paidDate: '',
    status: 'pending',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const all = await db.salaryPayments.orderBy('periodStart').reverse().toArray();
    setPeriods(all);
  }

  async function markPaid(id) {
    const today = format(new Date(), 'yyyy-MM-dd');
    await db.salaryPayments.update(id, { status: 'paid', paidDate: today });
    loadData();
  }

  async function handleAddSubmit(e) {
    e.preventDefault();
    if (!addForm.periodStart || !addForm.periodEnd) return;
    setSaving(true);
    await db.salaryPayments.add({
      periodStart: addForm.periodStart,
      periodEnd: addForm.periodEnd,
      amount: parseFloat(addForm.amount) || 1250,
      paidDate: addForm.status === 'paid' ? (addForm.paidDate || addForm.periodStart) : null,
      status: addForm.status,
    });
    setAddForm({ periodStart: '', periodEnd: '', amount: '1250', paidDate: '', status: 'pending' });
    setShowAddForm(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setSaving(false);
    loadData();
  }

  async function deletePeriod(id) {
    if (!confirm('Delete this salary period?')) return;
    await db.salaryPayments.delete(id);
    loadData();
  }

  const totalPaid = periods.filter(p => p.status === 'paid').reduce((a, p) => a + (p.amount || 0), 0);
  const totalPending = periods.filter(p => p.status === 'pending').reduce((a, p) => a + (p.amount || 0), 0);
  const nextPending = [...periods].reverse().find(p => p.status === 'pending');

  const today = new Date();

  return (
    <div className="page-content p-4 space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 text-center">
          <p className="text-xs text-gray-500">Total Paid</p>
          <p className="text-2xl font-bold text-green-600">₱{totalPaid.toLocaleString()}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs text-gray-500">Pending</p>
          <p className="text-2xl font-bold text-orange-600">₱{totalPending.toLocaleString()}</p>
        </Card>
      </div>

      {/* Next Payment Alert */}
      {nextPending && (
        <Card className="p-4 bg-orange-50 border border-orange-200">
          <h3 className="text-sm font-bold text-orange-800 mb-1">Next Salary Payment</h3>
          <p className="text-sm text-gray-700">
            Period: {format(parseISO(nextPending.periodStart), 'MMM d')} – {format(parseISO(nextPending.periodEnd), 'MMM d, yyyy')}
          </p>
          <p className="text-xl font-bold text-orange-700 mt-1">₱{nextPending.amount?.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">
            Pay on or around {format(parseISO(nextPending.periodStart), 'MMMM d')}
          </p>
          <button
            onClick={() => markPaid(nextPending.id)}
            className="mt-3 w-full py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold min-h-[44px]"
          >
            Mark as Paid
          </button>
        </Card>
      )}

      {/* Add Period Button */}
      <button
        onClick={() => setShowAddForm(!showAddForm)}
        className="w-full py-3 bg-blue-700 text-white rounded-xl text-sm font-semibold hover:bg-blue-800 min-h-[48px]"
      >
        + Add Salary Period
      </button>

      {/* Add Form */}
      {showAddForm && (
        <Card className="p-4">
          <h3 className="text-sm font-bold text-gray-800 mb-3">Add Salary Period</h3>
          <form onSubmit={handleAddSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Period Start</label>
                <input
                  type="date"
                  value={addForm.periodStart}
                  onChange={e => setAddForm(f => ({ ...f, periodStart: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Period End</label>
                <input
                  type="date"
                  value={addForm.periodEnd}
                  onChange={e => setAddForm(f => ({ ...f, periodEnd: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Amount (₱)</label>
              <input
                type="number"
                value={addForm.amount}
                onChange={e => setAddForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
              <div className="grid grid-cols-2 gap-2">
                {['pending', 'paid'].map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setAddForm(f => ({ ...f, status: s }))}
                    className={`py-2.5 rounded-lg text-sm font-semibold border-2 capitalize min-h-[44px] ${
                      addForm.status === s
                        ? s === 'paid' ? 'bg-green-600 text-white border-green-600' : 'bg-orange-500 text-white border-orange-500'
                        : 'bg-white text-gray-600 border-gray-200'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            {addForm.status === 'paid' && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Paid Date</label>
                <input
                  type="date"
                  value={addForm.paidDate}
                  onChange={e => setAddForm(f => ({ ...f, paidDate: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-blue-700 text-white rounded-xl py-3 font-semibold text-sm min-h-[48px]"
              >
                {saved ? '✓ Added!' : 'Add Period'}
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 bg-gray-100 text-gray-600 rounded-xl text-sm font-semibold min-h-[48px]"
              >
                Cancel
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* Salary Periods List */}
      <Card className="p-4">
        <h2 className="text-base font-bold text-gray-800 mb-3">Salary History</h2>
        {periods.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No salary periods yet.</p>
        ) : (
          <div className="space-y-2">
            {periods.map(p => {
              const isPaid = p.status === 'paid';
              const start = parseISO(p.periodStart);
              const end = parseISO(p.periodEnd);
              const daysUntil = differenceInDays(start, today);
              const isDueSoon = !isPaid && daysUntil >= 0 && daysUntil <= 3;

              return (
                <div
                  key={p.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    isPaid ? 'bg-green-50 border-green-100' :
                    isDueSoon ? 'bg-orange-50 border-orange-200' :
                    'bg-gray-50 border-gray-100'
                  }`}
                >
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-800">
                      {format(start, 'MMM d')} – {format(end, 'MMM d, yyyy')}
                    </p>
                    {isPaid && p.paidDate && (
                      <p className="text-xs text-green-600">Paid: {format(parseISO(p.paidDate), 'MMM d, yyyy')}</p>
                    )}
                    {!isPaid && isDueSoon && (
                      <p className="text-xs text-orange-600 font-semibold">Due in {daysUntil} day{daysUntil !== 1 ? 's' : ''}!</p>
                    )}
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-800">₱{p.amount?.toLocaleString()}</span>
                    {isPaid ? (
                      <Badge variant="green">Paid ✓</Badge>
                    ) : (
                      <button
                        onClick={() => markPaid(p.id)}
                        className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold min-h-[36px]"
                      >
                        Pay
                      </button>
                    )}
                    <button onClick={() => deletePeriod(p.id)} className="text-red-300 hover:text-red-500 p-1">×</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Info box */}
      <Card className="p-4 bg-blue-50">
        <h3 className="text-sm font-bold text-blue-800 mb-2">ℹ️ Salary Info</h3>
        <ul className="text-xs text-blue-700 space-y-1">
          <li>• Delivery boy: ₱2,500/month</li>
          <li>• Paid semi-monthly: ₱1,250 each</li>
          <li>• Pay on: 1st and 16th of each month</li>
          <li>• Schedule: Mon–Sun, 2pm–5pm</li>
        </ul>
      </Card>
    </div>
  );
}
