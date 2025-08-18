"use client";

import Image from "next/image";
import Link from "next/link";
import { useI18n } from "@/contexts/I18nContext";

export default function Home() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-[#0073ea] text-white p-4 shadow-md">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">{t("app_title")}</h1>
          <div className="space-x-4">
            <Link href="/login" className="px-4 py-2 bg-white text-[#0073ea] rounded hover:bg-gray-100 transition-colors">
              {t("login")}
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-grow container mx-auto p-6 md:p-8 flex flex-col md:flex-row items-center justify-center gap-8">
        <div className="md:w-1/2 space-y-6">
          <h2 className="text-4xl font-bold text-gray-800">{t("landing_headline")}</h2>
          <p className="text-xl text-gray-600">
            {t("landing_desc")}
          </p>
          <div className="pt-4">
            <Link href="/dashboard" 
              className="px-6 py-3 bg-[#0073ea] text-white rounded-md hover:text-[#0060c0] transition-colors inline-block">
              {t("access_dashboard")}
            </Link>
          </div>
        </div>
        
        <div className="md:w-1/2 flex justify-center">
          <div className="relative w-full max-w-md h-80 border-2 border-[#0073ea] rounded-lg overflow-hidden shadow-xl">
            <div className="absolute inset-0 bg-gradient-to-br from-[#6200ee] to-[#9c4dff] opacity-10"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center p-6">
                <h3 className="text-2xl font-bold text-gray-800 mb-4">{t("features")}</h3>
                <ul className="text-left space-y-2">
                  <li className="flex items-center"><span className="mr-2 text-[#0073ea]">✓</span> {t("feature_attendance")}</li>
                  <li className="flex items-center"><span className="mr-2 text-[#0073ea]">✓</span> {t("feature_profiles")}</li>
                  <li className="flex items-center"><span className="mr-2 text-[#0073ea]">✓</span> {t("feature_reports")}</li>
                  <li className="flex items-center"><span className="mr-2 text-[#0073ea]">✓</span> {t("feature_access_any")}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-100 p-4 border-t border-gray-200">
        <div className="container mx-auto text-center text-gray-600">
          <p>{t("footer_copyright", { year: new Date().getFullYear() })}</p>
        </div>
      </footer>
    </div>
  );
}

