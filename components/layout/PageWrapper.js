import Nav from './Nav';

export default function PageWrapper({ children, user, hideNav = false, maxWidth = '5xl' }) {
  const widths = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    full: 'max-w-full',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {!hideNav && <Nav user={user} />}
      <main className={`${widths[maxWidth]} mx-auto px-6 py-8`}>
        {children}
      </main>
    </div>
  );
}
