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
    <div className="min-h-screen bg-[#FAF7F2]">
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

      <main className="flex items-center justify-center p-4 py-12">
        <div className="w-full max-w-sm">
          <div className="bg-[#FFFDFA] rounded-2xl shadow-xl p-6 border border-[#E3DDD1]">
            {linkStatus === 'checking' && (
              <div className="text-center py-6">
                <div className="w-8 h-8 border-2 border-[#EAE3D6] border-t-[#C2492B] rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-sm text-[#8A8177]">...</p>
              </div>
            )}

            {linkStatus === 'invalid' && (
              <div className="text-center">
                <div className="bg-[#F8E9E4] rounded-full w-14 h-14 mx-auto mb-4 flex items-center justify-center">
                  <MdWarning size={24} className="text-[#8f3421]" />
                </div>
                <h2
                  className="text-xl text-[#1B1917] mb-2"
                  style={{ fontFamily: 'var(--font-newsreader), serif', fontWeight: 400, letterSpacing: '-0.02em' }}
                >
                  {t('invalid_reset_link_title')}
                </h2>
                <p className="text-sm text-[#8A8177] mb-6">{t('invalid_reset_link_desc')}</p>
                <Link
                  href="/forgot-password"
                  className="inline-block w-full py-2.5 px-4 bg-[#C2492B] text-white rounded-lg font-medium hover:bg-[#A83A20] transition-colors text-sm"
                >
                  {t('request_new_link')}
                </Link>
              </div>
            )}

            {linkStatus === 'valid' && !success && (
              <>
                <div className="text-center mb-6">
                  <div className="bg-[#C2492B] rounded-full w-14 h-14 mx-auto mb-4 flex items-center justify-center">
                    <MdMusicNote size={22} className="text-white" />
                  </div>
                  <h2
                    className="text-xl text-[#1B1917] mb-1"
                    style={{ fontFamily: 'var(--font-newsreader), serif', fontWeight: 400, letterSpacing: '-0.02em' }}
                  >
                    {t('reset_password_title')}
                  </h2>
                  <p className="text-sm text-[#8A8177]">{t('reset_password_desc')}</p>
                </div>

                {error && (
                  <div className="mb-4 p-3 bg-[#F8E9E4] border border-[#EAC7BB] rounded-lg flex items-start gap-2">
                    <MdWarning className="text-[#8f3421] shrink-0 mt-0.5" size={16} />
                    <span className="text-xs text-[#8f3421]">{error}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="password" className="block text-[13px] font-medium text-[#56504A] mb-1.5">
                      {t('new_password')}
                    </label>
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
                        minLength={6}
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
                    <p className="mt-1 text-xs text-[#8A8177]">{t('password_min')}</p>
                  </div>

                  <div>
                    <label htmlFor="confirmPassword" className="block text-[13px] font-medium text-[#56504A] mb-1.5">
                      {t('confirm_new_password')}
                    </label>
                    <input
                      id="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="w-full pl-3 pr-3 py-2.5 rounded-[9px] border border-[#E3DDD1] bg-[#FFFDFA] text-[#1B1917] focus:outline-none focus:ring-2 focus:ring-[#C2492B]/30 focus:border-[#C2492B] transition-colors text-sm"
                      placeholder="••••••••"
                    />
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
                <div className="bg-[#EDF1E9] rounded-full w-14 h-14 mx-auto mb-4 flex items-center justify-center">
                  <MdCheckCircle size={24} className="text-[#4F6748]" />
                </div>
                <h2
                  className="text-xl text-[#1B1917] mb-2"
                  style={{ fontFamily: 'var(--font-newsreader), serif', fontWeight: 400, letterSpacing: '-0.02em' }}
                >
                  {t('password_updated_title')}
                </h2>
                <p className="text-sm text-[#8A8177] mb-6">{t('password_updated_desc')}</p>
                <button
                  onClick={() => router.push('/login')}
                  className="inline-block w-full py-2.5 px-4 bg-[#C2492B] text-white rounded-lg font-medium hover:bg-[#A83A20] transition-colors text-sm"
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
