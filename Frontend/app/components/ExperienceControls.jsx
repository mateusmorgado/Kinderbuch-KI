"use client";

import { createContext, useContext, useEffect, useState } from "react";

const ExperiencePreferencesContext = createContext(null);

export function ExperiencePreferencesProvider({ children }) {
  const [language, setLanguage] = useState("de");
  const [isNight, setIsNight] = useState(false);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  useEffect(() => {
    const storedLanguage = window.localStorage.getItem("language");
    if (storedLanguage === "de" || storedLanguage === "en") {
      // Preferences are read after hydration to avoid server/client markup differences.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLanguage(storedLanguage);
    }
    const storedNightMode = window.localStorage.getItem("nightMode");
    setIsNight(storedNightMode === "true");
    setPreferencesLoaded(true);
  }, []);

  useEffect(() => {
    if (!preferencesLoaded) return;

    window.localStorage.setItem("language", language);
    document.documentElement.lang = language;
  }, [language, preferencesLoaded]);

  useEffect(() => {
    if (!preferencesLoaded) return;

    document.documentElement.dataset.theme = isNight ? "night" : "day";
    window.localStorage.setItem("nightMode", String(isNight));
  }, [isNight, preferencesLoaded]);

  return (
    <ExperiencePreferencesContext.Provider
      value={{ language, setLanguage, isNight, setIsNight }}
    >
      {children}
    </ExperiencePreferencesContext.Provider>
  );
}

export function useExperiencePreferences() {
  const preferences = useContext(ExperiencePreferencesContext);
  if (!preferences) {
    throw new Error(
      "useExperiencePreferences must be used inside ExperiencePreferencesProvider",
    );
  }
  return preferences;
}

export function useLanguagePreference() {
  const { language, setLanguage } = useExperiencePreferences();
  return [language, setLanguage];
}

export function useNightMode() {
  const { isNight, setIsNight } = useExperiencePreferences();
  return [isNight, setIsNight];
}

export default function ExperienceControls() {
  const [language, setLanguage] = useLanguagePreference();
  const [isNight, setIsNight] = useNightMode();

  return (
    <div className="flex items-center gap-2" aria-label="Experience settings">
      <button
        type="button"
        onClick={() =>
          setLanguage((currentLanguage) =>
            currentLanguage === "de" ? "en" : "de",
          )
        }
        className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-black/20 bg-white/80 text-sm font-black shadow-md transition hover:scale-105 hover:bg-pink-100 focus:outline-none focus:ring-4 focus:ring-pink-300"
        aria-label={
          language === "de" ? "Switch to English" : "Zu Deutsch wechseln"
        }
        title={language === "de" ? "English" : "Deutsch"}
      >
        {language === "de" ? "E" : "D"}
      </button>
      <button
        type="button"
        onClick={() => setIsNight((currentIsNight) => !currentIsNight)}
        className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-black/20 bg-white/80 text-xl shadow-md transition hover:scale-105 hover:bg-indigo-100 focus:outline-none focus:ring-4 focus:ring-indigo-300"
        aria-label={isNight ? "Switch to day mode" : "Nachtmodus einschalten"}
        title={isNight ? "Day mode" : "Night mode"}
      >
        {isNight ? "☀" : "☾"}
      </button>
    </div>
  );
}
