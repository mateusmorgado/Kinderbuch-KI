"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { fetchNarration } from "../utils/stories";
import { getVoice } from "../utils/voice";
import { useLanguagePreference } from "./ExperienceControls";

const TEXT = {
  de: {
    heading: "Vorlesen lassen",
    voices: { female: "Erzählerin", male: "Erzähler", mine: "Meine Stimme" },
    recordOwn: "Mit deiner eigenen Stimme vorlesen? Nimm sie hier auf →",
    chooseVoice: "Stimme wählen",
    play: "Vorlesen",
    loading: "Die Stimme macht sich bereit …",
    loadingHint: "Beim ersten Mal dauert das ein paar Sekunden.",
    player: (voice) => `Die Geschichte, vorgelesen: ${voice}`,
  },
  en: {
    heading: "Read it to me",
    voices: { female: "Female voice", male: "Male voice", mine: "My voice" },
    recordOwn: "Want it read in your own voice? Record it here →",
    chooseVoice: "Choose a voice",
    play: "Read aloud",
    loading: "The voice is getting ready …",
    loadingHint: "The first time takes a few seconds.",
    player: (voice) => `The story, read aloud: ${voice}`,
  },
};

const PRESET_VOICES = ["female", "male"];

// Lets the story be read aloud by a female or male ElevenLabs voice, or by
// the user's own cloned voice. Pass `storyId` for a saved story, or `title`
// and `text` for a guest's unsaved one. Each recording is fetched once per
// page visit and kept as a blob URL.
export default function StoryNarrator({ storyId, title, text }) {
  const [language] = useLanguagePreference();
  const t = TEXT[language] || TEXT.de;

  const [voice, setVoice] = useState("female");
  const [audioUrl, setAudioUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  // Guests have no saved voice; they get a link to try one instead.
  const [ownVoice, setOwnVoice] = useState(storyId ? undefined : null);
  const urls = useRef({});
  const request = useRef(null);
  const audioRef = useRef(null);

  // Offer "My voice" once we know the user has recorded one.
  useEffect(() => {
    if (!storyId) return undefined;
    let active = true;
    getVoice()
      .then(({ voice: own }) => active && setOwnVoice(own))
      .catch(() => active && setOwnVoice(null));
    return () => {
      active = false;
    };
  }, [storyId]);

  const voices = ownVoice ? [...PRESET_VOICES, "mine"] : PRESET_VOICES;
  const voiceLabel = (option) =>
    option === "mine" ? ownVoice?.name || t.voices.mine : t.voices[option];

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
        title,
        text,
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
          className="flex flex-wrap rounded-full bg-white/80 p-1 ring-2 ring-black/10 night:bg-white/10 night:ring-white/15"
        >
          {voices.map((option) => (
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
              {voiceLabel(option)}
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
          aria-label={t.player(voiceLabel(voice))}
          className="mt-4 w-full"
        />
      )}

      {ownVoice === null && (
        <Link
          href="/voice"
          className="mt-3 inline-block text-sm font-bold text-[#b85c3d] underline-offset-4 hover:underline night:text-[#f4a77f]"
        >
          🎙️ {t.recordOwn}
        </Link>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm font-bold text-red-700 night:text-red-300">
          {error}
        </p>
      )}
    </section>
  );
}
