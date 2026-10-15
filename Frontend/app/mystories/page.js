"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import toast from "react-hot-toast";
import StoryCard from "../components/StoryCard";
import Button from "../components/Button";
import LoadingSpGeneric from "../components/LoadingSpGeneric";
import ExperienceControls, {
  useLanguagePreference,
} from "../components/ExperienceControls";
import { getToken, getUser, handleExpiredSession, isAuthError } from "../utils/auth";
import { deleteStory } from "../utils/stories";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8082";

const TEXT = {
  de: {
    title: "Meine Geschichten",
    empty: "Du hast noch keine Geschichten erstellt.",
    create: "Geschichte erstellen ✨",
    newStory: "Neue Geschichte ✨",
    back: "Zurück",
    loadFailed: "Deine Geschichten konnten nicht geladen werden.",
    deleted: "Geschichte gelöscht.",
    deleteFailed: "Die Geschichte konnte nicht gelöscht werden.",
  },
  en: {
    title: "My stories",
    empty: "You haven't created any stories yet.",
    create: "Create a story ✨",
    newStory: "New story ✨",
    back: "Back",
    loadFailed: "Your stories could not be loaded.",
    deleted: "Story deleted.",
    deleteFailed: "The story could not be deleted.",
  },
};

function BackArrow() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

export default function MyStories() {
  const router = useRouter();
  const [language] = useLanguagePreference();
  const t = TEXT[language] || TEXT.de;
  const [stories, setStories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const loadStories = async () => {
      const token = getToken();
      const userId = getUser()?.id;

      if (!token) {
        router.push("/");
        return;
      }

      try {
        // The backend returns the newest story first.
        const response = await fetch(`${API_BASE_URL}/api/stories/user/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (isAuthError(response.status)) {
          handleExpiredSession();
          return;
        }
        if (!response.ok) {
          throw new Error(`Loading stories failed with ${response.status}`);
        }

        setStories(await response.json());
      } catch (err) {
        console.error("Error fetching stories:", err);
        setLoadError(true);
      } finally {
        setIsLoading(false);
      }
    };

    loadStories();
  }, [router]);

  useEffect(() => {
    if (loadError) toast.error(t.loadFailed);
  }, [loadError, t.loadFailed]);

  // Resolves to true when the story is gone, so its card can disappear.
  const handleDelete = async (storyId) => {
    try {
      await deleteStory(storyId);
      setStories((current) => current.filter((story) => story._id !== storyId));
      toast.success(t.deleted);
      return true;
    } catch (err) {
      console.error("Error deleting story:", err);
      toast.error(t.deleteFailed);
      return false;
    }
  };

  const handleBackToDashboard = () => {
    router.push("/dashboard");
  };

  if (isLoading) {
    return <LoadingSpGeneric />;
  }

  return (
    <div className="flex max-h-screen min-h-screen flex-col justify-between overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
      <div className="fixed right-0 bottom-0 z-0 block">
        <Image
          src="/misc/cat.png"
          alt=""
          width={140}
          height={400}
          className="md:w-[150px] xl:w-[170px]"
          priority
        />
      </div>

      <div className="relative mb-4 flex flex-col items-center gap-3 text-center sm:block">
        <div className="self-end sm:absolute sm:top-0 sm:right-0">
          <ExperienceControls />
        </div>
        <h1 className="text-3xl font-black sm:pt-4 sm:text-4xl">{t.title}</h1>
      </div>

      {stories.length === 0 ? (
        <div className="mb-16 flex w-full flex-grow flex-col items-center justify-center">
          <div className="text-center">
            <Image
              src="/kids/nostory.png"
              alt=""
              width={200}
              height={200}
              className="mx-auto mb-6 xl:w-sm"
            />
            <p className="mb-8 text-3xl">{loadError ? t.loadFailed : t.empty}</p>
          </div>
          <div className="flex gap-4 font-black">
            <Button
              variant="primary"
              onClick={handleBackToDashboard}
              className="flex items-center justify-center"
              aria-label={t.back}
            >
              <BackArrow />
            </Button>
            <Button variant="secondary" href="/generate" className="min-w-66 font-black">
              {t.create}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="w-full flex-1 overflow-y-auto pt-1 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#4343433c] hover:[&::-webkit-scrollbar-thumb]:bg-[#43434359] [&::-webkit-scrollbar-track]:bg-transparent">
            <div className="mx-auto grid w-full max-w-md grid-cols-1 gap-6 md:max-w-none md:grid-cols-2 lg:grid-cols-3">
              {stories.map((story) => (
                <StoryCard key={story._id} story={story} onDelete={handleDelete} />
              ))}
            </div>
          </div>
          <div className="sticky bottom-0 z-10 flex justify-center gap-4 py-4 font-black">
            <Button
              variant="primary"
              onClick={handleBackToDashboard}
              className="flex items-center justify-center gap-2"
              aria-label={t.back}
            >
              <BackArrow />
              <span className="hidden sm:inline">{t.back}</span>
            </Button>
            <Button variant="secondary" href="/generate" className="whitespace-nowrap">
              {t.newStory}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
