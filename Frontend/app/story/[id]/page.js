"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import toast from "react-hot-toast";
import LoadingSpGeneric from "../../components/LoadingSpGeneric";
import LoadingSpinner from "../../components/LoadingSpinner";
import Button from "../../components/Button";
import FinalStoryCard from "../../components/FinalStoryCard";
import { getToken, handleExpiredSession, isAuthError } from "../../utils/auth";
import { deleteStory, illustrateSavedStory } from "../../utils/stories";
import ExperienceControls, {
  useLanguagePreference,
} from "../../components/ExperienceControls";

const TEXT = {
  de: {
    back: "Meine Geschichten",
    notFound: "Diese Geschichte konnte nicht geladen werden.",
    notFoundHint: "Vielleicht wurde sie gelöscht, oder die Verbindung ist kurz weg.",
    deleteFailed: "Die Geschichte konnte nicht gelöscht werden.",
    deleted: "Geschichte gelöscht.",
    imageSaved: "Bild wurde in deiner Bibliothek gespeichert.",
    imageNotSaved: "Das Bild wurde erstellt, konnte aber nicht gespeichert werden.",
    imageFailed: "Bild konnte nicht erstellt werden!",
  },
  en: {
    back: "My stories",
    notFound: "This story could not be loaded.",
    notFoundHint: "It may have been deleted, or the connection dropped for a moment.",
    deleteFailed: "The story could not be deleted.",
    deleted: "Story deleted.",
    imageSaved: "The picture was saved to your library.",
    imageNotSaved: "The picture was created but could not be saved.",
    imageFailed: "The picture could not be created!",
  },
};

export default function StoryDetail() {
  const router = useRouter();
  const { id } = useParams();
  const [language] = useLanguagePreference();
  const t = TEXT[language] || TEXT.de;

  const [story, setStory] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

  useEffect(() => {
    const fetchStory = async () => {
      const token = getToken();
      if (!token) {
        router.push("/");
        return;
      }
      try {
        const response = await fetch(`${API_BASE_URL}/api/stories/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (isAuthError(response.status)) {
          handleExpiredSession();
          return;
        }
        if (!response.ok) throw new Error("Failed to fetch story");
        const data = await response.json();
        setStory(data);
      } catch (err) {
        console.error("Error fetching story:", err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    if (id) fetchStory();
  }, [id, router, API_BASE_URL]);

  const handleBack = () => {
    router.push("/mystories");
  };

  // Resolves to true when the story is gone, so the dialog can close.
  const handleDelete = async () => {
    try {
      await deleteStory(story._id);
      toast.success(t.deleted);
      router.push("/mystories");
      return true;
    } catch (err) {
      console.error("Error deleting story:", err);
      toast.error(t.deleteFailed);
      return false;
    }
  };

  // Draws a picture of the last scene and shows it in place of the old one.
  const handleGenerateImage = async () => {
    if (isGeneratingImage) return;
    setIsGeneratingImage(true);
    try {
      const data = await illustrateSavedStory(story);
      setStory((current) => {
        const content = [...current.content];
        const last = content.length - 1;
        content[last] = { ...content[last], image: data.image, hasImage: true };
        return { ...current, content };
      });
      if (data.saved) {
        toast.success(t.imageSaved);
      } else {
        toast.error(t.imageNotSaved);
      }
    } catch (err) {
      console.error("Error generating image:", err);
      toast.error(err.message || t.imageFailed);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  if (isLoading) {
    return <LoadingSpGeneric />;
  }

  return (
    <div className="h-full overflow-y-auto px-4 pb-16 sm:px-8">
      {isGeneratingImage && <LoadingSpinner />}
      <header className="mx-auto flex max-w-4xl items-center justify-between gap-4 py-5 sm:py-7">
        <button
          type="button"
          onClick={handleBack}
          className="flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-base font-bold shadow-md ring-2 ring-black/10 transition hover:scale-105 hover:bg-white focus:outline-none focus:ring-4 focus:ring-pink-300 night:bg-white/10 night:ring-white/20 night:hover:bg-white/20"
        >
          <span aria-hidden="true">←</span> {t.back}
        </button>
        <ExperienceControls />
      </header>

      {error || !story ? (
        <section className="mx-auto mt-6 flex max-w-md flex-col items-center rounded-[2rem] border-2 border-black/10 bg-[#fffaf1]/95 px-6 py-10 text-center text-[#3d332d] shadow-[0_18px_50px_rgba(61,43,30,0.16)] night:border-white/10 night:bg-[#221d33]/95 night:text-[#efe6ff]">
          <Image
            src="/kids/nostory.png"
            alt=""
            width={160}
            height={160}
            className="mb-6"
          />
          <h1 className="mb-2 text-2xl font-black">{t.notFound}</h1>
          <p className="mb-8 opacity-75">{t.notFoundHint}</p>
          <Button variant="primary" onClick={handleBack}>
            {t.back}
          </Button>
        </section>
      ) : (
        <FinalStoryCard
          story={story}
          onDelete={handleDelete}
          onGenerateImage={handleGenerateImage}
          isGeneratingImage={isGeneratingImage}
        />
      )}
    </div>
  );
}
