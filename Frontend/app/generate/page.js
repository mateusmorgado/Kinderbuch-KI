"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Button from "../components/Button";
import ExperienceControls, {
  useLanguagePreference,
} from "../components/ExperienceControls";
import LoadingSpinner from "../components/LoadingSpinner";
import { generateStory } from "../api/generate/generate";

export default function GeneratePage() {
  const router = useRouter();
  const [language] = useLanguagePreference();
  const isGerman = language === "de";
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async (event) => {
    event.preventDefault();
    if (!prompt.trim()) {
      toast.error("Bitte beschreibe deine Geschichte.");
      return;
    }

    setIsGenerating(true);
    try {
      const data = await generateStory({ prompt });
      sessionStorage.setItem(
        "generatedStory",
        JSON.stringify({ prompt: prompt.trim(), story: data.response }),
      );
      toast.success("Geschichte erfolgreich erstellt!");
      router.push("/story-result");
    } catch (error) {
      toast.error(error.message || "Fehler beim Erstellen der Geschichte!");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <main className="min-h-screen overflow-y-auto px-4 pb-[max(6rem,env(safe-area-inset-bottom))] text-center">
      {isGenerating && <LoadingSpinner />}
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 pt-5 sm:pt-7">
        <Button
          type="button"
          variant="tertiary"
          className="px-0 text-base shadow-none"
          onClick={() => router.push("/")}
        >
          <span aria-hidden="true">←</span> {isGerman ? "Startseite" : "Home"}
        </Button>
        <ExperienceControls />
      </div>
      <section className="mx-auto flex max-w-3xl flex-col items-center pt-10 sm:pt-16">
        <h1 className="mb-4 text-5xl font-black">
          {isGerman ? "Erstellen" : "Create"}
        </h1>
        <p className="mx-auto mb-8 max-w-xl text-xl">
          {isGerman
            ? "Beschreibe deine Idee und Gemini schreibt daraus eine ganze Geschichte."
            : "Describe your idea and Gemini will turn it into a complete story."}
        </p>

        <form onSubmit={handleGenerate} className="mx-auto max-w-2xl">
          <label htmlFor="story-prompt" className="sr-only">
            Deine Geschichtenidee
          </label>
          <textarea
            id="story-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={
              isGerman
                ? "Zum Beispiel: Ein kleiner Fuchs findet im Wald eine Tür zu den Sternen ..."
                : "For example: A little fox finds a door to the stars in the woods ..."
            }
            rows={5}
            disabled={isGenerating}
            className="w-full rounded-2xl border-2 border-black bg-white/90 p-4 text-left text-lg shadow-[0_4px_0_0_rgba(0,0,0,1)] outline-none focus:ring-4 focus:ring-orange-300 disabled:opacity-60"
          />
          <Button
            type="submit"
            className="mt-8 min-h-14 px-8 mb-8"
            disabled={isGenerating || !prompt.trim()}
          >
            {isGenerating
              ? isGerman
                ? "Geschichte wird geschrieben ..."
                : "Writing your story ..."
              : isGerman
                ? "Geschichte erstellen"
                : "Create story"}
          </Button>
        </form>
      </section>
    </main>
  );
}
