'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/contexts/I18nContext';
import { MdMusicNote, MdEmail, MdLock, MdVisibility, MdVisibilityOff, MdCheckCircle, MdBusiness } from 'react-icons/md';

type Organization = {
  id: string;
  name: string;
  contact_email?: string;
};

export default function SignUpPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedOrganization, setSelectedOrganization] = useState('');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedProgram, setSelectedProgram] = useState('');
  const [programs, setPrograms] = useState<any[]>([]);
  const [loadingPrograms, setLoadingPrograms] = useState(false);
  const [selectedRole, setSelectedRole] = useState('viewer');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  // Cargar organizaciones disponibles
  useEffect(() => {
    const loadOrganizations = async () => {
      try {
        const { data, error } = await supabase
          .from('organizations')
          .select('id, name, contact_email')
          .eq('is_active', true)
          .order('name');

        if (error) throw error;
        setOrganizations(data || []);
      } catch (err) {
        console.error('Error loading organizations:', err);
        setError('Error al cargar las organizaciones disponibles');
      } finally {
        setLoadingOrgs(false);
      }
    };

    loadOrganizations();
  }, []);

  // Cargar programas cuando cambia la organización
  useEffect(() => {
    const loadPrograms = async () => {
      if (!selectedOrganization) {
        setPrograms([]);
        setSelectedProgram('');
        return;
      }

      try {
        setLoadingPrograms(true);
        const { data, error } = await supabase
          .from('programs')
          .select('id, name, type')
          .eq('organization_id', selectedOrganization)
          .eq('is_active', true)
          .order('name');

        if (error) throw error;
        setPrograms(data || []);
        setSelectedProgram(''); // Reset selection
      } catch (err) {
        console.error('Error loading programs:', err);
        setError('Error al cargar las sedes disponibles');
      } finally {
        setLoadingPrograms(false);
      }
    };

    loadPrograms();
  }, [selectedOrganization]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    // Validar que las contraseñas coincidan
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      setLoading(false);
      return;
    }

    // Validar que se haya seleccionado una organización
    if (!selectedOrganization) {
      setError('Por favor selecciona una organización');
      setLoading(false);
      return;
    }

    // Validar que se haya seleccionado un programa/sede
    if (!selectedProgram) {
      setError('Por favor selecciona una sede');
      setLoading(false);
      return;
    }

    try {
      // Crear el usuario
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            organization_id: selectedOrganization,
            program_id: selectedProgram,
            role: selectedRole,
            full_name: email.split('@')[0] // Usar parte del email como nombre temporal
          }
        }
      });

      if (error) {
        throw error;
      }

      if (data?.user) {
        // Crear el perfil del usuario en la tabla user_profiles
        const { error: profileError } = await supabase
          .from('user_profiles')
          .insert({
            user_id: data.user.id,
            email: email,
            organization_id: selectedOrganization,
            role: selectedRole,
            full_name: email.split('@')[0]
          });

        // Crear membresía del programa
        if (selectedProgram) {
          const { error: membershipError } = await supabase
            .from('user_program_memberships')
            .insert({
              user_id: data.user.id,
              program_id: selectedProgram,
              role: selectedRole
            });
          
          if (membershipError) {
            console.error('Error creating program membership:', membershipError);
          }
        }

        if (profileError) {
          console.error('Error creating user profile:', profileError);
          // No lanzamos error aquí para no bloquear el registro
        }

        setSuccess(true);
        setTimeout(() => {
          router.push('/login');
        }, 3000);
      }
    } catch (err: any) {
      setError(err.message || 'Error al crear la cuenta');
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = password.length >= 6;
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

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
      <main className="flex items-center justify-center p-6 py-16">
        <div className="w-full max-w-md">
          {/* Registration Card */}
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <div className="text-center mb-8">
              <div className="bg-gradient-to-r from-[#0073ea] to-[#0060c0] p-4 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                <MdMusicNote size={32} className="text-white" />
              </div>
              <h2 className="text-3xl font-bold text-gray-800 mb-2">{t('create_account')}</h2>
              <p className="text-gray-600">Únete a la comunidad musical</p>
            </div>
            
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center space-x-2">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span className="text-sm">{error}</span>
              </div>
            )}
            
            {success ? (
              <div className="text-center py-8">
                <div className="bg-green-100 p-6 rounded-2xl mb-6">
                  <MdCheckCircle size={48} className="text-green-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-green-800 mb-2">¡Cuenta creada exitosamente!</h3>
                  <p className="text-green-700">Serás redirigido a la página de inicio de sesión en unos momentos.</p>
                </div>
                <div className="flex items-center justify-center space-x-2 text-gray-600">
                  <div className="w-4 h-4 border-2 border-[#0073ea] border-t-transparent rounded-full animate-spin"></div>
                  <span>Redirigiendo...</span>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSignUp} className="space-y-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-gray-800 mb-2">
                    {t('email')}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <MdEmail className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0073ea] focus:border-transparent transition-all duration-200"
                      placeholder="tu@email.com"
                    />
                  </div>
                </div>
                
                <div>
                  <label htmlFor="organization" className="block text-sm font-semibold text-gray-800 mb-2">
                    Organización
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <MdBusiness className="h-5 w-5 text-gray-400" />
                    </div>
                    <select
                      id="organization"
                      value={selectedOrganization}
                      onChange={(e) => setSelectedOrganization(e.target.value)}
                      required
                      disabled={loadingOrgs}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0073ea] focus:border-transparent transition-all duration-200 bg-white text-gray-800"
                    >
                      <option value="">Selecciona tu organización...</option>
                      {organizations.map((org) => (
                        <option key={org.id} value={org.id}>
                          {org.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {loadingOrgs && (
                    <div className="mt-2 flex items-center space-x-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      <span className="text-xs text-gray-500">Cargando organizaciones disponibles...</span>
                    </div>
                  )}
                </div>
                
                <div>
                  <label htmlFor="program" className="block text-sm font-semibold text-gray-800 mb-2">
                    Sede
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <MdBusiness className="h-5 w-5 text-gray-400" />
                    </div>
                    <select
                      id="program"
                      value={selectedProgram}
                      onChange={(e) => setSelectedProgram(e.target.value)}
                      required
                      disabled={loadingPrograms || !selectedOrganization}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0073ea] focus:border-transparent transition-all duration-200 bg-white text-gray-800"
                    >
                      <option value="">{selectedOrganization ? 'Selecciona una sede...' : 'Selecciona una organización primero'}</option>
                      {programs.map((program) => (
                        <option key={program.id} value={program.id}>
                          {program.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {loadingPrograms && (
                    <div className="mt-2 flex items-center space-x-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      <span className="text-xs text-gray-500">Cargando sedes disponibles...</span>
                    </div>
                  )}
                </div>
                
                <div>
                  <label htmlFor="role" className="block text-sm font-semibold text-gray-800 mb-2">
                    Nivel de Usuario
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <MdBusiness className="h-5 w-5 text-gray-400" />
                    </div>
                    <select
                      id="role"
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value)}
                      required
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0073ea] focus:border-transparent transition-all duration-200 bg-white text-gray-800"
                    >
                      <option value="viewer">Viewer</option>
                      <option value="staff">Staff</option>
                    </select>
                  </div>
                </div>
                
                <div>
                  <label htmlFor="password" className="block text-sm font-semibold text-gray-800 mb-2">
                    {t('password')}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <MdLock className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0073ea] focus:border-transparent transition-all duration-200"
                      placeholder="••••••••"
                      minLength={6}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <MdVisibilityOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                      ) : (
                        <MdVisibility className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                      )}
                    </button>
                  </div>
                  <div className="mt-2 flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${passwordStrength ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                    <span className={`text-xs ${passwordStrength ? 'text-green-600' : 'text-gray-500'}`}>
                      Mínimo 6 caracteres
                    </span>
                  </div>
                </div>
                
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-800 mb-2">
                    Confirmar Contraseña
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <MdLock className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0073ea] focus:border-transparent transition-all duration-200"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? (
                        <MdVisibilityOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                      ) : (
                        <MdVisibility className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                      )}
                    </button>
                  </div>
                  {confirmPassword.length > 0 && (
                    <div className="mt-2 flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${passwordsMatch ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span className={`text-xs ${passwordsMatch ? 'text-green-600' : 'text-red-600'}`}>
                        {passwordsMatch ? 'Las contraseñas coinciden' : 'Las contraseñas no coinciden'}
                      </span>
                    </div>
                  )}
                </div>
                
                <button
                  type="submit"
                  disabled={loading || !passwordStrength || !passwordsMatch || !selectedOrganization || !selectedProgram || loadingOrgs || loadingPrograms}
                  className={`w-full py-3 px-4 bg-gradient-to-r from-[#0073ea] to-[#0060c0] text-white rounded-xl font-semibold hover:shadow-lg transform hover:scale-[1.02] transition-all duration-300 ${
                    loading || !passwordStrength || !passwordsMatch || !selectedOrganization || !selectedProgram || loadingOrgs || loadingPrograms ? 'opacity-70 cursor-not-allowed transform-none' : ''
                  }`}
                >
                  {loading ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>{t('creating_account')}</span>
                    </div>
                  ) : (
                    t('create_account')
                  )}
                </button>
              </form>
            )}
            
            {!success && (
              <div className="mt-8 text-center">
                <p className="text-gray-600">
                  {t('already_have_account')}{' '}
                  <Link href="/login" className="text-[#0073ea] hover:text-[#0060c0] font-semibold hover:underline transition-colors">
                    {t('sign_in_here')}
                  </Link>
                </p>
              </div>
            )}

            {/* Divider */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <div className="text-center">
                <Link 
                  href="/" 
                  className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  ← Volver al inicio
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
