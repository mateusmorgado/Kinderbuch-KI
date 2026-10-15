"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import toast from "react-hot-toast";
import Button from "../components/Button";
import ConfirmDeleteDialog from "../components/ConfirmDeleteDialog";
import ExperienceControls, {
  useLanguagePreference,
} from "../components/ExperienceControls";
import LoadingSpinner from "../components/LoadingSpinner";
import { deleteStory, generateStoryImage } from "../utils/stories";

const TEXT = {
  de: {
    opening: "Geschichte wird geöffnet ...",
    fallbackTitle: "Deine Geschichte",
    newStory: "Neue Geschichte",
    yourStory: "Deine Geschichte",
    eyebrow: "Vorlesegeschichte",
    lastScene: "Letzte Szene",
    makePicture: "Mach daraus ein Bild.",
    createImage: "Bild erstellen",
    recreateImage: "Bild neu erstellen",
    imageAlt: "Illustration der letzten Szene",
    imageCaption: "Eine Illustration aus dem letzten Abschnitt deiner Geschichte.",
    imageSaved: "Bild wurde in deiner Bibliothek gespeichert.",
    imageNotSaved: "Das Bild wurde erstellt, konnte aber nicht gespeichert werden.",
    imageFailed: "Bild konnte nicht erstellt werden!",
    loginHint: "Melde dich an, damit deine Geschichten und Bilder in deiner Bibliothek gespeichert werden.",
    anotherStory: "Noch eine Geschichte ✨",
    myStories: "Meine Geschichten",
    delete: "Geschichte löschen",
    deleted: "Geschichte gelöscht.",
    deleteFailed: "Die Geschichte konnte nicht gelöscht werden.",
  },
  en: {
    opening: "Opening your story ...",
    fallbackTitle: "Your story",
    newStory: "New story",
    yourStory: "Your story",
    eyebrow: "Bedtime story",
    lastScene: "Last scene",
    makePicture: "Turn it into a picture.",
    createImage: "Create picture",
    recreateImage: "Create a new picture",
    imageAlt: "Illustration of the last scene",
    imageCaption: "An illustration of the last part of your story.",
    imageSaved: "The picture was saved to your library.",
    imageNotSaved: "The picture was created but could not be saved.",
    imageFailed: "The picture could not be created!",
    loginHint: "Log in so your stories and pictures are saved to your library.",
    anotherStory: "Another story ✨",
    myStories: "My stories",
    delete: "Delete story",
    deleted: "Story deleted.",
    deleteFailed: "The story could not be deleted.",
  },
};

