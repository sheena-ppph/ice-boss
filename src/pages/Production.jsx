import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import db from '../db/database';
import Card from '../components/ui/Card';

const MAX_CAPACITY = { '5kg': 24, '2kg': 10, '1kg': 10 };
const MAX_CAPACITY_2 = { '5kg': 0, '2kg': 0, '1kg': 0 }; // 2nd freezer - TBD

function timeToMinutes(t) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function calcDuration(start, stop) {
  if (!start || !stop) return null;
  let diff = timeToMinutes(stop) - timeToMinutes(start);
  if (diff < 0) diff += 24 * 60; // overnight
  return diff; // in minutes
}

function formatDuration(minutes) {
  if (minutes === null || minutes === undefined) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${m} ${ampm}`;
}

export default function Production() {
  const [form, setForm] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    machineStart: '',
    machineStop: '',
    firstDropMins: '',
    firstDropKilos: '',
    bags5kg: '',
    bags2kg: '',
    bags1kg: '',
    notes: '',
  });
  const [todayLogs, setTodayLogs] = useState([]);
  const [allLogs, setAllLogs] = useState([]);
  const [freezerStock, setFreezerStock] = useState({ bags5kg: 0, bags2kg: 0, bags1kg: 0 });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [freezer2Cap, setFreezer2Cap] = useState({ bags5kg: 0, bags2kg: 0, bags1kg: 0 });
  const [editFreezer2, setEditFreezer2] = useState(false);
  const [freezer2Input, setFreezer2Input] = useState({ bags5kg: '', bags2kg: '', bags1kg: '' });

  useEffect(() => {
    loadData();
    const saved2 = localStorage.getItem('freezer2Cap');
    if (saved2) setFreezer2Cap(JSON.parse(saved2));
  }, []);

  async function loadData() {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const logs = await db.production.orderBy('date').reverse().toArray();
    setAllLogs(logs);
    setTodayLogs(logs.filter(l => l.date === todayStr));

    const allSales = await db.sales.toArray();
    const totalProd = logs.reduce((acc, p) => ({
      bags5kg: acc.bags5kg + (p.bags5kg || 0),
      bags2kg: acc.bags2kg + (p.bags2kg || 0),
      bags1kg: acc.bags1kg + (p.bags1kg || 0),
    }), { bags5kg: 0, bags2kg: 0, bags1kg: 0 });
    const totalSold = allSales.reduce((acc, s) => ({
      bags5kg: acc.bags5kg + (s.bags5kg || 0),
      bags2kg: acc.bags2kg + (s.bags2kg || 0),
      bags1kg: acc.bags1kg + (s.bags1kg || 0) + (s.free1kg || 0),
    }), { bags5kg: 0, bags2kg: 0, bags1kg: 0 });
    setFreezerStock({
      bags5kg: Math.max(0, totalProd.bags5kg - totalSold.bags5kg),
      bags2kg: Math.max(0, totalProd.bags2kg - totalSold.bags2kg),
      bags1kg: Math.max(0, totalProd.bags1kg - totalSold.bags1kg),
    });
  }

  const duration = calcDuration(form.machineStart, form.machineStop);
  const cycles = (duration !== null && form.firstDropMins && parseInt(form.firstDropMins) > 0)
    ? Math.floor(duration / parseInt(form.firstDropMins))
    : null;
  const estimatedKilos = (cycles !== null && form.firstDropKilos && parseFloat(form.firstDropKilos) > 0)
    ? Math.round(cycles * parseFloat(form.firstDropKilos) * 10) / 10
    : null;
  const packedKilos = (parseInt(form.bags5kg) || 0) * 5
    + (parseInt(form.bags2kg) || 0) * 2
    + (parseInt(form.bags1kg) || 0) * 1;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.bags5kg && !form.bags2kg && !form.bags1kg) return;
    setSaving(true);
    await db.production.add({
      date: form.date,
      machineStart: form.machineStart || null,
      machineStop: form.machineStop || null,
      machineDuration: duration,
      firstDropMins: parseInt(form.firstDropMins) || null,
      firstDropKilos: parseFloat(form.firstDropKilos) || null,
      cycles: cycles,
      bags5kg: parseInt(form.bags5kg) || 0,
      bags2kg: parseInt(form.bags2kg) || 0,
      bags1kg: parseInt(form.bags1kg) || 0,
      notes: form.notes,
    });
    setForm(f => ({
      ...f,
      machineStart: '',
      machineStop: '',
      firstDropMins: '',
      firstDropKilos: '',
      bags5kg: '',
      bags2kg: '',
      bags1kg: '',
      notes: '',
    }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setSaving(false);
    loadData();
  }

  async function deleteLog(id) {
    if (!confirm('Delete this production entry?')) return;
    await db.production.delete(id);
    loadData();
  }

  const todayTotal = todayLogs.reduce((acc, l) => ({
    bags5kg: acc.bags5kg + (l.bags5kg || 0),
    bags2kg: acc.bags2kg + (l.bags2kg || 0),
    bags1kg: acc.bags1kg + (l.bags1kg || 0),
  }), { bags5kg: 0, bags2kg: 0, bags1kg: 0 });

  const totalStockBags = freezerStock.bags5kg + freezerStock.bags2kg + freezerStock.bags1kg;
  const maxBags = MAX_CAPACITY['5kg'] + MAX_CAPACITY['2kg'] + MAX_CAPACITY['1kg'];
  const stockPct = Math.min(100, Math.round((totalStockBags / maxBags) * 100));
  const stockColor = stockPct >= 60 ? 'bg-green-500' : stockPct >= 30 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="page-content p-4 space-y-4">
      {/* Log Production Form */}
      <Card className="p-4">
        <h2 className="text-base font-bold text-gray-800 mb-4">Log Production</h2>
        <form onSubmit={handleSubmit} className="space-y-3">

          {/* Date */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Machine Times */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Machine Runtime</label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Start</label>
                <input
                  type="time"
                  value={form.machineStart}
                  onChange={e => setForm(f => ({ ...f, machineStart: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Stop</label>
                <input
                  type="time"
                  value={form.machineStop}
                  onChange={e => setForm(f => ({ ...f, machineStop: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            {/* Duration display */}
            {duration !== null && (
              <div className="mt-2 bg-blue-50 rounded-lg px-3 py-2 flex items-center justify-between">
                <span className="text-xs text-blue-600 font-medium">Total Runtime</span>
                <span className="text-sm font-bold text-blue-800">{formatDuration(duration)}</span>
              </div>
            )}
          </div>

          {/* 1st Drop */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">1st Drop</label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Duration (minutes)</label>
                <input
                  type="number"
                  min="1"
                  placeholder="e.g. 45"
                  value={form.firstDropMins}
                  onChange={e => setForm(f => ({ ...f, firstDropMins: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Output (kilos)</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="e.g. 25"
                  value={form.firstDropKilos}
                  onChange={e => setForm(f => ({ ...f, firstDropKilos: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                />
              </div>
            </div>
            {/* Cycles + Total Kilos display */}
            {cycles !== null && (
              <div className="mt-2 space-y-1">
                <div className="bg-green-50 rounded-lg px-3 py-2 flex items-center justify-between">
                  <span className="text-xs text-green-600 font-medium">Estimated Cycles</span>
                  <span className="text-sm font-bold text-green-800">{cycles} cycles</span>
                </div>
                {estimatedKilos !== null && (
                  <div className="bg-green-100 rounded-lg px-3 py-2 flex items-center justify-between">
                    <span className="text-xs text-green-700 font-medium">Expected Total Kilos</span>
                    <span className="text-sm font-bold text-green-900">{estimatedKilos} kg</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bags Produced */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Bags Produced</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'bags5kg', label: '5kg' },
                { key: 'bags2kg', label: '2kg' },
                { key: 'bags1kg', label: '1kg' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs text-gray-400 mb-1 text-center">{label}</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Tally check */}
          {estimatedKilos !== null && packedKilos > 0 && (
            <div className={`rounded-lg px-3 py-2.5 ${
              packedKilos === estimatedKilos
                ? 'bg-green-50 border border-green-200'
                : Math.abs(packedKilos - estimatedKilos) <= estimatedKilos * 0.05
                  ? 'bg-yellow-50 border border-yellow-200'
                  : 'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700">Tally Check</span>
                <span className={`text-xs font-bold ${
                  packedKilos === estimatedKilos ? 'text-green-700'
                  : Math.abs(packedKilos - estimatedKilos) <= estimatedKilos * 0.05 ? 'text-yellow-700'
                  : 'text-red-700'
                }`}>
                  {packedKilos === estimatedKilos ? '✓ Exact match' :
                    packedKilos > estimatedKilos
                      ? `+${Math.round((packedKilos - estimatedKilos) * 10) / 10} kg over`
                      : `${Math.round((packedKilos - estimatedKilos) * 10) / 10} kg short`}
                </span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-gray-500">Expected: <b>{estimatedKilos} kg</b></span>
                <span className="text-xs text-gray-500">Packed: <b>{packedKilos} kg</b></span>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Notes (optional)</label>
            <input
              type="text"
              placeholder="e.g. power outage, low water..."
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-blue-700 text-white rounded-xl py-3 font-semibold text-sm hover:bg-blue-800 active:scale-95 transition-all disabled:opacity-50 min-h-[48px]"
          >
            {saved ? '✓ Saved!' : saving ? 'Saving...' : 'Log Production'}
          </button>
        </form>
      </Card>

      {/* Freezer Stock */}
      <Card className="p-4">
        <h2 className="text-base font-bold text-gray-800 mb-3">Freezer Stock</h2>
        <div className="flex items-center gap-3 mb-1">
          <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${stockColor}`} style={{ width: `${stockPct}%` }} />
          </div>
          <span className="text-sm font-bold text-gray-700">{stockPct}%</span>
        </div>
        {/* Freezer 1 */}
        <p className="text-xs font-semibold text-gray-400 mb-1 mt-2">Chest Freezer 1</p>
        <div className="grid grid-cols-3 gap-3 mb-3">
          {[
            { key: 'bags5kg', label: '5kg', max: MAX_CAPACITY['5kg'] },
            { key: 'bags2kg', label: '2kg', max: MAX_CAPACITY['2kg'] },
            { key: 'bags1kg', label: '1kg', max: MAX_CAPACITY['1kg'] },
          ].map(({ key, label, max }) => {
            const val = freezerStock[key];
            const pct = Math.min(100, Math.round((val / max) * 100));
            const col = pct >= 60 ? 'text-green-600' : pct >= 30 ? 'text-yellow-600' : 'text-red-600';
            return (
              <div key={key} className="text-center bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 font-medium">{label}</p>
                <p className={`text-2xl font-bold ${col}`}>{val}</p>
                <p className="text-xs text-gray-400">/ {max}</p>
              </div>
            );
          })}
        </div>
        {/* Freezer 2 */}
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-semibold text-gray-400">Chest Freezer 2 (Small)</p>
          <button onClick={() => { setFreezer2Input({ bags5kg: String(freezer2Cap.bags5kg), bags2kg: String(freezer2Cap.bags2kg), bags1kg: String(freezer2Cap.bags1kg) }); setEditFreezer2(!editFreezer2); }}
            className="text-xs text-blue-600 font-medium">
            {editFreezer2 ? 'Cancel' : 'Set Capacity'}
          </button>
        </div>
        {editFreezer2 && (
          <div className="mb-2 bg-blue-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-2">Set max bags per size:</p>
            <div className="grid grid-cols-3 gap-2 mb-2">
              {[{k:'bags5kg',l:'5kg'},{k:'bags2kg',l:'2kg'},{k:'bags1kg',l:'1kg'}].map(({k,l}) => (
                <div key={k}>
                  <label className="block text-xs text-gray-400 mb-1 text-center">{l}</label>
                  <input type="number" min="0" placeholder="0" value={freezer2Input[k]}
                    onChange={e => setFreezer2Input(f => ({...f, [k]: e.target.value}))}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              ))}
            </div>
            <button onClick={() => {
              const cap = { bags5kg: parseInt(freezer2Input.bags5kg)||0, bags2kg: parseInt(freezer2Input.bags2kg)||0, bags1kg: parseInt(freezer2Input.bags1kg)||0 };
              setFreezer2Cap(cap);
              localStorage.setItem('freezer2Cap', JSON.stringify(cap));
              setEditFreezer2(false);
            }} className="w-full py-2 bg-blue-700 text-white rounded-lg text-xs font-semibold">Save</button>
          </div>
        )}
        {(freezer2Cap.bags5kg + freezer2Cap.bags2kg + freezer2Cap.bags1kg) === 0 ? (
          <p className="text-xs text-gray-400 italic text-center py-2 bg-gray-50 rounded-lg">Capacity not set yet — tap "Set Capacity" when ready</p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {[{key:'bags5kg',label:'5kg'},{key:'bags2kg',label:'2kg'},{key:'bags1kg',label:'1kg'}].map(({key,label}) => (
              <div key={key} className="text-center bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 font-medium">{label}</p>
                <p className="text-xs text-gray-400">/ {freezer2Cap[key]}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Today's Logs */}
      {todayLogs.length > 0 && (
        <Card className="p-4">
          <h2 className="text-base font-bold text-gray-800 mb-1">Today's Production</h2>
          <p className="text-xs text-gray-500 mb-3">
            Total: {todayTotal.bags5kg + todayTotal.bags2kg + todayTotal.bags1kg} bags
            ({todayTotal.bags5kg}×5kg, {todayTotal.bags2kg}×2kg, {todayTotal.bags1kg}×1kg)
          </p>
          <div className="space-y-2">
            {todayLogs.map(log => (
              <div key={log.id} className="bg-blue-50 rounded-lg p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Machine times row */}
                    {(log.machineStart || log.machineStop) && (
                      <div className="flex gap-3 mb-1">
                        {log.machineStart && (
                          <span className="text-xs text-blue-700 font-medium">
                            Start: {formatTime(log.machineStart)}
                          </span>
                        )}
                        {log.machineStop && (
                          <span className="text-xs text-blue-700 font-medium">
                            Stop: {formatTime(log.machineStop)}
                          </span>
                        )}
                        {log.machineDuration != null && (
                          <span className="text-xs font-bold text-blue-800">
                            ({formatDuration(log.machineDuration)})
                          </span>
                        )}
                      </div>
                    )}
                    {/* 1st drop + cycles + expected kilos */}
                    {(log.firstDropMins || log.cycles != null) && (
                      <div className="flex flex-wrap gap-2 mb-1 items-center">
                        {log.firstDropMins && (
                          <span className="text-xs text-green-700">
                            1st Drop: {log.firstDropMins}min{log.firstDropKilos ? ` / ${log.firstDropKilos}kg` : ''}
                          </span>
                        )}
                        {log.cycles != null && (
                          <span className="text-xs font-semibold text-green-800">
                            {log.cycles} cycles
                          </span>
                        )}
                        {log.cycles != null && log.firstDropKilos && (
                          <span className="text-xs font-bold text-blue-700">
                            = {Math.round(log.cycles * log.firstDropKilos * 10) / 10} kg expected
                          </span>
                        )}
                      </div>
                    )}
                    {/* Bags + packed kilos */}
                    <p className="text-xs text-gray-600">
                      5kg: {log.bags5kg} · 2kg: {log.bags2kg} · 1kg: {log.bags1kg}
                      {' '}
                      <span className="font-semibold text-gray-700">
                        = {(log.bags5kg||0)*5 + (log.bags2kg||0)*2 + (log.bags1kg||0)} kg packed
                      </span>
                    </p>
                    {log.notes && <p className="text-xs text-gray-500 mt-0.5 italic">{log.notes}</p>}
                  </div>
                  <button
                    onClick={() => deleteLog(log.id)}
                    className="text-red-400 hover:text-red-600 p-1 text-lg ml-2"
                  >×</button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* History */}
      <Card className="p-4">
        <h2 className="text-base font-bold text-gray-800 mb-3">History</h2>
        {allLogs.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No production logs yet.</p>
        ) : (
          <div className="space-y-2">
            {allLogs.filter(l => l.date !== format(new Date(), 'yyyy-MM-dd')).slice(0, 20).map(log => (
              <div key={log.id} className="border-b border-gray-50 pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-700">
                      {format(parseISO(log.date), 'MMM d, yyyy')}
                    </p>
                    {(log.machineStart || log.machineDuration != null) && (
                      <p className="text-xs text-gray-500">
                        {log.machineStart && `${formatTime(log.machineStart)} – ${formatTime(log.machineStop)}`}
                        {log.machineDuration != null && ` · ${formatDuration(log.machineDuration)}`}
                        {log.cycles != null && ` · ${log.cycles} cycles`}
                      </p>
                    )}
                    <p className="text-xs text-gray-500">
                      5kg: {log.bags5kg} · 2kg: {log.bags2kg} · 1kg: {log.bags1kg}
                    </p>
                    {log.notes && <p className="text-xs text-gray-400 italic">{log.notes}</p>}
                  </div>
                  <button
                    onClick={() => deleteLog(log.id)}
                    className="text-red-300 hover:text-red-500 p-1 ml-2"
                  >×</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
