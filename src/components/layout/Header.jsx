import { format } from 'date-fns';

export default function Header({ title }) {
  const today = format(new Date(), 'MMMM d, yyyy');

  return (
    <header className="bg-blue-800 text-white px-4 py-3 sticky top-0 z-40 shadow-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🧊</span>
          <h1 className="text-lg font-bold">{title || 'Ice Boss'}</h1>
        </div>
        <span className="text-blue-200 text-sm">{today}</span>
      </div>
    </header>
  );
}
