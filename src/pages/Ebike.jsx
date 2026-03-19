import { useState, useEffect } from 'react';
import { format, parseISO, differenceInDays } from 'date-fns';
import db from '../db/database';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';

const MONTH_NAMES = [
  '', 'Oct 2025', 'Nov 2025', 'Dec 2025', 'Jan 2026', 'Feb 2026', 'Mar 2026',
  'Apr 2026', 'May 2026', 'Jun 2026', 'Jul 2026', 'Aug 2026', 'Sep 2026'
];

export default function Ebike() {
  const [tab, setTab] = useState('payments');
  const [payments, setPayments] = useState([]);
  const [chargeLogs, setChargeLogs] = useState([]);
  const [chargeForm, setChargeForm] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    time: format(new Date(), 'HH:mm'),
    batteryBefore: '',
    batteryAfter: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const pays = await db.ebikePayments.orderBy('monthNum').toArray();
    setPayments(pays);
    const logs = await db.ebikeCharging.orderBy('date').reverse().toArray();
    setChargeLogs(logs);
  }

  async function markPaymentPaid(id) {
    const today = format(new Date(), 'yyyy-MM-dd');
    await db.ebikePayments.update(id, { status: 'paid', paidDate: today });
    loadData();
  }

  async function handleChargeSubmit(e) {
    e.preventDefault();
    if (!chargeForm.batteryBefore && !chargeForm.batteryAfter) return;
    setSaving(true);
    await db.ebikeCharging.add({
      date: chargeForm.date,
      time: chargeForm.time,
      batteryBefore: parseInt(chargeForm.batteryBefore) || null,
      batteryAfter: parseInt(chargeForm.batteryAfter) || null,
      notes: chargeForm.notes,
    });
    setChargeForm(f => ({ ...f, batteryBefore: '', batteryAfter: '', notes: '' }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setSaving(false);
    loadData();
  }

  async function deleteChargeLog(id) {
    if (!confirm('Delete this charging log?')) return;
    await db.ebikeCharging.delete(id);
    loadData();
  }

  function formatTime(t) {
    if (!t) return '';
    const [h, m] = t.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    return `${hour % 12 || 12}:${m} ${ampm}`;
  }

  const paidCount = payments.filter(p => p.status === 'paid').length;
  const totalPaid = 10000 + (paidCount * 5750); // DP + monthly
  const remaining = (12 - paidCount) * 5750;

  // Charging stats
  const depletionList = chargeLogs
    .filter(l => l.batteryBefore !== null && l.batteryAfter !== null)
    .map(l => l.batteryAfter - l.batteryBefore); // positive = charged up
  const avgCharge = depletionList.length > 0
    ? Math.round(depletionList.reduce((a, b) => a + b, 0) / depletionList.length)
    : null;

  const nextPending = payments.find(p => p.status === 'pending');
  const today = new Date();

  return (
    <div className="page-content p-4 space-y-4">
      {/* Tab Toggle */}
      <div className="flex bg-gray-100 rounded-xl p-1">
        {[
          { key: 'payments', label: '💳 Payments' },
          { key: 'charging', label: '⚡ Charging' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all min-h-[44px] ${
              tab === t.key ? 'bg-white shadow text-blue-700' : 'text-gray-500'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'payments' && (
        <div className="space-y-4">
          {/* Summary */}
          <Card className="p-4">
            <h2 className="text-base font-bold text-gray-800 mb-3">Ebike Installment Summary</h2>

            {/* Progress */}
            <div className="mb-3">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>{paidCount} months paid</span>
                <span>{12 - paidCount} remaining</span>
              </div>
              <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all"
                  style={{ width: `${(paidCount / 12) * 100}%` }}
                />
              </div>
              <p className="text-xs text-center text-gray-500 mt-1">{paidCount}/12 months</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Total Paid</p>
                <p className="text-lg font-bold text-green-700">₱{totalPaid.toLocaleString()}</p>
                <p className="text-xs text-gray-400">incl. ₱10,000 DP</p>
              </div>
              <div className="bg-orange-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Remaining</p>
                <p className="text-lg font-bold text-orange-700">₱{remaining.toLocaleString()}</p>
                <p className="text-xs text-gray-400">{12 - paidCount} × ₱5,750</p>
              </div>
            </div>

            {nextPending && (
              <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm font-semibold text-red-700">
                  Next due: Month {nextPending.monthNum} — {format(parseISO(nextPending.dueDate), 'MMMM d, yyyy')}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Grace period until {format(new Date(parseISO(nextPending.dueDate).getTime() + 3 * 86400000), 'MMM d')}
                </p>
                {differenceInDays(parseISO(nextPending.dueDate), today) <= 7 && (
                  <p className="text-xs font-bold text-red-600 mt-1">
                    ⚠️ {differenceInDays(parseISO(nextPending.dueDate), today)} days away!
                  </p>
                )}
              </div>
            )}
          </Card>

          {/* Payment Timeline */}
          <Card className="p-4">
            <h2 className="text-base font-bold text-gray-800 mb-3">Payment Schedule</h2>
            <div className="space-y-2">
              {payments.map(p => {
                const isPaid = p.status === 'paid';
                const isOverdue = !isPaid && differenceInDays(today, parseISO(p.dueDate)) > 3;
                const daysUntil = differenceInDays(parseISO(p.dueDate), today);
                return (
                  <div
                    key={p.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      isPaid ? 'bg-green-50 border-green-100' :
                      isOverdue ? 'bg-red-50 border-red-200' :
                      daysUntil <= 7 ? 'bg-yellow-50 border-yellow-200' :
                      'bg-gray-50 border-gray-100'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                      isPaid ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {p.monthNum}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{MONTH_NAMES[p.monthNum]}</p>
                      <p className="text-xs text-gray-500">Due: {format(parseISO(p.dueDate), 'MMM d, yyyy')}</p>
                      {isPaid && p.paidDate && (
                        <p className="text-xs text-green-600">Paid: {format(parseISO(p.paidDate), 'MMM d, yyyy')}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-800">₱{p.amount?.toLocaleString()}</p>
                      {isPaid ? (
                        <Badge variant="green">Paid ✓</Badge>
                      ) : isOverdue ? (
                        <Badge variant="red">Overdue!</Badge>
                      ) : (
                        <button
                          onClick={() => markPaymentPaid(p.id)}
                          className="px-3 py-1.5 bg-blue-700 text-white rounded-lg text-xs font-semibold min-h-[36px]"
                        >
                          Mark Paid
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {tab === 'charging' && (
        <div className="space-y-4">
          {/* Charging Stats */}
          {chargeLogs.length > 0 && (
            <Card className="p-4">
              <h2 className="text-sm font-bold text-gray-700 mb-3">Battery Stats</h2>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Total Sessions</p>
                  <p className="text-2xl font-bold text-blue-700">{chargeLogs.length}</p>
                </div>
                {avgCharge !== null && (
                  <div className="bg-green-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Avg Charge</p>
                    <p className="text-2xl font-bold text-green-700">+{avgCharge}%</p>
                  </div>
                )}
                {chargeLogs[0]?.batteryAfter !== null && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Last After</p>
                    <p className="text-2xl font-bold text-gray-700">{chargeLogs[0]?.batteryAfter}%</p>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Log Charging Form */}
          <Card className="p-4">
            <h2 className="text-base font-bold text-gray-800 mb-4">Log Charging Session</h2>
            <form onSubmit={handleChargeSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Date</label>
                  <input
                    type="date"
                    value={chargeForm.date}
                    onChange={e => setChargeForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Time</label>
                  <input
                    type="time"
                    value={chargeForm.time}
                    onChange={e => setChargeForm(f => ({ ...f, time: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Battery Before (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="e.g. 20"
                    value={chargeForm.batteryBefore}
                    onChange={e => setChargeForm(f => ({ ...f, batteryBefore: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Battery After (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="e.g. 85"
                    value={chargeForm.batteryAfter}
                    onChange={e => setChargeForm(f => ({ ...f, batteryAfter: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                  />
                </div>
              </div>

              {/* Battery visualization */}
              {(chargeForm.batteryBefore || chargeForm.batteryAfter) && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 mb-1">Before</p>
                      <div className="h-6 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-400 rounded-full"
                          style={{ width: `${Math.min(100, parseInt(chargeForm.batteryBefore) || 0)}%` }}
                        />
                      </div>
                      <p className="text-xs text-center font-bold mt-1">{chargeForm.batteryBefore || 0}%</p>
                    </div>
                    <span className="text-gray-400">→</span>
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 mb-1">After</p>
                      <div className="h-6 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-400 rounded-full"
                          style={{ width: `${Math.min(100, parseInt(chargeForm.batteryAfter) || 0)}%` }}
                        />
                      </div>
                      <p className="text-xs text-center font-bold mt-1">{chargeForm.batteryAfter || 0}%</p>
                    </div>
                  </div>
                  {chargeForm.batteryBefore && chargeForm.batteryAfter && (
                    <p className="text-xs text-center text-gray-500 mt-2">
                      Charged: +{Math.max(0, (parseInt(chargeForm.batteryAfter) || 0) - (parseInt(chargeForm.batteryBefore) || 0))}%
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Notes (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. sunny day, full charge"
                  value={chargeForm.notes}
                  onChange={e => setChargeForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-blue-700 text-white rounded-xl py-3 font-semibold text-sm hover:bg-blue-800 active:scale-95 transition-all disabled:opacity-50 min-h-[48px]"
              >
                {saved ? '✓ Logged!' : saving ? 'Saving...' : 'Log Charging Session'}
              </button>
            </form>
          </Card>

          {/* Charging History */}
          <Card className="p-4">
            <h2 className="text-base font-bold text-gray-800 mb-3">Charging History</h2>
            {chargeLogs.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No charging logs yet.</p>
            ) : (
              <div className="space-y-2">
                {chargeLogs.map(log => (
                  <div key={log.id} className="flex items-start justify-between bg-gray-50 rounded-lg p-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-700">
                        {format(parseISO(log.date), 'MMM d, yyyy')} — {formatTime(log.time)}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {log.batteryBefore !== null ? `Before: ${log.batteryBefore}%` : ''}
                        {log.batteryBefore !== null && log.batteryAfter !== null ? ' → ' : ''}
                        {log.batteryAfter !== null ? `After: ${log.batteryAfter}%` : ''}
                        {log.batteryBefore !== null && log.batteryAfter !== null ? ` (+${Math.max(0, log.batteryAfter - log.batteryBefore)}%)` : ''}
                      </p>
                      {log.notes && <p className="text-xs text-gray-400 italic">{log.notes}</p>}
                    </div>
                    <button onClick={() => deleteChargeLog(log.id)} className="text-red-300 hover:text-red-500 p-1 text-lg">×</button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
