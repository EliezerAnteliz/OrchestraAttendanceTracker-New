'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/contexts/I18nContext';
import { MdMusicNote, MdEmail, MdCheckCircle } from 'react-icons/md';

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
            {sent ? (
              <div className="text-center">
                <div className="bg-green-100 p-3 rounded-full w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                  <MdCheckCircle size={28} className="text-green-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">{t('reset_link_sent_title')}</h2>
                <p className="text-sm text-gray-600 mb-6">
                  {t('reset_link_sent_desc', { email })}
                </p>
                <Link
                  href="/login"
                  className="inline-block w-full py-2.5 px-4 bg-gradient-to-r from-[#C2492B] to-[#A83A20] text-white rounded-lg font-medium hover:shadow-md transition-all duration-200 text-sm"
                >
                  {t('back_to_login')}
                </Link>
              </div>
            ) : (
              <>
                <div className="text-center mb-6">
                  <div className="bg-gradient-to-r from-[#C2492B] to-[#A83A20] p-3 rounded-full w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                    <MdMusicNote size={24} className="text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-800 mb-1">{t('forgot_password_title')}</h2>
                  <p className="text-sm text-gray-600">{t('forgot_password_desc')}</p>
                </div>

                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center space-x-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span className="text-xs">{error}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
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
                        className="w-full pl-3 md:pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#C2492B] focus:border-transparent transition-all duration-200 text-sm text-gray-900"
                        placeholder="tu@email.com"
                      />
                    </div>
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
                        <span>{t('sending_reset_link')}</span>
                      </div>
                    ) : (
                      t('send_reset_link')
                    )}
                  </button>
                </form>

                <div className="mt-6 pt-4 border-t border-gray-200 text-center">
                  <Link href="/login" className="text-xs text-gray-500 hover:text-gray-700 transition-colors">
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
