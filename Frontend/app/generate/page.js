"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Button from "../components/Button";
import LoadingSpinner from "../components/LoadingSpinner";
import { generateStory } from "../api/generate/generate";

export default function GeneratePage() {
  const router = useRouter();
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
    <main className="min-h-screen px-4 pb-12 text-center">
      {isGenerating && <LoadingSpinner />}
      <section className="mx-auto max-w-3xl pt-12">
        <h1 className="mb-4 text-5xl font-black">Erstellen</h1>
        <p className="mx-auto mb-8 max-w-xl text-xl">
          Beschreibe deine Idee und Gemini schreibt daraus eine ganze
          Geschichte.
        </p>

        <form onSubmit={handleGenerate} className="mx-auto max-w-2xl">
          <label htmlFor="story-prompt" className="sr-only">
            Deine Geschichtenidee
          </label>
          <textarea
            id="story-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Zum Beispiel: Ein kleiner Fuchs findet im Wald eine Tür zu den Sternen ..."
            rows={5}
            disabled={isGenerating}
            className="w-full rounded-2xl border-2 border-black bg-white/90 p-4 text-left text-lg shadow-[0_4px_0_0_rgba(0,0,0,1)] outline-none focus:ring-4 focus:ring-orange-300 disabled:opacity-60"
          />
          <Button
            type="submit"
            className="mt-6"
            disabled={isGenerating || !prompt.trim()}
          >
            {isGenerating
              ? "Geschichte wird geschrieben ..."
              : "Geschichte erstellen"}
          </Button>
        </form>
      </section>
    </main>
  );
}
