"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Button from "../components/Button";
import LoadingSpinner from "../components/LoadingSpinner";
import { generateStoryImage } from "../api/generate/generate";

export default function StoryResultPage() {
  const router = useRouter();
  const [storyData, setStoryData] = useState(null);
  const [storyImage, setStoryImage] = useState("");
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

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
        <p className="text-xl">Geschichte wird geöffnet ...</p>
      </main>
    );
  }

  const storyTitle =
    storyData.prompt.trim().split(/[.!?]/)[0].slice(0, 90) ||
    "Deine Geschichte";
  const paragraphs = storyData.story
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const lastParagraph = paragraphs[paragraphs.length - 1] || storyData.story;

  const handleGenerateImage = async () => {
    if (isGeneratingImage) return;

    setIsGeneratingImage(true);
    try {
      const data = await generateStoryImage({ paragraph: lastParagraph });
      setStoryImage(data.image);
    } catch (error) {
      window.alert(error.message || "Bild konnte nicht erstellt werden!");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  return (
    <main className="h-full overflow-y-auto px-4 pb-12 sm:px-8">
      {isGeneratingImage && <LoadingSpinner />}
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-4 py-5 sm:py-7">
        <Button
          type="button"
          variant="tertiary"
          className="px-0 text-base shadow-none"
          onClick={() => router.push("/generate")}
        >
          <span aria-hidden="true">←</span> Neue Geschichte
        </Button>
        <span className="text-xs font-black uppercase tracking-[0.2em] opacity-55">
          MellowDreams
        </span>
      </header>

      <section className="mx-auto max-w-5xl pb-8">
        <div className="mb-8 border-b-2 border-black/10 pb-7 sm:mb-10 sm:pb-9">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.24em] text-[#b85c3d]">
            Deine Geschichte
          </p>
          <h1 className="max-w-4xl text-4xl font-black leading-[1.05] sm:text-6xl">
            {storyTitle}
          </h1>
        </div>

        <article className="mx-auto max-w-4xl rounded-[2rem] border-2 border-black/10 bg-[#fffaf1]/95 shadow-[0_18px_50px_rgba(61,43,30,0.16)] backdrop-blur-sm">
          <div className="h-2 bg-[image:var(--peace)]" />
          <div className="px-6 py-8 sm:px-14 sm:py-12 lg:px-20 lg:py-16">
            <div className="mb-8 flex items-center gap-3 text-xs font-black uppercase tracking-[0.2em] text-[#8a6b55]">
              <span className="h-2 w-2 rounded-full bg-[#ed8d58]" />
              Vorlesegeschichte
            </div>

            <div className="max-w-2xl min-w-0 whitespace-pre-wrap break-words text-left text-lg leading-[1.85] text-[#3d332d] sm:text-xl sm:leading-[1.9]">
              {paragraphs.map((paragraph, index) => (
                <p key={index} className="mb-7 last:mb-0">
                  {paragraph}
                </p>
              ))}
            </div>

            <div className="mt-12 border-t border-black/10 pt-8">
              <div className="flex flex-col items-center justify-between gap-5 sm:flex-row">
                <div className="text-center sm:text-left">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[#8a6b55]">
                    Letzte Szene
                  </p>
                  <p className="mt-1 text-sm text-[#6d5b4d]">
                    Mach daraus ein Bild.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleGenerateImage}
                  disabled={isGeneratingImage}
                >
                  {storyImage ? "Bild neu erstellen" : "Bild erstellen"}
                </Button>
              </div>

              {storyImage && (
                <figure className="mt-8 overflow-hidden rounded-3xl border-2 border-black/10 bg-[#f5eadb] shadow-[0_12px_30px_rgba(61,43,30,0.14)]">
                  <Image
                    src={storyImage}
                    alt="Illustration der letzten Szene"
                    width={1024}
                    height={1024}
                    unoptimized
                    className="h-auto w-full object-cover"
                  />
                  <figcaption className="px-5 py-3 text-center text-sm italic text-[#6d5b4d]">
                    Eine Illustration aus dem letzten Abschnitt deiner
                    Geschichte.
                  </figcaption>
                </figure>
              )}
            </div>

            <div className="mt-10 border-t border-black/10 pt-7 text-center">
              <Button type="button" onClick={() => router.push("/generate")}>
                Noch eine Geschichte
              </Button>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
