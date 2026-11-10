"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  useLanguagePreference,
  useNightMode,
} from "../components/ExperienceControls";

// Starts animations only once a demo scrolls into view.
export function useInView(options = { threshold: 0.35 }) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
       
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        observer.disconnect();
      }
    }, options);
    observer.observe(node);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [ref, inView];
}

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!query) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReduced(query.matches);
    const onChange = (event) => setReduced(event.matches);
    query.addEventListener?.("change", onChange);
    return () => query.removeEventListener?.("change", onChange);
  }, []);
  return reduced;
}

// Counts up to a number when it scrolls into view.
export function CountUp({ value, suffix = "" }) {
  const [ref, inView] = useInView({ threshold: 0.6 });
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShown(value);
      return;
    }
    const start = performance.now();
    const duration = 1200;
    let frame;
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setShown(Math.round(value * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, reduced, value]);

  return (
    <span ref={ref} className="tabular-nums">
      {shown}
      {suffix}
    </span>
  );
}

const pick = (text, language) => text[language] ?? text.de;

const SAMPLE_STORY = {
  de: "Es war einmal ein kleiner Drache namens Funke, der Angst vor der Dunkelheit hatte. Jede Nacht zählte er die Sterne, bis eines Abends ein Glühwürmchen an sein Fenster klopfte. „Komm mit“, flüsterte es, „die Nacht ist voller Lichter, du musst nur hinsehen.“ Und Funke flog los.",
  en: "Once upon a time there was a little dragon called Spark who was afraid of the dark. Every night he counted the stars, until one evening a firefly tapped on his window. “Come with me,” it whispered, “the night is full of lights, you only have to look.” And Spark flew off.",
};

// Story text appearing word by word, next to the NDJSON events the
// backend actually relays from Gemini.
export function StreamingDemo() {
  const [language] = useLanguagePreference();
  const [ref, inView] = useInView();
  const reduced = useReducedMotion();
  const words = pick(SAMPLE_STORY, language).split(" ");
  const [count, setCount] = useState(0);
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCount(words.length);
      return;
    }
    setCount(0);
    let current = 0;
    const timer = setInterval(() => {
      current += 1;
      setCount(current);
      if (current >= words.length) clearInterval(timer);
    }, 85);
    return () => clearInterval(timer);
  }, [inView, reduced, run, words.length]);

  const done = count >= words.length;
  const chunks = [];
  for (let i = 0; i < Math.min(count, words.length); i += 4) {
    chunks.push(words.slice(i, Math.min(i + 4, count)).join(" "));
  }
  const events = chunks.map((chunk, index) => ({
    id: index,
    line: `{"type":"text","text":"${chunk.slice(0, 26)}${chunk.length > 26 ? "…" : ""}"}`,
  }));
  if (done) events.push({ id: "done", line: '{"type":"done","storyId":"6731f…"}' });

  return (
    <div ref={ref} className="grid grid-cols-1 gap-3 md:grid-cols-[1.25fr_1fr]">
      <div className="min-h-[11.5rem] min-w-0 rounded-2xl bg-white/80 p-4 text-[0.95rem] leading-relaxed shadow-inner night:bg-black/20">
        {words.slice(0, count).map((word, index) => (
          <span key={`${run}-${index}`} className="ink-in">
            {word}{" "}
          </span>
        ))}
        {!done && <span className="quill-cursor">✒️</span>}
      </div>
      <div className="flex min-h-[11.5rem] min-w-0 flex-col rounded-2xl bg-[#1d1830] p-3 font-mono text-[0.7rem] leading-relaxed text-[#c9f7d4] shadow-inner night:ring-1 night:ring-white/15">
        <div className="mb-2 flex items-center gap-1.5 text-[0.65rem] text-white/50">
          <span className="h-2 w-2 rounded-full bg-[#ff5f57]" />
          <span className="h-2 w-2 rounded-full bg-[#febc2e]" />
          <span className="h-2 w-2 rounded-full bg-[#28c840]" />
          <span className="ml-2 truncate">POST /api/contents/generate-stream</span>
        </div>
        <div className="flex-1 space-y-0.5 overflow-hidden">
          {events.slice(-5).map(({ id, line }) => (
            <div key={`${run}-${id}`} className="ink-in truncate">
              <span className="text-white/40">› </span>
              {line}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setRun((value) => value + 1)}
          disabled={!done}
          className="mt-2 self-end rounded-full px-3 py-1 font-sans text-xs font-bold text-white ring-1 ring-white/30 transition hover:bg-white/10 disabled:opacity-30"
        >
          ↻ {language === "en" ? "Replay" : "Nochmal"}
        </button>
      </div>
    </div>
  );
}

// A picture that "develops" from a blurry sketch into the final image.
export function IllustrationDemo() {
  const [language] = useLanguagePreference();
  const [ref, inView] = useInView();
  const reduced = useReducedMotion();
  const [progress, setProgress] = useState(0);
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProgress(100);
      return;
    }
    setProgress(0);
    let current = 0;
    const timer = setInterval(() => {
      current = Math.min(100, current + 2);
      setProgress(current);
      if (current >= 100) clearInterval(timer);
    }, 55);
    return () => clearInterval(timer);
  }, [inView, reduced, run]);

  const blur = Math.round((1 - progress / 100) * 18);
  const done = progress >= 100;

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => done && setRun((value) => value + 1)}
      aria-label={language === "en" ? "Paint the picture again" : "Bild nochmal malen"}
      className="relative block aspect-[4/3] w-full overflow-hidden rounded-2xl bg-[image:var(--curiosity)] shadow-inner"
    >
      <Image
        src="/misc/dragon.webp"
        alt=""
        fill
        sizes="(min-width: 768px) 360px, 90vw"
        className="object-contain p-4 transition-[filter] duration-100"
        style={{
          filter: `blur(${blur}px) saturate(${0.2 + progress / 125}) contrast(${0.8 + progress / 500})`,
        }}
      />
      {!done && (
        <span
          aria-hidden="true"
          className="scan-line absolute inset-x-0 h-10 bg-gradient-to-b from-transparent via-white/60 to-transparent"
          style={{ top: `${progress}%` }}
        />
      )}
      <span className="absolute bottom-2 left-2 rounded-full bg-white/85 px-3 py-1 text-xs font-black text-[#2c2c2c] shadow">
        {done
          ? language === "en"
            ? "✓ Painted · tap to repaint"
            : "✓ Fertig · tippen zum Neumalen"
          : `${language === "en" ? "Painting" : "Malt"}… ${progress}%`}
      </span>
    </button>
  );
}

