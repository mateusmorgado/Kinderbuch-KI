"use client";
import { useEffect, useRef } from "react";
import { useLanguagePreference } from "./ExperienceControls";

const TEXT = {
  de: {
    confirmTitle: "Geschichte löschen?",
    confirmBody:
      "Die Geschichte und ihre Bilder werden für immer entfernt. Das kann nicht rückgängig gemacht werden.",
    cancel: "Behalten",
    confirm: "Löschen",
    deleting: "Wird gelöscht ...",
  },
  en: {
    confirmTitle: "Delete this story?",
    confirmBody:
      "The story and its pictures will be removed for good. This cannot be undone.",
    cancel: "Keep it",
    confirm: "Delete",
    deleting: "Deleting ...",
  },
};

// Asks before a story is deleted. Escape or a click outside cancels.
// `title` and `body` replace the story wording for other things to delete.
export default function ConfirmDeleteDialog({
  onCancel,
  onConfirm,
  isDeleting,
  title,
  body,
}) {
  const [language] = useLanguagePreference();
  const t = TEXT[language] || TEXT.de;
  const cancelRef = useRef(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const handleKey = (event) => {
      if (event.key === "Escape" && !isDeleting) onCancel();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onCancel, isDeleting]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 px-4 backdrop-blur-sm"
      onClick={() => !isDeleting && onCancel()}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-story-title"
        aria-describedby="delete-story-body"
        className="w-full max-w-sm rounded-[2rem] border-2 border-black/10 bg-[#fffaf1] p-7 text-center text-[#3d332d] shadow-[0_18px_50px_rgba(61,43,30,0.25)] night:border-white/10 night:bg-[#221d33] night:text-[#efe6ff]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-2xl">
          🗑️
        </div>
        <h2 id="delete-story-title" className="mb-2 text-2xl font-black">
          {title || t.confirmTitle}
        </h2>
        <p id="delete-story-body" className="mb-7 opacity-80">
          {body || t.confirmBody}
        </p>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="rounded-full px-5 py-2.5 font-bold ring-2 ring-black/15 transition hover:bg-black/5 focus:outline-none focus:ring-4 focus:ring-pink-300 night:ring-white/25 night:hover:bg-white/10"
          >
            {t.cancel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="rounded-full bg-red-600 px-5 py-2.5 font-bold text-white shadow-[0_3px_0_0_rgba(0,0,0,0.8)] transition hover:bg-red-700 focus:outline-none focus:ring-4 focus:ring-red-300 disabled:opacity-70"
          >
            {isDeleting ? t.deleting : t.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
