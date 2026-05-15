import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';

export default function Nav({ user }) {
  const router = useRouter();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/');
  }

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b border-gray-100">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg font-black bg-gradient-to-r from-pink-400 to-blue-400 bg-clip-text text-transparent">
            Cracker
          </span>
          <span className="hidden sm:block text-xs text-gray-400 font-medium">
            Sports analytics for learning
          </span>
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link
                href="/dashboard"
                className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >
                Dashboard
              </Link>
              <button
                onClick={handleSignOut}
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="text-sm font-semibold text-pink-500 hover:text-pink-600 transition-colors"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
