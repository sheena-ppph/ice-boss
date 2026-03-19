import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, isToday, parseISO, differenceInDays, addDays } from 'date-fns';
import db from '../db/database';
import Card from '../components/ui/Card';
import Alert from '../components/ui/Alert';

const MAX_CAPACITY = { '5kg': 24, '2kg': 10, '1kg': 10 };

export default function Dashboard() {
  const navigate = useNavigate();
  const [todayProduction, setTodayProduction] = useState({ bags5kg: 0, bags2kg: 0, bags1kg: 0 });
  const [todaySales, setTodaySales] = useState({ total: 0, bags5kg: 0, bags2kg: 0, bags1kg: 0 });
  const [freezerStock, setFreezerStock] = useState({ bags5kg: 0, bags2kg: 0, bags1kg: 0 });
  const [bags, setBags] = useState([]);
  const [coolersToCollect, setCoolersToCollect] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [ebikeNext, setEbikeNext] = useState(null);
  const [salaryNext, setSalaryNext] = useState(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    // Today's production
    const prods = await db.production.where('date').equals(todayStr).toArray();
    const tp = prods.reduce((acc, p) => ({
      bags5kg: acc.bags5kg + (p.bags5kg || 0),
      bags2kg: acc.bags2kg + (p.bags2kg || 0),
      bags1kg: acc.bags1kg + (p.bags1kg || 0),
    }), { bags5kg: 0, bags2kg: 0, bags1kg: 0 });
    setTodayProduction(tp);

    // Today's sales
    const salesArr = await db.sales.where('date').equals(todayStr).toArray();
    const ts = salesArr.reduce((acc, s) => ({
      total: acc.total + (s.totalAmount || 0),
      bags5kg: acc.bags5kg + (s.bags5kg || 0),
      bags2kg: acc.bags2kg + (s.bags2kg || 0),
      bags1kg: acc.bags1kg + (s.bags1kg || 0),
    }), { total: 0, bags5kg: 0, bags2kg: 0, bags1kg: 0 });
    setTodaySales(ts);

    // Freezer stock: all production minus all sales
    const allProd = await db.production.toArray();
    const allSales = await db.sales.toArray();
    const totalProd = allProd.reduce((acc, p) => ({
      bags5kg: acc.bags5kg + (p.bags5kg || 0),
      bags2kg: acc.bags2kg + (p.bags2kg || 0),
      bags1kg: acc.bags1kg + (p.bags1kg || 0),
    }), { bags5kg: 0, bags2kg: 0, bags1kg: 0 });
    const totalSold = allSales.reduce((acc, s) => ({
      bags5kg: acc.bags5kg + (s.bags5kg || 0),
      bags2kg: acc.bags2kg + (s.bags2kg || 0),
      bags1kg: acc.bags1kg + (s.bags1kg || 0),
    }), { bags5kg: 0, bags2kg: 0, bags1kg: 0 });
    const stock = {
      bags5kg: Math.max(0, totalProd.bags5kg - totalSold.bags5kg),
      bags2kg: Math.max(0, totalProd.bags2kg - totalSold.bags2kg),
      bags1kg: Math.max(0, totalProd.bags1kg - totalSold.bags1kg),
    };
    setFreezerStock(stock);

    // Bag inventory
    const bagInv = await db.bagInventory.toArray();
    setBags(bagInv);

    // Coolers to collect
    const collect = await db.coolers.where('status').equals('collect').toArray();
    setCoolersToCollect(collect);

    // Ebike next payment
    const ebikePending = await db.ebikePayments.where('status').equals('pending').sortBy('monthNum');
    if (ebikePending.length > 0) setEbikeNext(ebikePending[0]);

    // Salary next payment
    const salaryPending = await db.salaryPayments.where('status').equals('pending').sortBy('periodStart');
    if (salaryPending.length > 0) setSalaryNext(salaryPending[0]);

    // Build alerts
    buildAlerts(bagInv, collect, ebikePending[0] || null, salaryPending[0] || null);
  }

  function buildAlerts(bagInv, collectCoolers, nextEbike, nextSalary) {
    const newAlerts = [];
    const today = new Date();

    // Bag alerts
    bagInv.forEach(b => {
      if (b.packsCount <= 1) {
        newAlerts.push({ type: 'red', msg: `Order ${b.size} bags now! Only ${b.packsCount} pack(s) left.` });
      }
    });

    // Cooler collect alerts
    if (collectCoolers.length > 0) {
      const names = [...new Set(collectCoolers.map(c => c.borrower))].join(', ');
      newAlerts.push({ type: 'orange', msg: `Collect ${collectCoolers.length} cooler(s) from: ${names}` });
    }

    // Ebike payment alert
    if (nextEbike) {
      const dueDate = parseISO(nextEbike.dueDate);
      const daysUntil = differenceInDays(dueDate, today);
      if (daysUntil <= 3 && daysUntil >= -3) {
        newAlerts.push({
          type: 'red',
          msg: `Ebike payment due ${format(dueDate, 'MMM d, yyyy')}! (₱5,750 + grace until ${format(addDays(dueDate, 3), 'MMM d')})`
        });
      }
    }

    // Salary alert
    if (nextSalary) {
      const payDate = parseISO(nextSalary.periodStart);
      const daysUntil = differenceInDays(payDate, today);
      if (daysUntil <= 3) {
        newAlerts.push({
          type: 'orange',
          msg: `Salary due: ₱1,250 for ${format(payDate, 'MMM d')} – ${format(parseISO(nextSalary.periodEnd), 'MMM d')}`
        });
      }
    }

    // Electricity alert: due 6th of each month
    const elecDay = new Date(today.getFullYear(), today.getMonth(), 6);
    const daysToElec = differenceInDays(elecDay, today);
    if (daysToElec >= 0 && daysToElec <= 3) {
      newAlerts.push({ type: 'yellow', msg: `Electricity bill due ${format(elecDay, 'MMM d')}! (~₱2,000)` });
    }

    setAlerts(newAlerts);
  }

  const totalProducedBags = todayProduction.bags5kg + todayProduction.bags2kg + todayProduction.bags1kg;
  const totalStockBags = freezerStock.bags5kg + freezerStock.bags2kg + freezerStock.bags1kg;
  const maxCapacityBags = MAX_CAPACITY['5kg'] + MAX_CAPACITY['2kg'] + MAX_CAPACITY['1kg'];
  const stockPct = maxCapacityBags > 0 ? Math.round((totalStockBags / maxCapacityBags) * 100) : 0;

  const stockColor = stockPct >= 60 ? 'text-green-600' : stockPct >= 30 ? 'text-yellow-600' : 'text-red-600';
  const stockBg = stockPct >= 60 ? 'bg-green-100' : stockPct >= 30 ? 'bg-yellow-100' : 'bg-red-100';
  const stockBarColor = stockPct >= 60 ? 'bg-green-500' : stockPct >= 30 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="page-content p-4 space-y-4">
      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <Alert key={i} variant={a.type}>
              <span className="mr-2">⚠️</span>{a.msg}
            </Alert>
          ))}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Today's Production</p>
          <p className="text-3xl font-bold text-blue-700 mt-1">{totalProducedBags}</p>
          <p className="text-xs text-gray-400 mt-1">bags produced</p>
          <div className="mt-2 space-y-0.5 text-xs text-gray-500">
            <div>5kg: {todayProduction.bags5kg} bags</div>
            <div>2kg: {todayProduction.bags2kg} bags</div>
            <div>1kg: {todayProduction.bags1kg} bags</div>
          </div>
        </Card>

        <Card className="p-4">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Today's Sales</p>
          <p className="text-3xl font-bold text-green-600 mt-1">₱{todaySales.total.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">revenue</p>
          <div className="mt-2 space-y-0.5 text-xs text-gray-500">
            <div>5kg: {todaySales.bags5kg} bags</div>
            <div>2kg: {todaySales.bags2kg} bags</div>
            <div>1kg: {todaySales.bags1kg} bags</div>
          </div>
        </Card>

        <Card className={`p-4 ${stockBg}`}>
          <p className="text-xs text-gray-600 font-medium uppercase tracking-wide">Freezer Stock</p>
          <p className={`text-3xl font-bold mt-1 ${stockColor}`}>{stockPct}%</p>
          <p className="text-xs text-gray-500 mt-1">{totalStockBags} / {maxCapacityBags} bags</p>
          <div className="mt-2 h-2 bg-white/60 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${stockBarColor}`}
              style={{ width: `${Math.min(100, stockPct)}%` }}
            />
          </div>
          <div className="mt-2 space-y-0.5 text-xs text-gray-500">
            <div>5kg: {freezerStock.bags5kg}/{MAX_CAPACITY['5kg']}</div>
            <div>2kg: {freezerStock.bags2kg}/{MAX_CAPACITY['2kg']}</div>
            <div>1kg: {freezerStock.bags1kg}/{MAX_CAPACITY['1kg']}</div>
          </div>
        </Card>

        <Card className="p-4">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Bags to Collect</p>
          <p className="text-3xl font-bold text-orange-600 mt-1">{coolersToCollect.length}</p>
          <p className="text-xs text-gray-400 mt-1">coolers out</p>
          {coolersToCollect.length > 0 && (
            <div className="mt-2 space-y-0.5 text-xs text-gray-500">
              {[...new Set(coolersToCollect.map(c => c.borrower))].map(b => (
                <div key={b}>• {b}</div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="p-4">
        <h2 className="text-sm font-semibold text-gray-600 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => navigate('/production')}
            className="flex flex-col items-center gap-1.5 p-3 bg-blue-600 text-white rounded-xl min-h-[72px] hover:bg-blue-700 active:scale-95 transition-all"
          >
            <span className="text-2xl">🏭</span>
            <span className="text-xs font-semibold">+ Production</span>
          </button>
          <button
            onClick={() => navigate('/sales')}
            className="flex flex-col items-center gap-1.5 p-3 bg-green-600 text-white rounded-xl min-h-[72px] hover:bg-green-700 active:scale-95 transition-all"
          >
            <span className="text-2xl">💰</span>
            <span className="text-xs font-semibold">+ Sale</span>
          </button>
          <button
            onClick={() => navigate('/expenses')}
            className="flex flex-col items-center gap-1.5 p-3 bg-orange-500 text-white rounded-xl min-h-[72px] hover:bg-orange-600 active:scale-95 transition-all"
          >
            <span className="text-2xl">🧾</span>
            <span className="text-xs font-semibold">+ Expense</span>
          </button>
        </div>
      </Card>

      {/* Bag Inventory Quick View */}
      <Card className="p-4">
        <h2 className="text-sm font-semibold text-gray-600 mb-3">Bag Inventory</h2>
        <div className="space-y-2">
          {bags.map(b => {
            const pct = (b.packsCount / 5) * 100;
            const color = b.packsCount >= 3 ? 'bg-green-500' : b.packsCount === 2 ? 'bg-yellow-500' : 'bg-red-500';
            const textColor = b.packsCount >= 3 ? 'text-green-700' : b.packsCount === 2 ? 'text-yellow-700' : 'text-red-700';
            return (
              <div key={b.id} className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700 w-8">{b.size}</span>
                <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
                <span className={`text-sm font-bold w-16 text-right ${textColor}`}>{b.packsCount} pack{b.packsCount !== 1 ? 's' : ''}</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Ebike & Salary status */}
      {(ebikeNext || salaryNext) && (
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-gray-600 mb-3">Upcoming Payments</h2>
          <div className="space-y-2">
            {ebikeNext && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">⚡ Ebike Month {ebikeNext.monthNum}/12</span>
                <span className="font-semibold text-red-600">₱5,750 — due {format(parseISO(ebikeNext.dueDate), 'MMM d')}</span>
              </div>
            )}
            {salaryNext && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">💵 Salary</span>
                <span className="font-semibold text-orange-600">₱1,250 — due {format(parseISO(salaryNext.periodStart), 'MMM d')}</span>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
