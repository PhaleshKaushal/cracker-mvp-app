const colors = {
  pink: 'bg-pink-100 text-pink-700',
  blue: 'bg-blue-100 text-blue-700',
  green: 'bg-green-100 text-green-700',
  red: 'bg-red-100 text-red-700',
  gray: 'bg-gray-100 text-gray-600',
  yellow: 'bg-yellow-100 text-yellow-700',
};

export default function Badge({ children, color = 'pink', className = '' }) {
  return (
    <span
      className={`
        inline-flex items-center gap-1 px-2.5 py-0.5
        text-xs font-semibold rounded-full
        ${colors[color]}
        ${className}
      `}
    >
      {children}
    </span>
  );
}
