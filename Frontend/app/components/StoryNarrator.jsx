"use client";
import { useEffect, useRef, useState } from "react";
import { fetchNarration } from "../utils/stories";
import { useLanguagePreference } from "./ExperienceControls";

const TEXT = {
  de: {
    heading: "Vorlesen lassen",
    voices: { female: "Erzählerin", male: "Erzähler" },
    chooseVoice: "Stimme wählen",
    play: "Vorlesen",
    loading: "Die Stimme macht sich bereit …",
    loadingHint: "Beim ersten Mal dauert das ein paar Sekunden.",
    player: (voice) => `Die Geschichte, vorgelesen von der ${voice}`,
  },
  en: {
    heading: "Read it to me",
    voices: { female: "Female voice", male: "Male voice" },
    chooseVoice: "Choose a voice",
    play: "Read aloud",
    loading: "The voice is getting ready …",
    loadingHint: "The first time takes a few seconds.",
    player: (voice) => `The story, read by the ${voice.toLowerCase()}`,
  },
};

const VOICES = ["female", "male"];

// Lets the story be read aloud by a female or male ElevenLabs voice. Each
// recording is fetched once per page visit and kept as a blob URL.
export default function StoryNarrator({ storyId }) {
  const [language] = useLanguagePreference();
  const t = TEXT[language] || TEXT.de;

  const [voice, setVoice] = useState("female");
  const [audioUrl, setAudioUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const urls = useRef({});
  const request = useRef(null);
  const audioRef = useRef(null);

  // Free the recordings and stop a running request when leaving the page.
  useEffect(() => {
    const stored = urls.current;
    return () => {
      request.current?.abort();
      Object.values(stored).forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const load = async (nextVoice) => {
    setError(null);
    if (urls.current[nextVoice]) {
      setAudioUrl(urls.current[nextVoice]);
      return;
    }

    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setAudioUrl(null);
    setIsLoading(true);
    try {
      const blob = await fetchNarration({
        storyId,
        voice: nextVoice,
        signal: controller.signal,
      });
      urls.current[nextVoice] = URL.createObjectURL(blob);
      if (request.current === controller) setAudioUrl(urls.current[nextVoice]);
    } catch (err) {
      if (err.name !== "AbortError") setError(err.message);
    } finally {
      if (request.current === controller) setIsLoading(false);
    }
  };

  const chooseVoice = (nextVoice) => {
    if (nextVoice === voice) return;
    setVoice(nextVoice);
    // Switching while a recording is shown loads the other voice right away.
    if (audioUrl || isLoading) load(nextVoice);
  };

  // A newly loaded recording starts by itself, since the user asked for it.
  useEffect(() => {
    if (audioUrl) audioRef.current?.play().catch(() => {});
  }, [audioUrl]);

  return (
    <section
      aria-label={t.heading}
      className="mt-7 rounded-3xl border-2 border-black/10 bg-[#fff3e2]/80 p-4 sm:p-5 night:border-white/10 night:bg-white/5"
    >
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="mr-auto text-xs font-black uppercase tracking-[0.2em] text-[#8a6b55] night:text-[#c9b8e8]">
          🎧 {t.heading}
        </h2>
        <div
          role="radiogroup"
          aria-label={t.chooseVoice}
          className="flex rounded-full bg-white/80 p-1 ring-2 ring-black/10 night:bg-white/10 night:ring-white/15"
        >
          {VOICES.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={voice === option}
              onClick={() => chooseVoice(option)}
              className={`rounded-full px-3 py-1.5 text-sm font-bold transition focus:outline-none focus:ring-4 focus:ring-pink-300 ${
                voice === option
                  ? "bg-[#ed8d58] text-white shadow"
                  : "text-[#6d5b4d] hover:bg-[#f7c898]/40 night:text-[#e3d7fa] night:hover:bg-white/10"
              }`}
            >
              {t.voices[option]}
            </button>
          ))}
        </div>
        {!audioUrl && !isLoading && (
          <button
            type="button"
            onClick={() => load(voice)}
            className="flex items-center gap-2 rounded-full bg-[image:var(--peace)] px-5 py-2 text-base font-black text-[#2c2c2c] shadow-[0_3px_0_0_rgba(0,0,0,1)] ring-2 ring-black/80 transition hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-pink-300"
          >
            <span aria-hidden="true">▶</span> {t.play}
          </button>
        )}
      </div>

      {isLoading && (
        <div role="status" className="mt-4 flex items-center gap-3">
          <span
            aria-hidden="true"
            className="h-5 w-5 animate-spin rounded-full border-[3px] border-[#ed8d58] border-t-transparent"
          />
          <p className="text-sm font-bold">
            {t.loading}{" "}
            <span className="font-normal opacity-70">{t.loadingHint}</span>
          </p>
        </div>
      )}

      {audioUrl && (
        <audio
          ref={audioRef}
          key={audioUrl}
          src={audioUrl}
          controls
          aria-label={t.player(t.voices[voice])}
          className="mt-4 w-full"
        />
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm font-bold text-red-700 night:text-red-300">
          {error}
        </p>
      )}
    </section>
  );
}
