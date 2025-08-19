"use client";

import Link from "next/link";
import { useI18n } from "@/contexts/I18nContext";
import { MdMusicNote, MdPeople, MdAssignment, MdBarChart, MdCheckCircle, MdSchedule } from "react-icons/md";

export default function Home() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#0073ea] to-[#0060c0] text-white p-4 shadow-lg">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold">{t("app_title")}</h1>
          </div>
          <div className="space-x-4">
            <Link href="/login" className="px-6 py-2 bg-white/10 backdrop-blur-sm text-white rounded-lg hover:bg-white/20 transition-all duration-300 border border-white/20">
              {t("login")}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-grow">
        <div className="container mx-auto px-6 py-16">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
            {/* Left Content */}
            <div className="lg:w-1/2 space-y-8">
              <div className="space-y-4">
                <h2 className="text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
                  Gestión de Asistencia para el Programa Ascend
                </h2>
                <p className="text-xl text-gray-800 leading-relaxed">
                  Una plataforma colaborativa en línea para registrar la asistencia de los estudiantes, elaborar informes claros y asegurar registros precisos y actualizados del Programa Ascend.
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/dashboard" 
                  className="px-8 py-4 bg-gradient-to-r from-[#0073ea] to-[#0060c0] text-white rounded-xl hover:shadow-lg transform hover:scale-105 transition-all duration-300 text-center font-semibold">
                  {t("access_dashboard")}
                </Link>
                <Link href="/signup" 
                  className="px-8 py-4 bg-white text-[#0073ea] rounded-xl border-2 border-[#0073ea] hover:bg-[#0073ea] hover:text-white transition-all duration-300 text-center font-semibold">
                  Comenzar Gratis
                </Link>
              </div>
            </div>
            
            {/* Right Content - Features Grid */}
            <div className="lg:w-1/2">
              <div className="grid grid-cols-2 gap-6">
                <FeatureCard 
                  icon={<MdPeople size={32} />}
                  title="Gestión de Estudiantes"
                  description="Administra perfiles y datos de estudiantes"
                  color="bg-blue-500"
                />
                <FeatureCard 
                  icon={<MdAssignment size={32} />}
                  title="Registro de Asistencia"
                  description="Control diario rápido y eficiente"
                  color="bg-green-500"
                />
                <FeatureCard 
                  icon={<MdBarChart size={32} />}
                  title="Reportes Detallados"
                  description="Análisis y estadísticas completas"
                  color="bg-purple-500"
                />
                <FeatureCard 
                  icon={<MdSchedule size={32} />}
                  title="Acceso 24/7"
                  description="Disponible desde cualquier dispositivo"
                  color="bg-orange-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Benefits Section */}
        <div className="bg-white py-16">
          <div className="container mx-auto px-6">
            <div className="text-center mb-12">
              <h3 className="text-3xl font-bold text-gray-900 mb-4">Beneficios del Ascend Attendance Tracker</h3>
              <p className="text-xl text-gray-800">Una plataforma colaborativa diseñada para facilitar el registro de asistencia y generar informes precisos para el Programa Ascend</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              <BenefitCard 
                icon={<MdCheckCircle size={48} />}
                title="Fácil de Usar"
                description="Interfaz intuitiva que cualquier instructor puede dominar en minutos"
              />
              <BenefitCard 
                icon={<MdBarChart size={48} />}
                title="Reportes Inteligentes"
                description="Visualiza tendencias y patrones de asistencia con gráficos claros"
              />
              <BenefitCard 
                icon={<MdMusicNote size={48} />}
                title="Para Músicos"
                description="Creado por y para la comunidad musical, entendemos tus necesidades"
              />
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-8">
        <div className="container mx-auto px-6 text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <MdMusicNote size={24} />
            <span className="text-xl font-bold">{t("app_title")}</span>
          </div>
          <p className="text-gray-400">{t("footer_copyright", { year: new Date().getFullYear() })}</p>
        </div>
      </footer>
    </div>
  );
}

// Componente para las tarjetas de características
function FeatureCard({ icon, title, description, color }: { 
  icon: React.ReactNode; 
  title: string; 
  description: string; 
  color: string; 
}) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border border-gray-100">
      <div className={`${color} p-3 rounded-xl text-white mb-4 w-fit`}>
        {icon}
      </div>
      <h4 className="font-bold text-black mb-2 text-lg">{title}</h4>
      <p className="text-sm text-black leading-relaxed">{description}</p>
    </div>
  );
}

// Componente para las tarjetas de beneficios
function BenefitCard({ icon, title, description }: { 
  icon: React.ReactNode; 
  title: string; 
  description: string; 
}) {
  return (
    <div className="text-center p-6">
      <div className="text-[#0073ea] mb-4 flex justify-center">
        {icon}
      </div>
      <h4 className="text-xl font-bold text-black mb-3">{title}</h4>
      <p className="text-black leading-relaxed">{description}</p>
    </div>
  );
}

