'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/contexts/I18nContext';
import { MdMusicNote, MdEmail, MdLock, MdVisibility, MdVisibilityOff } from 'react-icons/md';

export default function LoginPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      if (data?.user) {
        // Verificar si el usuario está activo en user_profiles
        const { data: userProfile, error: profileError } = await supabase
          .from('user_profiles')
          .select('is_active, full_name')
          .eq('user_id', data.user.id)
          .single();

        if (profileError) {
          console.error('Error fetching user profile:', profileError);
          await supabase.auth.signOut();
          throw new Error(t('user_profile_not_found'));
        }

        if (!userProfile.is_active) {
          await supabase.auth.signOut();
          throw new Error(t('user_account_inactive'));
        }

        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#0073ea] to-[#0060c0] text-white p-4 shadow-lg">
        <div className="container mx-auto">
          <Link href="/" className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
            <span className="text-2xl font-bold">{t('app_title')}</span>
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="flex items-center justify-center p-4 py-8">
        <div className="w-full max-w-sm">
          {/* Welcome Card */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="text-center mb-6">
              <div className="bg-gradient-to-r from-[#0073ea] to-[#0060c0] p-3 rounded-full w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                <MdMusicNote size={24} className="text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-1">{t('sign_in')}</h2>
              <p className="text-sm text-gray-600">{t('access_account_continue')}</p>
            </div>
            
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center space-x-2">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span className="text-xs">{error}</span>
              </div>
            )}
            
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-xs font-medium text-gray-700 mb-1">
                  {t('email')}
                </label>
                <div className="relative">
                  <div className="hidden md:absolute md:inset-y-0 md:left-0 md:pl-3 md:flex md:items-center md:pointer-events-none">
                    <MdEmail className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-3 md:pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0073ea] focus:border-transparent transition-all duration-200 text-sm text-gray-900"
                    placeholder="tu@email.com"
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="password" className="block text-xs font-medium text-gray-700 mb-1">
                  {t('password')}
                </label>
                <div className="relative">
                  <div className="hidden md:absolute md:inset-y-0 md:left-0 md:pl-3 md:flex md:items-center md:pointer-events-none">
                    <MdLock className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full pl-3 md:pl-9 pr-10 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0073ea] focus:border-transparent transition-all duration-200 text-sm text-gray-900"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <MdVisibilityOff className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                    ) : (
                      <MdVisibility className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                    )}
                  </button>
                </div>
              </div>
              
              <button
                type="submit"
                disabled={loading}
                className={`w-full py-2.5 px-4 bg-gradient-to-r from-[#0073ea] to-[#0060c0] text-white rounded-lg font-medium hover:shadow-md transform hover:scale-[1.01] transition-all duration-200 text-sm ${
                  loading ? 'opacity-70 cursor-not-allowed transform-none' : ''
                }`}
              >
                {loading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>{t('signing_in')}</span>
                  </div>
                ) : (
                  t('sign_in')
                )}
              </button>
            </form>
            
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                {t('dont_have_account')}{' '}
                <Link href="/signup" className="text-[#0073ea] hover:text-[#0060c0] font-medium hover:underline transition-colors">
                  {t('sign_up_here')}
                </Link>
              </p>
            </div>

            {/* Divider */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <div className="text-center">
                <Link 
                  href="/" 
                  className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                >
                  ← {t('back_to_home')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
