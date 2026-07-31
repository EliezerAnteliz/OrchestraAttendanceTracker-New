"use client";

import Link from "next/link";
import { useI18n } from "@/contexts/I18nContext";
import { MdMusicNote, MdPeople, MdAssignment, MdBarChart, MdCheckCircle, MdSchedule } from "react-icons/md";

export default function Home() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col min-h-screen bg-[#FAF7F2]">
      {/* Header — mismo logo (ícono 2x2 + wordmark Newsreader) que el
          sidebar de la app, sobre el mismo fondo crema. */}
      <header className="border-b border-[#E3DDD1]">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center gap-3">
          <Link href="/" className="inline-flex items-center gap-2 hover:opacity-80 transition-opacity min-w-0">
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
              className="text-lg sm:text-xl leading-none text-[#1B1917] truncate"
              style={{ fontFamily: 'var(--font-newsreader), serif', letterSpacing: '-0.02em' }}
            >
              Site<span style={{ color: '#C2492B' }}>Track</span>
            </span>
          </Link>
          <Link
            href="/login"
            className="flex-shrink-0 px-4 py-2 sm:px-5 sm:py-2.5 bg-[#C2492B] text-white rounded-lg hover:bg-[#A83A20] transition-colors text-sm font-medium whitespace-nowrap"
          >
            {t("login")}
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-grow">
        <div className="container mx-auto px-6 py-16">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
            {/* Left Content */}
            <div className="lg:w-1/2 space-y-6">
              <div className="space-y-4">
                <h2
                  className="text-4xl lg:text-[52px] leading-[1.05] text-[#1B1917]"
                  style={{ fontFamily: 'var(--font-newsreader), serif', fontWeight: 400, letterSpacing: '-0.02em' }}
                >
                  {t("landing_headline")}
                </h2>
                <p className="text-lg text-[#56504A] leading-relaxed">
                  {t("landing_desc")}
                </p>
              </div>

              {/* El botón "Empezar Gratis" → /signup se quitó (26/07): el
                  autorregistro público dejaba elegir una organización real
                  de una lista y auto-asignarse el rol Staff (puede editar
                  estudiantes) sin ninguna aprobación. Ahora todas las
                  cuentas se crean desde Admin/Usuarios (invitación por
                  correo). */}
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/dashboard"
                  className="px-6 py-3 sm:px-8 sm:py-3.5 bg-[#C2492B] text-white rounded-lg hover:bg-[#A83A20] transition-colors text-center font-medium text-sm sm:text-base">
                  {t("access_dashboard")}
                </Link>
              </div>
            </div>

            {/* Right Content - Features Grid */}
            <div className="lg:w-1/2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FeatureCard
                  icon={<MdPeople size={26} />}
                  title={t("student_management")}
                  description={t("student_management_desc")}
                />
                <FeatureCard
                  icon={<MdAssignment size={26} />}
                  title={t("attendance_recording")}
                  description={t("attendance_recording_desc")}
                />
                <FeatureCard
                  icon={<MdBarChart size={26} />}
                  title={t("detailed_reports")}
                  description={t("detailed_reports_desc")}
                />
                <FeatureCard
                  icon={<MdSchedule size={26} />}
                  title={t("access_247")}
                  description={t("access_247_desc")}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Benefits Section */}
        <div className="bg-[#FFFDFA] border-y border-[#E3DDD1] py-16">
          <div className="container mx-auto px-6">
            <div className="text-center mb-12">
              <h3
                className="text-3xl text-[#1B1917] mb-3"
                style={{ fontFamily: 'var(--font-newsreader), serif', fontWeight: 400, letterSpacing: '-0.02em' }}
              >
                {t("benefits_title")}
              </h3>
              <p className="text-lg text-[#8A8177]">{t("benefits_desc")}</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <BenefitCard
                icon={<MdCheckCircle size={40} />}
                title={t("easy_to_use")}
                description={t("easy_to_use_desc")}
              />
              <BenefitCard
                icon={<MdBarChart size={40} />}
                title={t("smart_reports")}
                description={t("smart_reports_desc")}
              />
              <BenefitCard
                icon={<MdMusicNote size={40} />}
                title={t("for_musicians")}
                description={t("for_musicians_desc")}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#F4F0E8] border-t border-[#E7E0D2] py-8">
        <div className="container mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <span
              className="grid grid-cols-2 grid-rows-2 gap-[2.5px] flex-shrink-0"
              style={{ width: 16, height: 16 }}
              aria-hidden="true"
            >
              <span className="bg-[#1B1917] rounded-[2px]" />
              <span className="bg-[#1B1917] rounded-[2px]" />
              <span className="bg-[#1B1917] rounded-[2px]" />
              <span className="bg-[#C2492B] rounded-[2px]" />
            </span>
            <span
              className="text-base leading-none text-[#1B1917]"
              style={{ fontFamily: 'var(--font-newsreader), serif', letterSpacing: '-0.02em' }}
            >
              Site<span style={{ color: '#C2492B' }}>Track</span>
            </span>
          </div>
          <p className="text-[#8A8177] text-sm">{t("footer_copyright", { year: new Date().getFullYear() })}</p>
        </div>
      </footer>
    </div>
  );
}

// Componente para las tarjetas de características — un solo tratamiento de
// color (fondo crema + ícono terracota) para las 4, en vez de un color
// distinto por tarjeta (azul/verde/morado/naranja), consistente con el
// resto de la app, que nunca usa un sistema de íconos multicolor.
function FeatureCard({ icon, title, description }: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-[#FFFDFA] rounded-xl p-5 border border-[#EAE3D6] hover:border-[#D6C9BB] transition-colors">
      <div className="bg-[#EFE9DD] text-[#C2492B] p-2.5 rounded-lg mb-3 w-fit">
        {icon}
      </div>
      <h4 className="font-medium text-[#1B1917] mb-1.5 text-[15px]">{title}</h4>
      <p className="text-[13px] text-[#8A8177] leading-relaxed">{description}</p>
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
      <div className="text-[#C2492B] mb-4 flex justify-center">
        {icon}
      </div>
      <h4 className="text-xl text-[#1B1917] mb-3 font-medium">{title}</h4>
      <p className="text-[#56504A] leading-relaxed">{description}</p>
    </div>
  );
}
