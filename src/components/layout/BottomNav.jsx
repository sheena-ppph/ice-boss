import { NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';

const navItems = [
  { path: '/', label: 'Home', icon: '🏠' },
  { path: '/production', label: 'Produce', icon: '🏭' },
  { path: '/sales', label: 'Sales', icon: '💰' },
  { path: '/inventory', label: 'Inventory', icon: '📦' },
  { path: '/ebike', label: 'Ebike', icon: '⚡' },
];

const moreItems = [
  { path: '/attendance', label: 'Attendance', icon: '📅' },
  { path: '/salary', label: 'Salary', icon: '💵' },
  { path: '/expenses', label: 'Expenses', icon: '🧾' },
  { path: '/reports', label: 'Reports', icon: '📊' },
];

export default function BottomNav() {
  const [showMore, setShowMore] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      {/* More menu overlay */}
      {showMore && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={() => setShowMore(false)}
        >
          <div
            className="absolute bottom-16 left-0 right-0 bg-white rounded-t-2xl shadow-2xl p-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 px-2">More Pages</h3>
            <div className="grid grid-cols-2 gap-2">
              {moreItems.map(item => (
                <button
                  key={item.path}
                  onClick={() => {
                    navigate(item.path);
                    setShowMore(false);
                  }}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-blue-50 active:bg-blue-100 transition-colors text-left min-h-[56px]"
                >
                  <span className="text-2xl">{item.icon}</span>
                  <span className="font-medium text-gray-700">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg">
        <div className="flex items-center">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center py-2 min-h-[56px] transition-colors ${
                  isActive
                    ? 'text-blue-700 bg-blue-50'
                    : 'text-gray-500 hover:text-blue-600 hover:bg-gray-50'
                }`
              }
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-[10px] font-medium mt-0.5">{item.label}</span>
            </NavLink>
          ))}
          <button
            onClick={() => setShowMore(!showMore)}
            className="flex-1 flex flex-col items-center justify-center py-2 min-h-[56px] text-gray-500 hover:text-blue-600 hover:bg-gray-50 transition-colors"
          >
            <span className="text-xl">⋯</span>
            <span className="text-[10px] font-medium mt-0.5">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
