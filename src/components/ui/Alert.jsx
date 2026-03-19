const variants = {
  red: 'bg-red-50 border-red-200 text-red-800',
  orange: 'bg-orange-50 border-orange-200 text-orange-800',
  yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  blue: 'bg-blue-50 border-blue-200 text-blue-800',
};

export default function Alert({ children, variant = 'orange', className = '' }) {
  return (
    <div className={`border rounded-lg px-4 py-3 text-sm font-medium ${variants[variant] || variants.orange} ${className}`}>
      {children}
    </div>
  );
}