const VOICES = [
  { id: "female", name: "Carlotta", label: { de: "Weiblich", en: "Female" } },
  { id: "male", name: "Finn", label: { de: "Männlich", en: "Male" } },
  { id: "mine", name: "Mama", label: { de: "Meine Stimme", en: "My voice" } },
];

// Equaliser bars for the narration feature, with the three voice options.
export function NarrationDemo() {
  const [language] = useLanguagePreference();
  const [voice, setVoice] = useState("female");
  const bars = 28;
  const hue = { female: "from-pink-400 to-fuchsia-500", male: "from-sky-400 to-violet-500", mine: "from-orange-300 to-pink-500" }[voice];

  return (
    <div>
      <div
        aria-hidden="true"
        className="flex h-24 items-center justify-center gap-[3px] rounded-2xl bg-white/80 px-3 shadow-inner night:bg-black/20"
      >
        {Array.from({ length: bars }, (_, index) => (
          <span
            key={`${voice}-${index}`}
            className={`eq-bar w-1.5 rounded-full bg-gradient-to-t ${hue}`}
            style={{
              animationDelay: `${(index * 97) % 900}ms`,
              animationDuration: `${700 + ((index * 131) % 600)}ms`,
              height: `${30 + ((index * 53) % 60)}%`,
            }}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label={language === "en" ? "Voice" : "Stimme"}>
        {VOICES.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={voice === option.id}
            onClick={() => setVoice(option.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-black ring-2 transition ${
              voice === option.id
                ? "bg-[#2c2c2c] text-white ring-[#2c2c2c] night:bg-white night:text-[#221d33] night:ring-white"
                : "ring-black/15 hover:bg-black/5 night:ring-white/25 night:hover:bg-white/10"
            }`}
          >
            {pick(option.label, language)} · {option.name}
          </button>
        ))}
      </div>
    </div>
  );
}

const CLONE_STEPS = [
  { icon: "🎙️", label: { de: "Aufnehmen", en: "Record" } },
  { icon: "🧬", label: { de: "Klonen", en: "Clone" } },
  { icon: "📖", label: { de: "Vorlesen", en: "Narrate" } },
  { icon: "🗑️", label: { de: "Löschen", en: "Delete" } },
];

// The voice-cloning flow, stepping through record → clone → narrate → delete.
export function VoiceCloneDemo() {
  const [language] = useLanguagePreference();
  const [ref, inView] = useInView();
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!inView || reduced) return;
    const timer = setInterval(
      () => setStep((value) => (value + 1) % CLONE_STEPS.length),
      1500,
    );
    return () => clearInterval(timer);
  }, [inView, reduced]);

  return (
    <ol ref={ref} className="grid grid-cols-4 gap-2">
      {CLONE_STEPS.map((item, index) => {
        const active = index === step;
        const past = index < step;
        return (
          <li key={item.icon} className="flex flex-col items-center gap-2 text-center">
            <span
              className={`relative flex h-14 w-14 items-center justify-center rounded-full text-2xl transition duration-500 ${
                active
                  ? "scale-110 bg-[image:var(--adventure)] shadow-lg"
                  : past
                    ? "bg-[image:var(--calm)]"
                    : "bg-black/5 grayscale night:bg-white/10"
              }`}
            >
              {active && <span aria-hidden="true" className="pulse-ring absolute inset-0 rounded-full" />}
              <span aria-hidden="true">{item.icon}</span>
            </span>
            <span className={`text-xs font-black transition ${active ? "opacity-100" : "opacity-60"}`}>
              {pick(item.label, language)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

const CHAT = {
  de: {
    ask: "Schreib mir mit Kinderbuch eine Gutenachtgeschichte über eine mutige Schnecke.",
    reply: "Fertig! „Sami, die mutige Schnecke“ liegt mit Bild in deiner Bibliothek.",
  },
  en: {
    ask: "Use Kinderbuch to write a bedtime story about a brave snail.",
    reply: "Done! “Sam the Brave Snail” is in your library, picture included.",
  },
};

// A chat in Claude or ChatGPT calling Kinderbuch's MCP tools.
export function McpDemo() {
  const [language] = useLanguagePreference();
  const [ref, inView] = useInView();
  const reduced = useReducedMotion();
  const [stage, setStage] = useState(0);
  const text = pick(CHAT, language);

  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStage(5);
      return;
    }
    const timer = setInterval(() => setStage((value) => (value + 1) % 8), 1100);
    return () => clearInterval(timer);
  }, [inView, reduced]);

  const tool = (name, startAt) =>
    stage >= startAt && (
      <div className="ink-in flex items-center gap-2 self-start rounded-xl bg-[#1d1830] px-3 py-1.5 font-mono text-[0.7rem] text-[#c9f7d4]">
        {stage > startAt ? "✓" : <span className="spin inline-block">◌</span>}
        <span className="text-white/50">kinderbuch ·</span> {name}
      </div>
    );

  return (
    <div ref={ref} className="flex min-h-[13.5rem] flex-col gap-2 rounded-2xl bg-white/80 p-3 text-sm shadow-inner night:bg-black/20">
      {stage >= 1 && (
        <div className="ink-in max-w-[85%] self-end rounded-2xl rounded-br-md bg-[#2c2c2c] px-3 py-2 text-white night:bg-white night:text-[#221d33]">
          {text.ask}
        </div>
      )}
      {tool("write_story", 2)}
      {tool("illustrate_story", 3)}
      {stage >= 5 && (
        <div className="ink-in max-w-[85%] self-start rounded-2xl rounded-bl-md bg-[image:var(--calm)] px-3 py-2 text-[#2c2c2c]">
          {text.reply} 🐌
        </div>
      )}
    </div>
  );
}

// Real switches: they change the whole app's theme and language.
export function SettingsDemo() {
  const [language, setLanguage] = useLanguagePreference();
  const [isNight, setIsNight] = useNightMode();

  return (
    <div className="flex items-center gap-4">
      <span
        aria-hidden="true"
        className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-full text-4xl shadow-lg transition duration-700 ${
          isNight ? "rotate-[360deg] bg-[#2f2748]" : "bg-[image:var(--peace)]"
        }`}
      >
        {isNight ? "🌙" : "☀️"}
      </span>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setIsNight((value) => !value)}
          className="rounded-full px-4 py-2 text-sm font-black ring-2 ring-black/15 transition hover:scale-105 hover:bg-black/5 night:ring-white/25 night:hover:bg-white/10"
        >
          {isNight
            ? language === "en" ? "☀️ Back to day" : "☀️ Zurück zum Tag"
            : language === "en" ? "🌙 Try night mode" : "🌙 Nachtmodus testen"}
        </button>
        <button
          type="button"
          onClick={() => setLanguage(language === "en" ? "de" : "en")}
          className="rounded-full px-4 py-2 text-sm font-black ring-2 ring-black/15 transition hover:scale-105 hover:bg-black/5 night:ring-white/25 night:hover:bg-white/10"
        >
          {language === "en" ? "🇩🇪 Auf Deutsch" : "🇬🇧 In English"}
        </button>
      </div>
    </div>
  );
}

const BOOKS = [
  { title: { de: "Funke & die Nacht", en: "Spark & the Night" }, bg: "var(--adventure)", turn: "-translate-x-8 -rotate-8 group-hover:-translate-x-16 group-hover:-rotate-12" },
  { title: { de: "Sami die Schnecke", en: "Sam the Snail" }, bg: "var(--curiosity)", turn: "-translate-y-1 group-hover:-translate-y-3" },
  { title: { de: "Die Mondkatze", en: "The Moon Cat" }, bg: "var(--peace)", turn: "translate-x-8 rotate-8 group-hover:translate-x-16 group-hover:rotate-12" },
];

// A fan of saved stories that spreads out on hover.
export function LibraryDemo() {
  const [language] = useLanguagePreference();
  return (
    <div className="group relative flex h-36 items-center justify-center" aria-hidden="true">
      {BOOKS.map((book, index) => (
        <div
          key={book.bg}
          className={`absolute flex h-32 w-24 items-end rounded-r-xl rounded-l-sm p-2 text-left text-xs font-black leading-tight text-[#2c2c2c] shadow-[4px_4px_0_0_rgba(0,0,0,0.85)] ring-2 ring-black transition duration-500 ${book.turn}`}
          style={{ backgroundImage: book.bg, zIndex: index === 1 ? 2 : 1 }}
        >
          <span className="absolute inset-y-0 left-1.5 w-1 rounded bg-black/15" />
          {pick(book.title, language)}
        </div>
      ))}
    </div>
  );
}
