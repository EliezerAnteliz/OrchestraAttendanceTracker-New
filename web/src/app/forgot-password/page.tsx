'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/contexts/I18nContext';
import { MdMusicNote, MdEmail, MdCheckCircle, MdWarning } from 'react-icons/md';

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // No revelamos si el correo existe o no en la base de datos (evita
      // que alguien use este formulario para averiguar qué correos tienen
      // cuenta) — Supabase ya se comporta así por defecto: no da error
      // aunque el correo no exista, simplemente no manda nada.
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch (err: any) {
      setError(err.message || 'Error al enviar el correo');
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
            {sent ? (
              <div className="text-center">
                <div className="bg-[#EDF1E9] rounded-full w-14 h-14 mx-auto mb-4 flex items-center justify-center">
                  <MdCheckCircle size={24} className="text-[#4F6748]" />
                </div>
                <h2
                  className="text-xl text-[#1B1917] mb-2"
                  style={{ fontFamily: 'var(--font-newsreader), serif', fontWeight: 400, letterSpacing: '-0.02em' }}
                >
                  {t('reset_link_sent_title')}
                </h2>
                <p className="text-sm text-[#8A8177] mb-6">
                  {t('reset_link_sent_desc', { email })}
                </p>
                <Link
                  href="/login"
                  className="inline-block w-full py-2.5 px-4 bg-[#C2492B] text-white rounded-lg font-medium hover:bg-[#A83A20] transition-colors text-sm"
                >
                  {t('back_to_login')}
                </Link>
              </div>
            ) : (
              <>
                <div className="text-center mb-6">
                  <div className="bg-[#C2492B] rounded-full w-14 h-14 mx-auto mb-4 flex items-center justify-center">
                    <MdMusicNote size={22} className="text-white" />
                  </div>
                  <h2
                    className="text-xl text-[#1B1917] mb-1"
                    style={{ fontFamily: 'var(--font-newsreader), serif', fontWeight: 400, letterSpacing: '-0.02em' }}
                  >
                    {t('forgot_password_title')}
                  </h2>
                  <p className="text-sm text-[#8A8177]">{t('forgot_password_desc')}</p>
                </div>

                {error && (
                  <div className="mb-4 p-3 bg-[#F8E9E4] border border-[#EAC7BB] rounded-lg flex items-start gap-2">
                    <MdWarning className="text-[#8f3421] shrink-0 mt-0.5" size={16} />
                    <span className="text-xs text-[#8f3421]">{error}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
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
                        <span>{t('sending_reset_link')}</span>
                      </div>
                    ) : (
                      t('send_reset_link')
                    )}
                  </button>
                </form>

                <div className="mt-6 pt-4 border-t border-[#E3DDD1] text-center">
                  <Link href="/login" className="text-xs text-[#8A8177] hover:text-[#C2492B] transition-colors">
                    ← {t('back_to_login')}
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
