import { useState, useEffect } from 'react';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isToday, differenceInMinutes } from 'date-fns';
import db from '../db/database';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Attendance() {
  const [records, setRecords] = useState([]);
  const [viewMonth, setViewMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [showForm, setShowForm] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [form, setForm] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    timeIn: '14:00',
    timeOut: '17:00',
    status: 'present',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { loadData(); }, [viewMonth]);

  async function loadData() {
    const [year, month] = viewMonth.split('-').map(Number);
    const mStart = format(startOfMonth(new Date(year, month - 1)), 'yyyy-MM-dd');
    const mEnd = format(endOfMonth(new Date(year, month - 1)), 'yyyy-MM-dd');
    const recs = await db.attendance.where('date').between(mStart, mEnd, true, true).toArray();
    setRecords(recs);
  }

  function calcHours(timeIn, timeOut) {
    if (!timeIn || !timeOut) return null;
    const [h1, m1] = timeIn.split(':').map(Number);
    const [h2, m2] = timeOut.split(':').map(Number);
    const mins = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (mins <= 0) return null;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
  }

  function calcHoursNum(timeIn, timeOut) {
    if (!timeIn || !timeOut) return 0;
    const [h1, m1] = timeIn.split(':').map(Number);
    const [h2, m2] = timeOut.split(':').map(Number);
    const mins = (h2 * 60 + m2) - (h1 * 60 + m1);
    return Math.max(0, mins / 60);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    if (editRecord) {
      await db.attendance.update(editRecord.id, {
        timeIn: form.timeIn,
        timeOut: form.timeOut,
        status: form.status,
        notes: form.notes,
      });
    } else {
      // Check if record exists for this date
      const existing = records.find(r => r.date === form.date);
      if (existing) {
        await db.attendance.update(existing.id, {
          timeIn: form.timeIn,
          timeOut: form.timeOut,
          status: form.status,
          notes: form.notes,
        });
      } else {
        await db.attendance.add({
          date: form.date,
          timeIn: form.timeIn,
          timeOut: form.timeOut,
          status: form.status,
          notes: form.notes,
        });
      }
    }
    setShowForm(false);
    setEditRecord(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setSaving(false);
    loadData();
  }

  function openFormForDate(dateStr) {
    const existing = records.find(r => r.date === dateStr);
    if (existing) {
      setEditRecord(existing);
      setForm({
        date: existing.date,
        timeIn: existing.timeIn || '14:00',
        timeOut: existing.timeOut || '17:00',
        status: existing.status || 'present',
        notes: existing.notes || '',
      });
    } else {
      setEditRecord(null);
      setForm({
        date: dateStr,
        timeIn: '14:00',
        timeOut: '17:00',
        status: 'present',
        notes: '',
      });
    }
    setShowForm(true);
  }

  async function deleteRecord(id) {
    if (!confirm('Delete this record?')) return;
    await db.attendance.delete(id);
    loadData();
  }

  function formatTime(t) {
    if (!t) return '—';
    const [h, m] = t.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    return `${hour % 12 || 12}:${m} ${ampm}`;
  }

  // Month days
  const [viewYear, viewMonthNum] = viewMonth.split('-').map(Number);
  const monthStart = startOfMonth(new Date(viewYear, viewMonthNum - 1));
  const monthEnd = endOfMonth(new Date(viewYear, viewMonthNum - 1));
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const recordMap = {};
  records.forEach(r => { recordMap[r.date] = r; });

  // Summary
  const daysPresent = records.filter(r => r.status === 'present').length;
  const daysAbsent = records.filter(r => r.status === 'absent').length;
  const totalHours = records.reduce((acc, r) => acc + calcHoursNum(r.timeIn, r.timeOut), 0);

  function statusBadge(status) {
    if (status === 'present') return <Badge variant="green">Present</Badge>;
    if (status === 'absent') return <Badge variant="red">Absent</Badge>;
    return <Badge variant="gray">Rest</Badge>;
  }

  return (
    <div className="page-content p-4 space-y-4">
      {/* Month selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">Attendance</h2>
        <input
          type="month"
          value={viewMonth}
          onChange={e => setViewMonth(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Monthly Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-green-600">{daysPresent}</p>
          <p className="text-xs text-gray-500">Present</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-red-500">{daysAbsent}</p>
          <p className="text-xs text-gray-500">Absent</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-blue-600">{Math.round(totalHours * 10) / 10}h</p>
          <p className="text-xs text-gray-500">Total Hours</p>
        </Card>
      </div>

      {/* Log Today Button */}
      <button
        onClick={() => openFormForDate(format(new Date(), 'yyyy-MM-dd'))}
        className="w-full py-3 bg-blue-700 text-white rounded-xl text-sm font-semibold hover:bg-blue-800 min-h-[48px]"
      >
        📅 Log Today's Attendance
      </button>

      {/* Attendance Form */}
      {showForm && (
        <Card className="p-4">
          <h3 className="text-sm font-bold text-gray-800 mb-3">
            {editRecord ? 'Edit' : 'Log'} — {format(parseISO(form.date), 'MMMM d, yyyy')}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
              <div className="grid grid-cols-3 gap-2">
                {['present', 'absent', 'rest'].map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, status: s }))}
                    className={`py-2 rounded-lg text-sm font-semibold border-2 capitalize min-h-[44px] ${
                      form.status === s
                        ? s === 'present' ? 'bg-green-600 text-white border-green-600'
                        : s === 'absent' ? 'bg-red-500 text-white border-red-500'
                        : 'bg-gray-500 text-white border-gray-500'
                        : 'bg-white text-gray-600 border-gray-200'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {form.status === 'present' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Time In</label>
                  <input
                    type="time"
                    value={form.timeIn}
                    onChange={e => setForm(f => ({ ...f, timeIn: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Time Out</label>
                  <input
                    type="time"
                    value={form.timeOut}
                    onChange={e => setForm(f => ({ ...f, timeOut: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            {form.status === 'present' && form.timeIn && form.timeOut && (
              <p className="text-xs text-blue-600 font-medium">
                Hours: {calcHours(form.timeIn, form.timeOut) || '—'}
              </p>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Notes (optional)</label>
              <input
                type="text"
                placeholder="e.g. arrived late, left early..."
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-blue-700 text-white rounded-xl py-3 font-semibold text-sm hover:bg-blue-800 disabled:opacity-50 min-h-[48px]"
              >
                {saved ? '✓ Saved!' : saving ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditRecord(null); }}
                className="px-4 bg-gray-100 text-gray-600 rounded-xl font-semibold text-sm min-h-[48px]"
              >
                Cancel
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* Attendance List */}
      <Card className="p-4">
        <h2 className="text-base font-bold text-gray-800 mb-3">
          {format(new Date(viewYear, viewMonthNum - 1), 'MMMM yyyy')}
        </h2>
        <div className="space-y-1">
          {monthDays.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const rec = recordMap[dateStr];
            const dayName = DAY_NAMES[day.getDay()];
            const isCurrentDay = isToday(day);
            return (
              <div
                key={dateStr}
                onClick={() => openFormForDate(dateStr)}
                className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                  isCurrentDay ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50'
                }`}
              >
                <div className="w-14 flex-shrink-0">
                  <p className={`text-sm font-bold ${isCurrentDay ? 'text-blue-700' : 'text-gray-700'}`}>
                    {format(day, 'MMM d')}
                  </p>
                  <p className="text-xs text-gray-400">{dayName}</p>
                </div>
                <div className="flex-1">
                  {rec ? (
                    <div className="flex items-center gap-2">
                      {statusBadge(rec.status)}
                      {rec.status === 'present' && (
                        <span className="text-xs text-gray-500">
                          {formatTime(rec.timeIn)} — {formatTime(rec.timeOut)}
                          {rec.timeIn && rec.timeOut && ` (${calcHours(rec.timeIn, rec.timeOut)})`}
                        </span>
                      )}
                      {rec.notes && <span className="text-xs text-gray-400 italic">{rec.notes}</span>}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-300 italic">Tap to log</span>
                  )}
                </div>
                {rec && (
                  <button
                    onClick={e => { e.stopPropagation(); deleteRecord(rec.id); }}
                    className="text-red-300 hover:text-red-500 p-1"
                  >×</button>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
