"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import ConfirmDeleteDialog from "./ConfirmDeleteDialog";
import { useLanguagePreference } from "./ExperienceControls";

const TEXT = {
  de: {
    pages: (n) => (n === 1 ? "1 Seite" : `${n} Seiten`),
    read: "Lesen →",
    delete: (title) => `„${title}“ löschen`,
    locale: "de-DE",
  },
  en: {
    pages: (n) => (n === 1 ? "1 page" : `${n} pages`),
    read: "Read →",
    delete: (title) => `Delete “${title}”`,
    locale: "en-GB",
  },
};

// One story in the library: opens the story, and has its own delete button.
export default function StoryCard({ story, onDelete }) {
  const [language] = useLanguagePreference();
  const t = TEXT[language] || TEXT.de;
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const formattedDate = new Date(story.createdAt).toLocaleDateString(t.locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const firstText = story.content[0]?.text || "";
  const previewText =
    firstText.length > 100 ? `${firstText.substring(0, 100)} ...` : firstText;
  // Illustration saved with the story, if any
  const coverImage = story.content.find((section) => section.image)?.image;

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    const deleted = await onDelete(story._id);
    // A deleted card disappears from the list; otherwise close the dialog.
    if (!deleted) {
      setIsDeleting(false);
      setShowConfirmDialog(false);
    }
  };

  return (
    <div className="group relative h-full">
      {showConfirmDialog && (
        <ConfirmDeleteDialog
          isDeleting={isDeleting}
          onCancel={() => setShowConfirmDialog(false)}
          onConfirm={handleConfirmDelete}
        />
      )}

      <Link
        href={`/story/${story._id}`}
        className="block h-full rounded-xl bg-[image:var(--peace)] p-[3px] transition-transform duration-300 hover:scale-[1.02] focus:outline-none focus-visible:ring-4 focus-visible:ring-pink-300"
      >
        <div className="flex h-full flex-col overflow-hidden rounded-lg bg-[rgba(255,255,255,0.92)] shadow-[inset_0px_4px_20px_0px_rgba(0,10,120,0.15)] backdrop-blur-md night:bg-[#221d33]/95 night:text-[#efe6ff]">
          {coverImage && (
            <Image
              src={coverImage}
              alt=""
              width={400}
              height={200}
              unoptimized
              className="h-36 w-full object-cover"
            />
          )}
          <div className="flex-1 p-5">
            <h3 className="truncate pr-8 text-xl font-bold">{story.title}</h3>
            <p className="mb-3 text-sm text-gray-500 night:text-[#c9b8e8]">
              {formattedDate}
            </p>
            <p className="line-clamp-3 text-sm text-gray-800 night:text-[#efe6ff]/85">
              {previewText}
            </p>
          </div>

          <div className="flex items-center justify-between bg-[rgba(255,245,230,0.7)] px-5 py-3 night:bg-white/5">
            <span className="text-sm text-gray-600 night:text-[#c9b8e8]">
              📖 {t.pages(story.content.length)}
            </span>
            <span className="text-sm font-medium text-[#7c6cf0] night:text-[#c9b8e8]">
              {t.read}
            </span>
          </div>
        </div>
      </Link>

      <button
        type="button"
        onClick={() => setShowConfirmDialog(true)}
        aria-label={t.delete(story.title)}
        title={t.delete(story.title)}
        className={`absolute right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-red-700 shadow-md ring-2 ring-black/10 transition hover:scale-110 hover:bg-red-50 focus:outline-none focus:ring-4 focus:ring-red-300 night:bg-[#2d2742] night:text-red-300 ${
          coverImage ? "top-3" : "top-4"
        }`}
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
      </button>
    </div>
  );
}
