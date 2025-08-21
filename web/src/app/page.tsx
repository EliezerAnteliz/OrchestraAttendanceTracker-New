"use client";

import Link from "next/link";
import { useI18n } from "@/contexts/I18nContext";
import { MdMusicNote, MdPeople, MdAssignment, MdBarChart, MdCheckCircle, MdSchedule } from "react-icons/md";

export default function Home() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#0073ea] to-[#0060c0] text-white p-3 sm:p-4 shadow-lg">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center">
            <h1 className="text-base sm:text-2xl font-bold truncate">{t("app_title")}</h1>
          </div>
          <div className="flex-shrink-0">
            <Link href="/login" className="px-2 py-1 sm:px-6 sm:py-2 bg-white/10 backdrop-blur-sm text-white rounded-md sm:rounded-lg hover:bg-white/20 transition-all duration-300 border border-white/20 text-xs sm:text-base whitespace-nowrap">
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
                  {t("landing_headline")}
                </h2>
                <p className="text-xl text-gray-800 leading-relaxed">
                  {t("landing_desc")}
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/dashboard" 
                  className="px-6 py-3 sm:px-8 sm:py-4 bg-gradient-to-r from-[#0073ea] to-[#0060c0] text-white rounded-xl hover:shadow-lg transform hover:scale-105 transition-all duration-300 text-center font-semibold text-sm sm:text-base">
                  {t("access_dashboard")}
                </Link>
                <Link href="/signup" 
                  className="px-6 py-3 sm:px-8 sm:py-4 bg-white text-[#0073ea] rounded-xl border-2 border-[#0073ea] hover:bg-[#0073ea] hover:text-white transition-all duration-300 text-center font-semibold text-sm sm:text-base">
                  {t("start_free")}
                </Link>
              </div>
            </div>
            
            {/* Right Content - Features Grid */}
            <div className="lg:w-1/2">
              <div className="grid grid-cols-2 gap-6">
                <FeatureCard 
                  icon={<MdPeople size={32} />}
                  title={t("student_management")}
                  description={t("student_management_desc")}
                  color="bg-blue-500"
                />
                <FeatureCard 
                  icon={<MdAssignment size={32} />}
                  title={t("attendance_recording")}
                  description={t("attendance_recording_desc")}
                  color="bg-green-500"
                />
                <FeatureCard 
                  icon={<MdBarChart size={32} />}
                  title={t("detailed_reports")}
                  description={t("detailed_reports_desc")}
                  color="bg-purple-500"
                />
                <FeatureCard 
                  icon={<MdSchedule size={32} />}
                  title={t("access_247")}
                  description={t("access_247_desc")}
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
              <h3 className="text-3xl font-bold text-gray-900 mb-4">{t("benefits_title")}</h3>
              <p className="text-xl text-gray-800">{t("benefits_desc")}</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              <BenefitCard 
                icon={<MdCheckCircle size={48} />}
                title={t("easy_to_use")}
                description={t("easy_to_use_desc")}
              />
              <BenefitCard 
                icon={<MdBarChart size={48} />}
                title={t("smart_reports")}
                description={t("smart_reports_desc")}
              />
              <BenefitCard 
                icon={<MdMusicNote size={48} />}
                title={t("for_musicians")}
                description={t("for_musicians_desc")}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-8">
        <div className="container mx-auto px-6 text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
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

