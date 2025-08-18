"use client";

import React from "react";
import { I18nProvider, useI18n } from "@/contexts/I18nContext";

function LanguageFloatingButton() {
  const { lang, toggleLanguage, t } = useI18n();
  return (
    <button
      onClick={toggleLanguage}
      aria-label={lang === "es" ? t("switch_to_en") : t("switch_to_es")}
      className="fixed bottom-4 right-4 z-50 px-3 py-2 rounded-full shadow-lg border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50"
      title={lang === "es" ? t("switch_to_en") : t("switch_to_es")}
    >
      {lang === "es" ? t("lang_en") : t("lang_es")}
    </button>
  );
}

export default function I18nRoot({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      {children}
      <LanguageFloatingButton />
    </I18nProvider>
  );
}
