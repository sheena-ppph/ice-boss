import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import db from '../db/database';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';

const PRICES = { bags5kg: 45, bags2kg: 20, bags1kg: 10 };

export default function Sales() {
  const [form, setForm] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    time: format(new Date(), 'HH:mm'),
    bags5kg: '',
    bags2kg: '',
    bags1kg: '',
    paymentMethod: 'cash',
    notes: '',
  });
  const [todaySales, setTodaySales] = useState([]);
  const [allSales, setAllSales] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const all = await db.sales.orderBy('date').reverse().toArray();
    setAllSales(all);
    setTodaySales(all.filter(s => s.date === todayStr));
  }

  const calcTotal = () => {
    return (parseInt(form.bags5kg) || 0) * PRICES.bags5kg
      + (parseInt(form.bags2kg) || 0) * PRICES.bags2kg
      + (parseInt(form.bags1kg) || 0) * PRICES.bags1kg;
  };

  async function handleSubmit(e) {
    e.preventDefault();
    const total = calcTotal();
    if (total === 0) return;
    setSaving(true);
    await db.sales.add({
      date: form.date,
      time: form.time,
      bags5kg: parseInt(form.bags5kg) || 0,
      bags2kg: parseInt(form.bags2kg) || 0,
      bags1kg: parseInt(form.bags1kg) || 0,
      totalAmount: total,
      paymentMethod: form.paymentMethod,
      notes: form.notes,
    });
    setForm(f => ({
      ...f,
      bags5kg: '',
      bags2kg: '',
      bags1kg: '',
      notes: '',
      time: format(new Date(), 'HH:mm'),
    }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setSaving(false);
    loadData();
  }

  async function deleteSale(id) {
    if (!confirm('Delete this sale?')) return;
    await db.sales.delete(id);
    loadData();
  }

  function formatTime(t) {
    if (!t) return '';
    const [h, m] = t.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${m} ${ampm}`;
  }

  const todaySummary = todaySales.reduce((acc, s) => ({
    total: acc.total + (s.totalAmount || 0),
    bags5kg: acc.bags5kg + (s.bags5kg || 0),
    bags2kg: acc.bags2kg + (s.bags2kg || 0),
    bags1kg: acc.bags1kg + (s.bags1kg || 0),
    cash: acc.cash + (s.paymentMethod === 'cash' ? s.totalAmount : 0),
    gcash: acc.gcash + (s.paymentMethod === 'gcash' ? s.totalAmount : 0),
  }), { total: 0, bags5kg: 0, bags2kg: 0, bags1kg: 0, cash: 0, gcash: 0 });

  const previewTotal = calcTotal();

  return (
    <div className="page-content p-4 space-y-4">
      {/* Sale Form */}
      <Card className="p-4">
        <h2 className="text-base font-bold text-gray-800 mb-4">Record Sale</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Time</label>
              <input
                type="time"
                value={form.time}
                onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { key: 'bags5kg', label: '5kg (₱45)', price: 45 },
              { key: 'bags2kg', label: '2kg (₱20)', price: 20 },
              { key: 'bags1kg', label: '1kg (₱10)', price: 10 },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 text-center"
                />
              </div>
            ))}
          </div>

          {/* Total preview */}
          {previewTotal > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 flex justify-between items-center">
              <span className="text-sm font-medium text-green-700">Total</span>
              <span className="text-xl font-bold text-green-700">₱{previewTotal.toLocaleString()}</span>
            </div>
          )}

          {/* Payment method */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Payment Method</label>
            <div className="grid grid-cols-2 gap-2">
              {['cash', 'gcash'].map(method => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, paymentMethod: method }))}
                  className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition-all min-h-[44px] ${
                    form.paymentMethod === method
                      ? 'bg-blue-700 text-white border-blue-700'
                      : 'bg-white text-gray-600 border-gray-200'
                  }`}
                >
                  {method === 'cash' ? '💵 Cash' : '📱 GCash'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Notes (optional)</label>
            <input
              type="text"
              placeholder="e.g. Aling Maria, sari-sari..."
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <button
            type="submit"
            disabled={saving || previewTotal === 0}
            className="w-full bg-green-600 text-white rounded-xl py-3 font-semibold text-sm hover:bg-green-700 active:scale-95 transition-all disabled:opacity-50 min-h-[48px]"
          >
            {saved ? '✓ Sale Recorded!' : saving ? 'Saving...' : `Record Sale${previewTotal > 0 ? ` — ₱${previewTotal.toLocaleString()}` : ''}`}
          </button>
        </form>
      </Card>

      {/* Today's Summary */}
      {todaySales.length > 0 && (
        <Card className="p-4">
          <h2 className="text-base font-bold text-gray-800 mb-3">Today's Summary</h2>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">Total Revenue</p>
              <p className="text-2xl font-bold text-green-700">₱{todaySummary.total.toLocaleString()}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">Total Bags</p>
              <p className="text-2xl font-bold text-gray-700">{todaySummary.bags5kg + todaySummary.bags2kg + todaySummary.bags1kg}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-3 text-center text-xs">
            <div className="bg-blue-50 rounded-lg p-2">
              <p className="text-gray-500">5kg</p>
              <p className="font-bold text-blue-700">{todaySummary.bags5kg}</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-2">
              <p className="text-gray-500">2kg</p>
              <p className="font-bold text-blue-700">{todaySummary.bags2kg}</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-2">
              <p className="text-gray-500">1kg</p>
              <p className="font-bold text-blue-700">{todaySummary.bags1kg}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1 text-center text-xs bg-gray-50 rounded-lg p-2">
              <p className="text-gray-500">💵 Cash</p>
              <p className="font-bold">₱{todaySummary.cash.toLocaleString()}</p>
            </div>
            <div className="flex-1 text-center text-xs bg-blue-50 rounded-lg p-2">
              <p className="text-gray-500">📱 GCash</p>
              <p className="font-bold text-blue-600">₱{todaySummary.gcash.toLocaleString()}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Today's Sales List */}
      {todaySales.length > 0 && (
        <Card className="p-4">
          <h2 className="text-base font-bold text-gray-800 mb-3">Today's Sales</h2>
          <div className="space-y-2">
            {todaySales.map(s => (
              <div key={s.id} className="flex items-start justify-between bg-gray-50 rounded-lg p-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-700">{formatTime(s.time)}</span>
                    <Badge variant={s.paymentMethod === 'cash' ? 'gray' : 'blue'}>
                      {s.paymentMethod === 'cash' ? '💵 Cash' : '📱 GCash'}
                    </Badge>
                    <span className="font-bold text-green-700 text-sm">₱{s.totalAmount?.toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {s.bags5kg > 0 ? `5kg×${s.bags5kg} ` : ''}{s.bags2kg > 0 ? `2kg×${s.bags2kg} ` : ''}{s.bags1kg > 0 ? `1kg×${s.bags1kg}` : ''}
                  </p>
                  {s.notes && <p className="text-xs text-gray-400 italic">{s.notes}</p>}
                </div>
                <button onClick={() => deleteSale(s.id)} className="text-red-300 hover:text-red-500 p-1 text-lg">×</button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Historical Sales */}
      <Card className="p-4">
        <h2 className="text-base font-bold text-gray-800 mb-3">Recent Sales History</h2>
        {allSales.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No sales recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {allSales.filter(s => s.date !== format(new Date(), 'yyyy-MM-dd')).slice(0, 30).map(s => (
              <div key={s.id} className="flex items-start justify-between border-b border-gray-50 pb-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-gray-700">{format(parseISO(s.date), 'MMM d')} {formatTime(s.time)}</span>
                    <Badge variant={s.paymentMethod === 'cash' ? 'gray' : 'blue'} className="text-xs">
                      {s.paymentMethod === 'cash' ? 'Cash' : 'GCash'}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500">
                    {s.bags5kg > 0 ? `5kg×${s.bags5kg} ` : ''}{s.bags2kg > 0 ? `2kg×${s.bags2kg} ` : ''}{s.bags1kg > 0 ? `1kg×${s.bags1kg}` : ''}
                  </p>
                  {s.notes && <p className="text-xs text-gray-400 italic">{s.notes}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-green-600 text-sm">₱{s.totalAmount?.toLocaleString()}</span>
                  <button onClick={() => deleteSale(s.id)} className="text-red-300 hover:text-red-500 p-1">×</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