export default function StoryResultPage() {
  const router = useRouter();
  const [language] = useLanguagePreference();
  const t = TEXT[language] || TEXT.de;
  const [storyData, setStoryData] = useState(null);
  const [storyImage, setStoryImage] = useState("");
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const storedStory = sessionStorage.getItem("generatedStory");
    if (!storedStory) {
      router.replace("/generate");
      return;
    }

    try {
      // Browser storage is only available after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStoryData(JSON.parse(storedStory));
    } catch {
      sessionStorage.removeItem("generatedStory");
      router.replace("/generate");
    }
  }, [router]);

  if (!storyData) {
    return (
      <main className="flex h-full items-center justify-center px-4 text-center">
        <p className="text-xl">{t.opening}</p>
      </main>
    );
  }

  const storyTitle =
    storyData.prompt.trim().split(/[.!?]/)[0].slice(0, 90) || t.fallbackTitle;
  const paragraphs = storyData.story
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const lastParagraph = paragraphs[paragraphs.length - 1] || storyData.story;

  const handleGenerateImage = async () => {
    if (isGeneratingImage) return;

    setIsGeneratingImage(true);
    try {
      const data = await generateStoryImage({
        paragraph: lastParagraph,
        storyId: storyData.storyId,
      });
      setStoryImage(data.image);

      if (data.saved) {
        toast.success(t.imageSaved);
      } else if (storyData.storyId) {
        toast.error(t.imageNotSaved);
      }
    } catch (error) {
      toast.error(error.message || t.imageFailed);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteStory(storyData.storyId);
      sessionStorage.removeItem("generatedStory");
      toast.success(t.deleted);
      router.push("/mystories");
    } catch (error) {
      console.error("Error deleting story:", error);
      toast.error(t.deleteFailed);
      setIsDeleting(false);
      setShowConfirmDialog(false);
    }
  };

  return (
    <main className="h-full overflow-y-auto px-4 pb-12 sm:px-8">
      {isGeneratingImage && <LoadingSpinner />}
      {showConfirmDialog && (
        <ConfirmDeleteDialog
          isDeleting={isDeleting}
          onCancel={() => setShowConfirmDialog(false)}
          onConfirm={handleConfirmDelete}
        />
      )}
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-4 py-5 sm:py-7">
        <Button
          type="button"
          variant="tertiary"
          className="px-0 text-base shadow-none"
          onClick={() => router.push("/generate")}
        >
          <span aria-hidden="true">←</span> {t.newStory}
        </Button>
        <ExperienceControls />
      </header>

      <section className="mx-auto max-w-5xl pb-8">
        <div className="mb-8 border-b-2 border-black/10 pb-7 sm:mb-10 sm:pb-9 night:border-white/10">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.24em] text-[#b85c3d] night:text-[#f4a77f]">
            {t.yourStory}
          </p>
          <h1 className="max-w-4xl text-4xl font-black leading-[1.05] sm:text-6xl">
            {storyTitle}
          </h1>
        </div>

        <article className="mx-auto max-w-4xl rounded-[2rem] border-2 border-black/10 bg-[#fffaf1]/95 text-[#3d332d] shadow-[0_18px_50px_rgba(61,43,30,0.16)] backdrop-blur-sm night:border-white/10 night:bg-[#221d33]/95 night:text-[#efe6ff]">
          <div className="h-2 rounded-t-[2rem] bg-[image:var(--peace)]" />
          <div className="px-6 py-8 sm:px-14 sm:py-12 lg:px-20 lg:py-16">
            <div className="mb-8 flex items-center gap-3 text-xs font-black uppercase tracking-[0.2em] text-[#8a6b55] night:text-[#c9b8e8]">
              <span className="h-2 w-2 rounded-full bg-[#ed8d58]" />
              {t.eyebrow}
            </div>

            <div className="max-w-2xl min-w-0 whitespace-pre-wrap break-words text-left text-lg leading-[1.85] sm:text-xl sm:leading-[1.9]">
              {paragraphs.map((paragraph, index) => (
                <p key={index} className="mb-7 last:mb-0">
                  {paragraph}
                </p>
              ))}
            </div>

            <div className="mt-12 border-t border-black/10 pt-8 night:border-white/10">
              <div className="flex flex-col items-center justify-between gap-5 sm:flex-row">
                <div className="text-center sm:text-left">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[#8a6b55] night:text-[#c9b8e8]">
                    {t.lastScene}
                  </p>
                  <p className="mt-1 text-sm text-[#6d5b4d] night:text-[#c9b8e8]">
                    {t.makePicture}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleGenerateImage}
                  disabled={isGeneratingImage}
                >
                  {storyImage ? t.recreateImage : t.createImage}
                </Button>
              </div>

              {storyImage && (
                <figure className="mt-8 overflow-hidden rounded-3xl border-2 border-black/10 bg-[#f5eadb] shadow-[0_12px_30px_rgba(61,43,30,0.14)] night:border-white/10 night:bg-[#2d2742]">
                  <Image
                    src={storyImage}
                    alt={t.imageAlt}
                    width={1024}
                    height={1024}
                    unoptimized
                    className="h-auto w-full object-cover"
                  />
                  <figcaption className="px-5 py-3 text-center text-sm italic text-[#6d5b4d] night:text-[#c9b8e8]">
                    {t.imageCaption}
                  </figcaption>
                </figure>
              )}
            </div>

            <div className="mt-10 border-t border-black/10 pt-7 text-center night:border-white/10">
              {!storyData.storyId && (
                <p className="mb-5 text-sm text-[#6d5b4d] night:text-[#c9b8e8]">
                  {t.loginHint}
                </p>
              )}
              <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Button type="button" onClick={() => router.push("/generate")}>
                  {t.anotherStory}
                </Button>
                {storyData.storyId && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => router.push("/mystories")}
                  >
                    {t.myStories}
                  </Button>
                )}
              </div>
              {storyData.storyId && (
                <button
                  type="button"
                  onClick={() => setShowConfirmDialog(true)}
                  className="mx-auto mt-6 flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-50 focus:outline-none focus:ring-4 focus:ring-red-200 night:text-red-300 night:hover:bg-red-500/10"
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
              )}
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
