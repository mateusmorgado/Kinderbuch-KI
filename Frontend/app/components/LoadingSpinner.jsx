"use client";

import { useLanguagePreference } from "./ExperienceControls";

export default function LoadingSpinner() {
  const [language] = useLanguagePreference();

  return (
    <div className="fixed inset-0 bg-white/15 night:bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="text-center">
        <div className="animate-bounce mb-4">
          <span className="text-6xl">✨</span>
        </div>
        <p className="text-3xl font-bold">
          {language === "de" ? "Es wird gezaubert ..." : "Working some magic ..."}
        </p>
      </div>
    </div>
  );
}
