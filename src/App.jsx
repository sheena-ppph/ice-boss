import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { initSeedData, clearDuplicates } from './db/database';
import Header from './components/layout/Header';
import BottomNav from './components/layout/BottomNav';
import Dashboard from './pages/Dashboard';
import Production from './pages/Production';
import Sales from './pages/Sales';
import Inventory from './pages/Inventory';
import Expenses from './pages/Expenses';
import Ebike from './pages/Ebike';
import Attendance from './pages/Attendance';
import Salary from './pages/Salary';
import Reports from './pages/Reports';

const PAGE_TITLES = {
  '/': 'Ice Boss',
  '/production': 'Production',
  '/sales': 'Sales',
  '/inventory': 'Inventory',
  '/expenses': 'Expenses',
  '/ebike': 'Ebike',
  '/attendance': 'Attendance',
  '/salary': 'Salary',
  '/reports': 'Reports',
};

function AppLayout() {
  const location = useLocation();
  const title = PAGE_TITLES[location.pathname] || 'Ice Boss';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto">
      <Header title={title} />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/production" element={<Production />} />
          <Route path="/sales" element={<Sales />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/ebike" element={<Ebike />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/salary" element={<Salary />} />
          <Route path="/reports" element={<Reports />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  );
}

export default function App() {
  const [dbReady, setDbReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    initSeedData()
      .then(() => clearDuplicates())
      .then(() => setDbReady(true))
      .catch(err => {
        console.error('DB init error:', err);
        setError(err.message);
        setDbReady(true); // still show app
      });
  }, []);

  if (!dbReady) {
    return (
      <div className="min-h-screen bg-blue-800 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="text-6xl mb-4">🧊</div>
          <h1 className="text-2xl font-bold">Ice Boss</h1>
          <p className="text-blue-300 mt-2">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}
