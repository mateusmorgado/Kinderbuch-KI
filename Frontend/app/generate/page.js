"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Button from "../components/Button";
import ExperienceControls, {
  useLanguagePreference,
} from "../components/ExperienceControls";
import FormScreen from "../components/FormScreen";
import MagicPrompt from "../components/MagicPrompt";
import { isLoggedIn, saveStory, streamStory } from "../utils/stories";

const subscribeToNothing = () => () => {};

const TEXT = {
  de: {
    home: "Startseite",
    title: "Erstellen",
    subtitle: "Beschreibe deine Idee und Gemini schreibt daraus eine ganze Geschichte.",
    label: "Deine Geschichtenidee",
    placeholder: "Zum Beispiel: Ein kleiner Fuchs findet im Wald eine Tür zu den Sternen ...",
    shortcut: "zum Erstellen",
    create: "Geschichte erstellen",
    writing: "Deine Geschichte entsteht ...",
    gathering: "Die Feder sammelt Sternenstaub ...",
    cancel: "Abbrechen",
    emptyPrompt: "Bitte beschreibe deine Geschichte.",
    notSaved: "Die Geschichte konnte nicht gespeichert werden.",
    failed: "Fehler beim Erstellen der Geschichte!",
  },
  en: {
    home: "Home",
    title: "Create",
    subtitle: "Describe your idea and Gemini will turn it into a complete story.",
    label: "Your story idea",
    placeholder: "For example: A little fox finds a door to the stars in the woods ...",
    shortcut: "to create",
    create: "Create story",
    writing: "Your story is being written ...",
    gathering: "The quill is gathering stardust ...",
    cancel: "Cancel",
    emptyPrompt: "Please describe your story.",
    notSaved: "The story could not be saved.",
    failed: "The story could not be created!",
  },
};

const toParagraphs = (text) =>
  text
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

// Shows the story while Gemini writes it, paragraph by paragraph.
function StoryWriting({ t, prompt, text, onCancel }) {
  const endRef = useRef(null);
  const paragraphs = toParagraphs(text);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [paragraphs.length]);

  return (
    <div className="h-full overflow-y-auto px-4 pb-12 sm:px-8">
      <div className="mx-auto max-w-3xl pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div className="mb-6 flex justify-end">
          <ExperienceControls />
        </div>
        <article
          aria-busy="true"
          className="overflow-hidden rounded-[2rem] border-2 border-black/10 bg-[#fffaf1]/95 text-[#3d332d] shadow-[0_18px_50px_rgba(61,43,30,0.16)] backdrop-blur-sm night:border-white/10 night:bg-[#221d33]/95 night:text-[#efe6ff]"
        >
          <div className="magic-frame h-2" />
          <div className="px-6 py-8 sm:px-12 sm:py-10">
            <p className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-[#8a6b55] night:text-[#c9b8e8]">
              <span aria-hidden="true" className="twinkle">✦</span>
              {t.writing}
            </p>
            <p className="mb-8 border-l-4 border-[#f7c898] pl-4 italic text-[#6d5b4d] night:text-[#c9b8e8]">
              {prompt}
            </p>

            <div
              aria-live="polite"
              className="min-h-40 break-words text-lg leading-[1.85] sm:text-xl sm:leading-[1.9]"
            >
              {paragraphs.length === 0 && (
                <p className="opacity-60">
                  {t.gathering}{" "}
                  <span aria-hidden="true" className="quill-cursor">✒️</span>
                </p>
              )}
              {paragraphs.map((paragraph, index) => (
                <p key={index} className="ink-in mb-7 last:mb-0">
                  {paragraph}
                  {index === paragraphs.length - 1 && (
                    <span aria-hidden="true" className="quill-cursor ml-1">
                      ✒️
                    </span>
                  )}
                </p>
              ))}
              <div ref={endRef} />
            </div>
          </div>
          <footer className="flex justify-center border-t border-black/10 px-6 py-4 night:border-white/10">
            <Button type="button" variant="tertiary" className="text-base" onClick={onCancel}>
              {t.cancel}
            </Button>
          </footer>
        </article>
      </div>
    </div>
  );
}

export default function GeneratePage() {
  const router = useRouter();
  const [language] = useLanguagePreference();
  const t = TEXT[language] || TEXT.de;
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [storyText, setStoryText] = useState("");
  const abortRef = useRef(null);
  // The server renders the Ctrl hint; the client switches to ⌘ on Apple devices.
  const isMac = useSyncExternalStore(
    subscribeToNothing,
    () => /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent),
    () => false,
  );

  // Stop writing when the user leaves the page.
  useEffect(() => () => abortRef.current?.abort(), []);

  // Ctrl+Enter (Cmd+Enter on Mac) submits the story idea.
  const handlePromptKeyDown = (event) => {
    if (event.key !== "Enter" || !(event.ctrlKey || event.metaKey)) return;
    if (event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (!isGenerating && prompt.trim()) {
      event.currentTarget.form?.requestSubmit();
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
  };

  const handleGenerate = async (event) => {
    event.preventDefault();
    const idea = prompt.trim();
    if (!idea) {
      toast.error(t.emptyPrompt);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setStoryText("");
    setIsGenerating(true);

    try {
      const story = await streamStory({
        prompt: idea,
        onText: setStoryText,
        signal: controller.signal,
      });

      // Logged-in users get the story saved to their library automatically.
      let storyId = null;
      if (isLoggedIn()) {
        try {
          const saved = await saveStory({ prompt: idea, text: story });
          storyId = saved._id;
        } catch {
          toast.error(t.notSaved);
        }
      }

      sessionStorage.setItem(
        "generatedStory",
        JSON.stringify({ prompt: idea, story, storyId }),
      );
      router.push("/story-result");
    } catch (error) {
      if (error.name !== "AbortError") {
        toast.error(error.message || t.failed);
      }
      setIsGenerating(false);
    } finally {
      abortRef.current = null;
    }
  };

  if (isGenerating) {
    return (
      <StoryWriting t={t} prompt={prompt.trim()} text={storyText} onCancel={handleCancel} />
    );
  }

  return (
    <FormScreen
      onSubmit={handleGenerate}
      header={
        <div className="flex items-center justify-between gap-4">
          <Button
            type="button"
            variant="tertiary"
            className="min-h-11 px-0 text-base shadow-none"
            onClick={() => router.push("/")}
          >
            <span aria-hidden="true">←</span> {t.home}
          </Button>
          <ExperienceControls />
        </div>
      }
      title={t.title}
      subtitle={t.subtitle}
      actions={
        <Button
          type="submit"
          className="w-full max-w-xs py-4 font-black"
          disabled={!prompt.trim()}
        >
          {t.create} ✨
        </Button>
      }
    >
      <label htmlFor="story-prompt" className="sr-only">
        {t.label}
      </label>
      <MagicPrompt
        id="story-prompt"
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        onKeyDown={handlePromptKeyDown}
        language={language}
        placeholder={t.placeholder}
        hintId="story-prompt-shortcut"
        hint={
          <>
            <kbd>{isMac ? "⌘" : "Ctrl"}</kbd> + <kbd>Enter</kbd> {t.shortcut}
          </>
        }
      />
    </FormScreen>
  );
}
