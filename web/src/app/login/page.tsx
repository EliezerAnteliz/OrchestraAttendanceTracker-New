'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/contexts/I18nContext';
import { MdMusicNote, MdEmail, MdLock, MdVisibility, MdVisibilityOff, MdWarning } from 'react-icons/md';

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
    <div className="min-h-screen bg-[#FAF7F2]">
      {/* Header — mismo logo (ícono 2x2 + wordmark Newsreader) que el
          sidebar de la app, sobre el mismo fondo crema, en vez de una barra
          terracota separada. */}
      <header className="border-b border-[#E3DDD1]">
        <div className="container mx-auto px-4 py-4">
          <Link href="/" className="inline-flex items-center gap-2 hover:opacity-80 transition-opacity">
            <span
              className="grid grid-cols-2 grid-rows-2 gap-[2.5px] flex-shrink-0"
              style={{ width: 18, height: 18 }}
              aria-hidden="true"
            >
              <span className="bg-[#1B1917] rounded-[2px]" />
              <span className="bg-[#1B1917] rounded-[2px]" />
              <span className="bg-[#1B1917] rounded-[2px]" />
              <span className="bg-[#C2492B] rounded-[2px]" />
            </span>
            <span
              className="text-xl leading-none text-[#1B1917]"
              style={{ fontFamily: 'var(--font-newsreader), serif', letterSpacing: '-0.02em' }}
            >
              Site<span style={{ color: '#C2492B' }}>Track</span>
            </span>
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="flex items-center justify-center p-4 py-12">
        <div className="w-full max-w-sm">
          <div className="bg-[#FFFDFA] rounded-2xl shadow-xl p-6 border border-[#E3DDD1]">
            <div className="text-center mb-6">
              <div className="bg-[#C2492B] rounded-full w-14 h-14 mx-auto mb-4 flex items-center justify-center">
                <MdMusicNote size={22} className="text-white" />
              </div>
              <h2
                className="text-2xl text-[#1B1917] mb-1"
                style={{ fontFamily: 'var(--font-newsreader), serif', fontWeight: 400, letterSpacing: '-0.02em' }}
              >
                {t('sign_in')}
              </h2>
              <p className="text-sm text-[#8A8177]">{t('access_account_continue')}</p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-[#F8E9E4] border border-[#EAC7BB] rounded-lg flex items-start gap-2">
                <MdWarning className="text-[#8f3421] shrink-0 mt-0.5" size={16} />
                <span className="text-xs text-[#8f3421]">{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-[13px] font-medium text-[#56504A] mb-1.5">
                  {t('email')}
                </label>
                <div className="relative">
                  <div className="hidden md:absolute md:inset-y-0 md:left-0 md:pl-3 md:flex md:items-center md:pointer-events-none">
                    <MdEmail className="h-4 w-4 text-[#A29889]" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-3 md:pl-9 pr-3 py-2.5 rounded-[9px] border border-[#E3DDD1] bg-[#FFFDFA] text-[#1B1917] focus:outline-none focus:ring-2 focus:ring-[#C2492B]/30 focus:border-[#C2492B] transition-colors text-sm"
                    placeholder="tu@email.com"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="password" className="block text-[13px] font-medium text-[#56504A]">
                    {t('password')}
                  </label>
                  <Link href="/forgot-password" className="text-xs text-[#C2492B] hover:text-[#A83A20] hover:underline transition-colors">
                    {t('forgot_password_link')}
                  </Link>
                </div>
                <div className="relative">
                  <div className="hidden md:absolute md:inset-y-0 md:left-0 md:pl-3 md:flex md:items-center md:pointer-events-none">
                    <MdLock className="h-4 w-4 text-[#A29889]" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full pl-3 md:pl-9 pr-10 py-2.5 rounded-[9px] border border-[#E3DDD1] bg-[#FFFDFA] text-[#1B1917] focus:outline-none focus:ring-2 focus:ring-[#C2492B]/30 focus:border-[#C2492B] transition-colors text-sm"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <MdVisibilityOff className="h-4 w-4 text-[#A29889] hover:text-[#6E675E]" />
                    ) : (
                      <MdVisibility className="h-4 w-4 text-[#A29889] hover:text-[#6E675E]" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-2.5 px-4 bg-[#C2492B] text-white rounded-lg font-medium hover:bg-[#A83A20] transition-colors text-sm ${
                  loading ? 'opacity-70 cursor-not-allowed' : ''
                }`}
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>{t('signing_in')}</span>
                  </div>
                ) : (
                  t('sign_in')
                )}
              </button>
            </form>

            {/* El link "¿No tienes cuenta? Regístrate aquí" → /signup se
                quitó (26/07): el autorregistro público dejaba elegir una
                organización real y auto-asignarse el rol Staff sin ninguna
                aprobación. Las cuentas ahora se crean desde Admin/Usuarios. */}

            {/* Divider */}
            <div className="mt-6 pt-4 border-t border-[#E3DDD1]">
              <div className="text-center">
                <Link
                  href="/"
                  className="text-xs text-[#8A8177] hover:text-[#C2492B] transition-colors"
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
