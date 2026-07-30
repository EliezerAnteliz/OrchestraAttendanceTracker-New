'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/contexts/I18nContext';
import { MdMusicNote, MdLock, MdVisibility, MdVisibilityOff, MdCheckCircle, MdWarning } from 'react-icons/md';

// El link del correo de recuperación trae un token especial que Supabase
// detecta automáticamente al cargar esta página (vía detectSessionInUrl,
// activado por defecto) y dispara el evento PASSWORD_RECOVERY. Solo en ese
// momento hay una sesión válida para poder cambiar la contraseña — por eso
// esta pantalla no muestra el formulario hasta confirmar ese evento (o que
// ya exista sesión, por si el evento disparó antes de montar el listener).
type LinkStatus = 'checking' | 'valid' | 'invalid';

export default function ResetPasswordPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [linkStatus, setLinkStatus] = useState<LinkStatus>('checking');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let resolved = false;

    // PASSWORD_RECOVERY dispara con el link de "olvidé mi contraseña";
    // SIGNED_IN dispara con el link de invitación de usuario nuevo (crea
    // sesión directo, sin evento de recovery) — esta pantalla sirve para
    // ambos casos (poner contraseña por primera vez o cambiarla).
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        resolved = true;
        setLinkStatus('valid');
      }
    });

    // Por si el evento ya disparó antes de suscribirnos.
    supabase.auth.getSession().then(({ data }) => {
      if (!resolved && data.session) {
        resolved = true;
        setLinkStatus('valid');
      } else if (!resolved) {
        // Le damos un momento al SDK para procesar el link antes de darlo
        // por inválido — detectSessionInUrl es asíncrono.
        setTimeout(() => {
          if (!resolved) setLinkStatus('invalid');
        }, 2500);
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError(t('password_min'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('passwords_dont_match'));
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
      await supabase.auth.signOut();
    } catch (err: any) {
      setError(err.message || 'Error al actualizar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <header className="bg-gradient-to-r from-[#C2492B] to-[#A83A20] text-white p-4 shadow-lg">
        <div className="container mx-auto">
          <Link href="/" className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
            <span className="text-2xl font-bold">{t('app_title')}</span>
          </Link>
        </div>
      </header>

      <main className="flex items-center justify-center p-4 py-8">
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            {linkStatus === 'checking' && (
              <div className="text-center py-6">
                <div className="w-8 h-8 border-2 border-[#C2492B] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-sm text-gray-600">...</p>
              </div>
            )}

            {linkStatus === 'invalid' && (
              <div className="text-center">
                <div className="bg-red-100 p-3 rounded-full w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                  <MdWarning size={28} className="text-red-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">{t('invalid_reset_link_title')}</h2>
                <p className="text-sm text-gray-600 mb-6">{t('invalid_reset_link_desc')}</p>
                <Link
                  href="/forgot-password"
                  className="inline-block w-full py-2.5 px-4 bg-gradient-to-r from-[#C2492B] to-[#A83A20] text-white rounded-lg font-medium hover:shadow-md transition-all duration-200 text-sm"
                >
                  {t('request_new_link')}
                </Link>
              </div>
            )}

            {linkStatus === 'valid' && !success && (
              <>
                <div className="text-center mb-6">
                  <div className="bg-gradient-to-r from-[#C2492B] to-[#A83A20] p-3 rounded-full w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                    <MdMusicNote size={24} className="text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-800 mb-1">{t('reset_password_title')}</h2>
                  <p className="text-sm text-gray-600">{t('reset_password_desc')}</p>
                </div>

                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center space-x-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span className="text-xs">{error}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="password" className="block text-xs font-medium text-gray-700 mb-1">
                      {t('new_password')}
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
                        minLength={6}
                        className="w-full pl-3 md:pl-9 pr-10 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#C2492B] focus:border-transparent transition-all duration-200 text-sm text-gray-900"
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
                    <p className="mt-1 text-xs text-gray-500">{t('password_min')}</p>
                  </div>

                  <div>
                    <label htmlFor="confirmPassword" className="block text-xs font-medium text-gray-700 mb-1">
                      {t('confirm_new_password')}
                    </label>
                    <input
                      id="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="w-full pl-3 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#C2492B] focus:border-transparent transition-all duration-200 text-sm text-gray-900"
                      placeholder="••••••••"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className={`w-full py-2.5 px-4 bg-gradient-to-r from-[#C2492B] to-[#A83A20] text-white rounded-lg font-medium hover:shadow-md transform hover:scale-[1.01] transition-all duration-200 text-sm ${
                      loading ? 'opacity-70 cursor-not-allowed transform-none' : ''
                    }`}
                  >
                    {loading ? (
                      <div className="flex items-center justify-center space-x-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>{t('updating_password')}</span>
                      </div>
                    ) : (
                      t('update_password')
                    )}
                  </button>
                </form>
              </>
            )}

            {success && (
              <div className="text-center">
                <div className="bg-green-100 p-3 rounded-full w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                  <MdCheckCircle size={28} className="text-green-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">{t('password_updated_title')}</h2>
                <p className="text-sm text-gray-600 mb-6">{t('password_updated_desc')}</p>
                <button
                  onClick={() => router.push('/login')}
                  className="inline-block w-full py-2.5 px-4 bg-gradient-to-r from-[#C2492B] to-[#A83A20] text-white rounded-lg font-medium hover:shadow-md transition-all duration-200 text-sm"
                >
                  {t('go_to_login')}
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
