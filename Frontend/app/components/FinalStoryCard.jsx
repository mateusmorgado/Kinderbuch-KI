"use client";
import { useState } from "react";
import Image from "next/image";
import Button from "./Button";
import ConfirmDeleteDialog from "./ConfirmDeleteDialog";
import StoryNarrator from "./StoryNarrator";
import { useLanguagePreference } from "./ExperienceControls";

const TEXT = {
  de: {
    eyebrow: "Vorlesegeschichte",
    minutes: (n) => `${n} Min. Lesezeit`,
    idea: "Deine Idee",
    part: (n) => `Teil ${n}`,
    illustration: (title) => `Illustration zu „${title}“`,
    theEnd: "Ende",
    newStory: "Neue Geschichte ✨",
    delete: "Geschichte löschen",
    locale: "de-DE",
  },
  en: {
    eyebrow: "Bedtime story",
    minutes: (n) => `${n} min read`,
    idea: "Your idea",
    part: (n) => `Part ${n}`,
    illustration: (title) => `Illustration for “${title}”`,
    theEnd: "The End",
    newStory: "New story ✨",
    delete: "Delete story",
    locale: "en-GB",
  },
};

const toParagraphs = (text = "") =>
  text
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

export default function FinalStoryCard({ story, onDelete }) {
  const [language] = useLanguagePreference();
  const t = TEXT[language] || TEXT.de;
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!story) return null;

  const sections = (story.content || []).filter(
    (section) => section.text || section.image,
  );
  const hasParts = sections.length > 1;
  const wordCount = sections
    .map((section) => section.text || "")
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;
  const readingMinutes = Math.max(1, Math.round(wordCount / 150));
  const createdAt = new Date(story.createdAt).toLocaleDateString(t.locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const handleConfirmDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    const deleted = await onDelete(story._id);
    if (!deleted) {
      setIsDeleting(false);
      setShowConfirmDialog(false);
    }
  };

  return (
    <>
      {showConfirmDialog && (
        <ConfirmDeleteDialog
          isDeleting={isDeleting}
          onCancel={() => setShowConfirmDialog(false)}
          onConfirm={handleConfirmDelete}
        />
      )}

      <article className="mx-auto max-w-4xl overflow-hidden rounded-[2rem] border-2 border-black/10 bg-[#fffaf1]/95 text-[#3d332d] shadow-[0_18px_50px_rgba(61,43,30,0.16)] backdrop-blur-sm night:border-white/10 night:bg-[#221d33]/95 night:text-[#efe6ff]">
        <div className="h-2 bg-[image:var(--peace)]" />

        <header className="px-6 pt-8 sm:px-14 sm:pt-12 lg:px-20 lg:pt-14">
          <p className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-black uppercase tracking-[0.2em] text-[#8a6b55] night:text-[#c9b8e8]">
            <span className="h-2 w-2 rounded-full bg-[#ed8d58]" />
            {t.eyebrow}
            <span aria-hidden="true" className="hidden opacity-50 sm:inline">
              ·
            </span>
            <span className="basis-full tracking-[0.12em] sm:basis-auto">
              {createdAt}
            </span>
            <span aria-hidden="true" className="hidden opacity-50 sm:inline">
              ·
            </span>
            <span className="tracking-[0.12em]">
              {t.minutes(readingMinutes)}
            </span>
          </p>
          <h1 className="break-words text-4xl font-black leading-[1.05] sm:text-5xl">
            {story.title}
          </h1>
          {story.prompt && story.prompt.trim() !== story.title.trim() && (
            <p className="mt-5 max-w-2xl border-l-4 border-[#f7c898] pl-4 text-base italic text-[#6d5b4d] night:text-[#c9b8e8]">
              <span className="font-bold not-italic">{t.idea}:</span>{" "}
              {story.prompt}
            </p>
          )}
          {story._id && <StoryNarrator storyId={story._id} />}
        </header>

        <div className="px-6 py-8 sm:px-14 sm:py-12 lg:px-20">
          {sections.map((section, index) => (
            <section
              key={section.id ?? index}
              className={
                index > 0 ? "mt-12 border-t border-black/10 pt-12 night:border-white/10" : ""
              }
            >
              {hasParts && (
                <h2 className="mb-5 text-xs font-black uppercase tracking-[0.2em] text-[#b85c3d] night:text-[#f4a77f]">
                  {t.part(index + 1)}
                </h2>
              )}
              {section.image && (
                <figure className="mb-8 overflow-hidden rounded-3xl border-2 border-black/10 bg-[#f5eadb] shadow-[0_12px_30px_rgba(61,43,30,0.14)] night:border-white/10 night:bg-[#2d2742]">
                  <Image
                    src={section.image}
                    alt={t.illustration(story.title)}
                    width={1024}
                    height={1024}
                    unoptimized
                    loading={index === 0 ? "eager" : "lazy"}
                    className="aspect-[4/3] w-full object-cover"
                  />
                </figure>
              )}
              <div className="mx-auto max-w-2xl break-words text-lg leading-[1.85] sm:text-xl sm:leading-[1.9]">
                {toParagraphs(section.text).map((paragraph, pIndex) => (
                  <p
                    key={pIndex}
                    className={`mb-7 last:mb-0 ${
                      index === 0 && pIndex === 0
                        ? "first-letter:float-left first-letter:mr-2 first-letter:text-6xl first-letter:font-black first-letter:leading-[0.9] first-letter:text-[#ed8d58]"
                        : ""
                    }`}
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}

          <p
            className="mt-12 text-center text-sm font-black uppercase tracking-[0.3em] text-[#8a6b55] night:text-[#c9b8e8]"
            aria-label={t.theEnd}
          >
            ✦ {t.theEnd} ✦
          </p>
        </div>

        <footer className="flex flex-col items-center justify-between gap-4 border-t border-black/10 bg-[#fff3e2]/70 px-6 py-5 sm:flex-row sm:px-14 lg:px-20 night:border-white/10 night:bg-white/5">
          <Button variant="secondary" href="/generate" className="text-lg">
            {t.newStory}
          </Button>
          <button
            type="button"
            onClick={() => setShowConfirmDialog(true)}
            className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-50 focus:outline-none focus:ring-4 focus:ring-red-200 night:text-red-300 night:hover:bg-red-500/10"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3"
              />
            </svg>
            {t.delete}
          </button>
        </footer>
      </article>
    </>
  );
}
