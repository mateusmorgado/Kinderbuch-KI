"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Button from "./Button";
import { useLanguagePreference } from "./ExperienceControls";

const FEATURES = [
  {
    icon: "✍️",
    title: { de: "KI-Geschichten", en: "AI stories" },
    text: {
      de: "Beschreibe eine Idee, und Gemini schreibt daraus eine kurze Kindergeschichte. Du siehst live, wie sie Wort für Wort entsteht.",
      en: "Describe an idea and Gemini turns it into a short children's story. You watch it appear word by word as it is written.",
    },
  },
  {
    icon: "🎨",
    title: { de: "Illustrationen", en: "Illustrations" },
    text: {
      de: "Zu jeder Geschichte malt die KI ein passendes Bild. Auch gespeicherte Geschichten bekommen nachträglich ein neues Bild.",
      en: "The AI paints a matching picture for every story. Saved stories can get a new picture later, too.",
    },
  },
  {
    icon: "📚",
    title: { de: "Meine Geschichten", en: "My stories" },
    text: {
      de: "Mit einem Konto speicherst du deine Lieblingsgeschichten in deiner Bibliothek, liest sie jederzeit wieder und blätterst durch sie.",
      en: "With an account you keep your favourite stories in your library, reread them any time and flip through them.",
    },
  },
  {
    icon: "🔊",
    title: { de: "Vorlesen", en: "Read aloud" },
    text: {
      de: "Lass dir jede Geschichte vorlesen, wahlweise mit einer weiblichen oder männlichen Stimme.",
      en: "Have any story read aloud to you, with a female or a male voice.",
    },
  },
  {
    icon: "🎙️",
    title: { de: "Meine Stimme", en: "My voice" },
    text: {
      de: "Nimm eine kurze Sprachprobe auf, und Geschichten werden mit deiner eigenen Stimme vorgelesen. Gäste können es einmal ausprobieren; die Stimme wird danach sofort gelöscht.",
      en: "Record a short voice sample and stories are read in your own voice. Guests can try it once; the voice is deleted right afterwards.",
    },
  },
  {
    icon: "🌙",
    title: { de: "Tag & Nacht, Deutsch & Englisch", en: "Day & night, German & English" },
    text: {
      de: "Ein sanfter Nachtmodus für die Gutenachtgeschichte und die ganze App auf Deutsch oder Englisch, oben rechts umschaltbar.",
      en: "A gentle night mode for bedtime, and the whole app in German or English. Switch both in the top right corner.",
    },
  },
  {
    icon: "🤖",
    title: { de: "Claude & ChatGPT", en: "Claude & ChatGPT" },
    text: {
      de: "Verbinde Kinderbuch mit Claude oder ChatGPT. Dein KI-Assistent schreibt und illustriert dann Geschichten und speichert sie direkt in deiner Bibliothek.",
      en: "Connect Kinderbuch to Claude or ChatGPT. Your AI assistant then writes and illustrates stories and saves them straight into your library.",
    },
  },
  {
    icon: "🧪",
    title: { de: "Ohne Konto ausprobieren", en: "Try it without an account" },
    text: {
      de: "Mit „Experiment starten“ schreibst du sofort eine Geschichte und hörst sie dir an, ganz ohne Anmeldung.",
      en: "With “Start experiment” you can write a story and listen to it right away, no sign-up needed.",
    },
  },
];

const TEXT = {
  de: {
    button: "Funktionen",
    title: "Das kann Kinderbuch",
    intro: "Alles, was du mit Kinderbuch machen kannst, auf einen Blick.",
    close: "Schließen",
  },
  en: {
    button: "Features",
    title: "What Kinderbuch can do",
    intro: "Everything you can do with Kinderbuch at a glance.",
    close: "Close",
  },
};

function FeaturesDialog({ language, onClose }) {
  const t = TEXT[language] || TEXT.de;
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();
    const handleKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 px-4 py-[max(1rem,env(safe-area-inset-top))] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="features-title"
        className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] border-2 border-black/10 bg-[#fffaf1] text-left text-[#3d332d] shadow-[0_18px_50px_rgba(61,43,30,0.25)] night:border-white/10 night:bg-[#221d33] night:text-[#efe6ff]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="overflow-y-auto p-6 sm:p-8">
          <h2 id="features-title" className="mb-1 text-2xl font-black leading-tight">
            {t.title} ✨
          </h2>
          <p className="mb-6 opacity-80">{t.intro}</p>

          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {FEATURES.map((feature) => (
              <li
                key={feature.icon}
                className="flex gap-3 rounded-2xl border-2 border-black/5 bg-white/80 p-4 night:border-white/10 night:bg-white/5"
              >
                <span
                  aria-hidden="true"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[image:var(--calm)] text-xl shadow-md"
                >
                  {feature.icon}
                </span>
                <div>
                  <h3 className="font-black leading-snug">
                    {feature.title[language] || feature.title.de}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed opacity-80">
                    {feature.text[language] || feature.text.de}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex justify-end border-t-2 border-black/5 px-6 py-4 night:border-white/10 sm:px-8">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="w-full rounded-full px-5 py-2.5 font-bold ring-2 ring-black/15 transition hover:bg-black/5 focus:outline-none focus:ring-4 focus:ring-pink-300 night:ring-white/25 night:hover:bg-white/10 sm:w-auto"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
}

// "Features" button that opens an overview of everything the app can do.
export default function FeaturesOverview({ className = "" }) {
  const [language] = useLanguagePreference();
  const t = TEXT[language] || TEXT.de;
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <Button
        variant="quaternary"
        className={className}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        {t.button} ✨
      </Button>
      {open && <FeaturesDialog language={language} onClose={close} />}
    </>
  );
}
