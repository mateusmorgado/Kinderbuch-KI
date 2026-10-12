"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Button from "../components/Button";
import ExperienceControls, {
  useLanguagePreference,
} from "../components/ExperienceControls";
import FormScreen from "../components/FormScreen";
import LoadingSpinner from "../components/LoadingSpinner";
import {
  generateStory,
  isLoggedIn,
  saveStory,
} from "../api/generate/generate";

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

      // Logged-in users get the story saved to their library automatically.
      let storyId = null;
      if (isLoggedIn()) {
        try {
          const saved = await saveStory({
            prompt: prompt.trim(),
            text: data.response,
          });
          storyId = saved._id;
        } catch {
          toast.error(
            isGerman
              ? "Die Geschichte konnte nicht gespeichert werden."
              : "The story could not be saved.",
          );
        }
      }

      sessionStorage.setItem(
        "generatedStory",
        JSON.stringify({
          prompt: prompt.trim(),
          story: data.response,
          storyId,
        }),
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
    <>
      {isGenerating && <LoadingSpinner />}
      <FormScreen
        onSubmit={handleGenerate}
        header={
          <div className="flex items-center justify-between gap-4">
            <Button
              type="button"
              variant="tertiary"
              className="min-h-11 px-0 text-base text-white shadow-none [text-shadow:0_1px_4px_rgba(0,0,0,0.5)]"
              onClick={() => router.push("/")}
            >
              <span aria-hidden="true">←</span> {isGerman ? "Startseite" : "Home"}
            </Button>
            <ExperienceControls />
          </div>
        }
        title={isGerman ? "Erstellen" : "Create"}
        subtitle={
          isGerman
            ? "Beschreibe deine Idee und Gemini schreibt daraus eine ganze Geschichte."
            : "Describe your idea and Gemini will turn it into a complete story."
        }
        actions={
          <Button
            type="submit"
            className="w-full max-w-xs py-4 font-black"
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
        }
      >
        <label htmlFor="story-prompt" className="sr-only">
          {isGerman ? "Deine Geschichtenidee" : "Your story idea"}
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
          rows={7}
          disabled={isGenerating}
          className="block min-h-48 w-full resize-none rounded-[1.7rem] border-2 border-black bg-white p-5 text-left text-lg text-gray-900 shadow-[0_4px_0_0_rgba(0,0,0,1)] outline-none placeholder:text-gray-500 focus:ring-4 focus:ring-orange-300 disabled:opacity-60"
        />
      </FormScreen>
    </>
  );
}
