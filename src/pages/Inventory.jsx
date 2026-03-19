import { useState, useEffect } from 'react';
import { format, parseISO, differenceInDays } from 'date-fns';
import db from '../db/database';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';

export default function Inventory() {
  const [tab, setTab] = useState('bags');
  const [bags, setBags] = useState([]);
  const [coolers, setCoolers] = useState([]);
  const [supplies, setSupplies] = useState([]);

  // Bags state
  const [customPacks, setCustomPacks] = useState({});
  const [showCustomInput, setShowCustomInput] = useState({});

  // Coolers state
  const [showAddCooler, setShowAddCooler] = useState(false);
  const [showEditCooler, setShowEditCooler] = useState(null);
  const [newCooler, setNewCooler] = useState({ label: '', size: 'mid', status: 'available', borrower: '', dateOut: '' });

  // Supplies state
  const [showAddSupply, setShowAddSupply] = useState(false);
  const [editSupply, setEditSupply] = useState(null);
  const [supplyForm, setSupplyForm] = useState({ category: '', name: '', quantity: '', unit: 'pcs', notes: '' });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const bagInv = await db.bagInventory.toArray();
    setBags(bagInv);
    const coolerList = await db.coolers.orderBy('id').toArray();
    setCoolers(coolerList);
    const supplyList = await db.supplies.orderBy('category').toArray();
    setSupplies(supplyList);
  }

  // ── Bags ──────────────────────────────────────────────
  async function adjustPacks(bagId, delta) {
    const bag = await db.bagInventory.get(bagId);
    const newCount = Math.max(0, (bag.packsCount || 0) + delta);
    await db.bagInventory.update(bagId, { packsCount: newCount, lastUpdated: new Date().toISOString() });
    loadData();
  }

  async function setPacksCustom(bagId, count) {
    await db.bagInventory.update(bagId, { packsCount: Math.max(0, parseInt(count) || 0), lastUpdated: new Date().toISOString() });
    setShowCustomInput(s => ({ ...s, [bagId]: false }));
    loadData();
  }

  // ── Coolers ──────────────────────────────────────────
  async function updateCoolerStatus(coolerId, newStatus, borrower, dateOut) {
    const updates = { status: newStatus };
    if (borrower !== undefined) updates.borrower = borrower || null;
    if (dateOut !== undefined) updates.dateOut = dateOut || null;
    if (newStatus === 'available' || newStatus === 'ebike') {
      updates.borrower = null;
      updates.dateOut = null;
    }
    await db.coolers.update(coolerId, updates);
    setShowEditCooler(null);
    loadData();
  }

  async function addCooler() {
    if (!newCooler.label) return;
    await db.coolers.add({
      label: newCooler.label,
      size: newCooler.size,
      status: newCooler.status,
      borrower: newCooler.borrower || null,
      dateOut: newCooler.dateOut || null,
    });
    setNewCooler({ label: '', size: 'mid', status: 'available', borrower: '', dateOut: '' });
    setShowAddCooler(false);
    loadData();
  }

  async function deleteCooler(id) {
    if (!confirm('Delete this cooler?')) return;
    await db.coolers.delete(id);
    loadData();
  }

  // ── Supplies ──────────────────────────────────────────
  function openAddSupply() {
    setEditSupply(null);
    setSupplyForm({ category: '', name: '', quantity: '', unit: 'pcs', notes: '' });
    setShowAddSupply(true);
  }

  function openEditSupply(s) {
    setEditSupply(s);
    setSupplyForm({ category: s.category, name: s.name, quantity: String(s.quantity ?? ''), unit: s.unit || 'pcs', notes: s.notes || '' });
    setShowAddSupply(true);
  }

  async function saveSupply() {
    if (!supplyForm.name) return;
    const data = {
      category: supplyForm.category || 'General',
      name: supplyForm.name,
      quantity: parseFloat(supplyForm.quantity) || 0,
      unit: supplyForm.unit || 'pcs',
      notes: supplyForm.notes,
    };
    if (editSupply) {
      await db.supplies.update(editSupply.id, data);
    } else {
      await db.supplies.add(data);
    }
    setShowAddSupply(false);
    setEditSupply(null);
    loadData();
  }

  async function adjustSupplyQty(supplyId, delta) {
    const item = await db.supplies.get(supplyId);
    const newQty = Math.max(0, (item.quantity || 0) + delta);
    await db.supplies.update(supplyId, { quantity: newQty });
    loadData();
  }

  async function deleteSupply(id) {
    if (!confirm('Delete this supply item?')) return;
    await db.supplies.delete(id);
    loadData();
  }

  // ── Grouped coolers ───────────────────────────────────
  const grouped = {
    ebike: coolers.filter(c => c.status === 'ebike'),
    out: coolers.filter(c => c.status === 'out'),
    collect: coolers.filter(c => c.status === 'collect'),
    available: coolers.filter(c => c.status === 'available'),
  };

  function statusBadge(status) {
    const map = {
      ebike: ['blue', '⚡ On Ebike'],
      out: ['yellow', '📤 On Loan'],
      collect: ['red', '🔴 Collect'],
      available: ['green', '✓ Available'],
    };
    const [variant, label] = map[status] || ['gray', status];
    return <Badge variant={variant}>{label}</Badge>;
  }

  // ── Grouped supplies ──────────────────────────────────
  const supplyGroups = supplies.reduce((acc, s) => {
    const cat = s.category || 'General';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  const tabs = [
    { key: 'bags', label: '🛍️ Bags' },
    { key: 'coolers', label: '❄️ Coolers' },
    { key: 'supplies', label: '📦 Supplies' },
  ];

  return (
    <div className="page-content p-4 space-y-4">
      {/* Tab Toggle */}
      <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all min-h-[44px] ${
              tab === t.key ? 'bg-white shadow text-blue-700' : 'text-gray-500'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── BAGS TAB ── */}
      {tab === 'bags' && (
        <div className="space-y-3">
          {bags.map(b => {
            const pct = Math.min(100, (b.packsCount / 5) * 100);
            const color = b.packsCount >= 3 ? 'bg-green-500' : b.packsCount === 2 ? 'bg-yellow-500' : 'bg-red-500';
            const textColor = b.packsCount >= 3 ? 'text-green-700' : b.packsCount === 2 ? 'text-yellow-700' : 'text-red-700';
            const bgColor = b.packsCount <= 1 ? 'bg-red-50 border-red-200' : '';
            return (
              <Card key={b.id} className={`p-4 border ${bgColor}`}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-base font-bold text-gray-800">{b.size} Bags</h3>
                    <p className="text-xs text-gray-400">
                      Updated: {b.lastUpdated ? format(new Date(b.lastUpdated), 'MMM d, h:mm a') : 'N/A'}
                    </p>
                  </div>
                  <span className={`text-3xl font-bold ${textColor}`}>{b.packsCount}</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-3">
                  <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
                </div>
                {b.packsCount <= 1 && (
                  <p className="text-xs font-semibold text-red-600 mb-2">⚠️ Order more {b.size} bags now!</p>
                )}
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => adjustPacks(b.id, -1)} className="flex-1 py-2 bg-red-50 text-red-700 rounded-lg text-sm font-semibold border border-red-100 min-h-[44px] hover:bg-red-100">
                    − Used 1 Pack
                  </button>
                  <button onClick={() => adjustPacks(b.id, 1)} className="py-2 px-3 bg-green-50 text-green-700 rounded-lg text-sm font-semibold border border-green-100 min-h-[44px] hover:bg-green-100">+1</button>
                  <button onClick={() => adjustPacks(b.id, 5)} className="py-2 px-3 bg-blue-50 text-blue-700 rounded-lg text-sm font-semibold border border-blue-100 min-h-[44px] hover:bg-blue-100">+5</button>
                  <button onClick={() => setShowCustomInput(s => ({ ...s, [b.id]: !s[b.id] }))} className="py-2 px-3 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold min-h-[44px] hover:bg-gray-200">Set</button>
                </div>
                {showCustomInput[b.id] && (
                  <div className="mt-2 flex gap-2">
                    <input
                      type="number" min="0" placeholder="# packs"
                      value={customPacks[b.id] || ''}
                      onChange={e => setCustomPacks(s => ({ ...s, [b.id]: e.target.value }))}
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button onClick={() => setPacksCustom(b.id, customPacks[b.id])} className="px-4 py-2 bg-blue-700 text-white rounded-lg text-sm font-semibold min-h-[44px]">OK</button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* ── COOLERS TAB ── */}
      {tab === 'coolers' && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { key: 'ebike', label: 'Ebike', color: 'text-blue-600', bg: 'bg-blue-50' },
              { key: 'out', label: 'Out', color: 'text-yellow-700', bg: 'bg-yellow-50' },
              { key: 'collect', label: 'Collect', color: 'text-red-600', bg: 'bg-red-50' },
              { key: 'available', label: 'Available', color: 'text-green-600', bg: 'bg-green-50' },
            ].map(g => (
              <div key={g.key} className={`${g.bg} rounded-lg p-2 text-center`}>
                <p className={`text-2xl font-bold ${g.color}`}>{grouped[g.key].length}</p>
                <p className="text-xs text-gray-500">{g.label}</p>
              </div>
            ))}
          </div>

          <button onClick={() => setShowAddCooler(!showAddCooler)} className="w-full py-3 bg-blue-700 text-white rounded-xl text-sm font-semibold hover:bg-blue-800 min-h-[48px]">
            + Add New Cooler
          </button>

          {showAddCooler && (
            <Card className="p-4">
              <h3 className="text-sm font-bold text-gray-800 mb-3">Add Cooler</h3>
              <div className="space-y-2">
                <input type="text" placeholder="Label (e.g. Cooler #12)" value={newCooler.label}
                  onChange={e => setNewCooler(n => ({ ...n, label: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <select value={newCooler.size} onChange={e => setNewCooler(n => ({ ...n, size: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="long">Long</option>
                  <option value="mid">Mid</option>
                  <option value="redPlastic">Red Plastic</option>
                  <option value="other">Other</option>
                </select>
                <select value={newCooler.status} onChange={e => setNewCooler(n => ({ ...n, status: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="available">Available</option>
                  <option value="ebike">On Ebike</option>
                  <option value="out">Out on Loan</option>
                  <option value="collect">To Collect</option>
                </select>
                {(newCooler.status === 'out' || newCooler.status === 'collect') && (
                  <input type="text" placeholder="Borrower name" value={newCooler.borrower}
                    onChange={e => setNewCooler(n => ({ ...n, borrower: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                )}
                <div className="flex gap-2">
                  <button onClick={addCooler} className="flex-1 py-2.5 bg-blue-700 text-white rounded-lg text-sm font-semibold min-h-[44px]">Add Cooler</button>
                  <button onClick={() => setShowAddCooler(false)} className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-semibold min-h-[44px]">Cancel</button>
                </div>
              </div>
            </Card>
          )}

          {[
            { key: 'collect', label: 'To Collect', icon: '🔴' },
            { key: 'out', label: 'Out on Loan', icon: '📤' },
            { key: 'ebike', label: 'On Ebike', icon: '⚡' },
            { key: 'available', label: 'Available', icon: '✓' },
          ].map(group => (
            grouped[group.key].length > 0 && (
              <Card key={group.key} className="p-4">
                <h3 className="text-sm font-bold text-gray-700 mb-3">{group.icon} {group.label} ({grouped[group.key].length})</h3>
                <div className="space-y-2">
                  {grouped[group.key].map(cooler => (
                    <div key={cooler.id}>
                      <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{cooler.label}</p>
                          <p className="text-xs text-gray-500 capitalize">
                            {cooler.size === 'redPlastic' ? 'Red Plastic' : cooler.size}
                            {cooler.borrower ? ` — ${cooler.borrower}` : ''}
                          </p>
                          {cooler.dateOut && (
                            <p className="text-xs text-gray-400">
                              Out since: {format(parseISO(cooler.dateOut), 'MMM d')} ({differenceInDays(new Date(), parseISO(cooler.dateOut))} days)
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {statusBadge(cooler.status)}
                          <button onClick={() => setShowEditCooler(showEditCooler === cooler.id ? null : cooler.id)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg text-xs font-medium min-h-[44px] ml-1">
                            Edit
                          </button>
                        </div>
                      </div>
                      {showEditCooler === cooler.id && (
                        <div className="bg-white border border-gray-200 rounded-lg p-3 mt-1 space-y-2">
                          <p className="text-xs font-semibold text-gray-600">Update Status:</p>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { status: 'available', label: '✓ Available' },
                              { status: 'ebike', label: '⚡ On Ebike' },
                              { status: 'out', label: '📤 Out on Loan' },
                              { status: 'collect', label: '🔴 To Collect' },
                            ].map(opt => (
                              <button key={opt.status}
                                onClick={() => {
                                  if (opt.status === 'out' || opt.status === 'collect') {
                                    const borrower = prompt('Borrower name?', cooler.borrower || '');
                                    if (borrower !== null) updateCoolerStatus(cooler.id, opt.status, borrower, format(new Date(), 'yyyy-MM-dd'));
                                  } else {
                                    updateCoolerStatus(cooler.id, opt.status);
                                  }
                                }}
                                className={`py-2 rounded-lg text-xs font-semibold border min-h-[44px] ${
                                  cooler.status === opt.status ? 'bg-blue-700 text-white border-blue-700' : 'bg-gray-50 text-gray-700 border-gray-200'
                                }`}>
                                {opt.label}
                              </button>
                            ))}
                          </div>
                          <button onClick={() => deleteCooler(cooler.id)} className="w-full py-2 bg-red-50 text-red-600 rounded-lg text-xs font-semibold border border-red-100">
                            Delete Cooler
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )
          ))}
        </div>
      )}

      {/* ── SUPPLIES TAB ── */}
      {tab === 'supplies' && (
        <div className="space-y-4">
          <button onClick={openAddSupply} className="w-full py-3 bg-blue-700 text-white rounded-xl text-sm font-semibold hover:bg-blue-800 min-h-[48px]">
            + Add Supply Item
          </button>

          {/* Add / Edit Form */}
          {showAddSupply && (
            <Card className="p-4">
              <h3 className="text-sm font-bold text-gray-800 mb-3">{editSupply ? 'Edit Item' : 'Add Supply Item'}</h3>
              <div className="space-y-2">
                <input type="text" placeholder="Category (e.g. Filters, Office, Cleaning)"
                  value={supplyForm.category}
                  onChange={e => setSupplyForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <input type="text" placeholder="Item name (e.g. Water Filter, Notebook)"
                  value={supplyForm.name}
                  onChange={e => setSupplyForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" min="0" placeholder="Quantity"
                    value={supplyForm.quantity}
                    onChange={e => setSupplyForm(f => ({ ...f, quantity: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <input type="text" placeholder="Unit (pcs, rolls, set...)"
                    value={supplyForm.unit}
                    onChange={e => setSupplyForm(f => ({ ...f, unit: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <input type="text" placeholder="Notes (optional)"
                  value={supplyForm.notes}
                  onChange={e => setSupplyForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <div className="flex gap-2">
                  <button onClick={saveSupply} className="flex-1 py-2.5 bg-blue-700 text-white rounded-lg text-sm font-semibold min-h-[44px]">
                    {editSupply ? 'Save Changes' : 'Add Item'}
                  </button>
                  <button onClick={() => { setShowAddSupply(false); setEditSupply(null); }} className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-semibold min-h-[44px]">
                    Cancel
                  </button>
                </div>
              </div>
            </Card>
          )}

          {/* Supplies grouped by category */}
          {Object.keys(supplyGroups).length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-sm text-gray-400">No supply items yet. Add your first item above.</p>
            </Card>
          ) : (
            Object.entries(supplyGroups).map(([category, items]) => (
              <Card key={category} className="p-4">
                <h3 className="text-sm font-bold text-gray-700 mb-3">📦 {category}</h3>
                <div className="space-y-2">
                  {items.map(item => (
                    <div key={item.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-800">{item.name}</p>
                        {item.notes && <p className="text-xs text-gray-400 italic">{item.notes}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => adjustSupplyQty(item.id, -1)} className="w-8 h-8 bg-red-50 text-red-600 rounded-lg text-lg font-bold flex items-center justify-center hover:bg-red-100">−</button>
                        <span className="text-base font-bold text-gray-800 w-12 text-center">
                          {item.quantity} <span className="text-xs font-normal text-gray-400">{item.unit}</span>
                        </span>
                        <button onClick={() => adjustSupplyQty(item.id, 1)} className="w-8 h-8 bg-green-50 text-green-600 rounded-lg text-lg font-bold flex items-center justify-center hover:bg-green-100">+</button>
                        <button onClick={() => openEditSupply(item)} className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg text-xs font-semibold flex items-center justify-center hover:bg-blue-100">✏️</button>
                        <button onClick={() => deleteSupply(item.id)} className="w-8 h-8 bg-gray-100 text-red-400 rounded-lg text-xs font-semibold flex items-center justify-center hover:bg-red-50">×</button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
