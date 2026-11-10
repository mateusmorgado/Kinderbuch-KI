"use client";
import Image from "next/image";
import Link from "next/link";
import Button from "../components/Button";
import ExperienceControls, {
  useLanguagePreference,
} from "../components/ExperienceControls";
import {
  IllustrationDemo,
  LibraryDemo,
  McpDemo,
  NarrationDemo,
  SettingsDemo,
  StreamingDemo,
  useInView,
} from "./demos";

const REPO_URL = "https://github.com/mateusmorgado/Kinderbuch-KI";

const pick = (text, language) => text[language] ?? text.de;

const TEXT = {
  titleA: { de: "Eine Idee rein.", en: "One idea in." },
  titleB: { de: "Geschichte, Bild und Stimme raus.", en: "A story, a picture and a voice out." },
  intro: {
    de: "Kinderbuch macht aus einem Satz eine illustrierte, vorgelesene Kindergeschichte, mit Gemini, ElevenLabs und einem eigenen MCP-Server für Claude und ChatGPT.",
    en: "Kinderbuch turns one sentence into an illustrated, narrated children's story, using Gemini, ElevenLabs and its own MCP server for Claude and ChatGPT.",
  },
  tryIt: { de: "Jetzt ausprobieren", en: "Try it, no sign-up" },
  source: { de: "Code auf GitHub", en: "Source on GitHub" },
  featuresTitle: { de: "Funktionen", en: "Features" },
  howTitle: { de: "Architektur", en: "Architecture" },
  craftTitle: { de: "Technische Details", en: "Engineering details" },
};

const FEATURES = [
  {
    id: "stream",
    title: { de: "Geschichten, live geschrieben", en: "Stories written live" },
    text: {
      de: "Geminis Antwort wird als NDJSON gestreamt und erscheint Wort für Wort.",
      en: "Gemini's answer is streamed as NDJSON and appears word by word.",
    },
    tags: ["Gemini", "Streaming"],
    Demo: StreamingDemo,
  },
  {
    id: "image",
    title: { de: "Ein Bild zu jeder Geschichte", en: "A picture for every story" },
    text: {
      de: "Die KI malt passend zur Geschichte, auch nachträglich für gespeicherte.",
      en: "The AI paints a matching illustration, also later for saved stories.",
    },
    tags: ["Gemini Image", "MongoDB"],
    Demo: IllustrationDemo,
  },
  {
    id: "narrate",
    title: { de: "Vorgelesen, auch mit deiner Stimme", en: "Read aloud, even in your voice" },
    text: {
      de: "Zwei fertige Stimmen oder ein Klon deiner eigenen aus einer kurzen Aufnahme.",
      en: "Two ready-made voices, or a clone of your own from a short recording.",
    },
    tags: ["ElevenLabs", "Voice cloning"],
    Demo: NarrationDemo,
  },
  {
    id: "mcp",
    title: { de: "Direkt aus Claude & ChatGPT", en: "Straight from Claude & ChatGPT" },
    text: {
      de: "Ein eigener MCP-Server lässt KI-Assistenten Geschichten schreiben und speichern.",
      en: "A custom MCP server lets AI assistants write and save stories for you.",
    },
    tags: ["MCP", "OAuth 2.1"],
    Demo: McpDemo,
  },
  {
    id: "settings",
    title: { de: "Tag & Nacht, Deutsch & Englisch", en: "Day & night, German & English" },
    text: {
      de: "Nachtmodus und zwei Sprachen für die ganze App. Die Knöpfe sind echt.",
      en: "Night mode and two languages across the whole app. These buttons are real.",
    },
    tags: ["i18n", "Tailwind v4"],
    Demo: SettingsDemo,
  },
  {
    id: "library",
    title: { de: "Deine Bibliothek", en: "Your library" },
    text: {
      de: "Mit Konto werden Geschichten gespeichert und jederzeit wieder gelesen.",
      en: "With an account, stories are saved and can be reread any time.",
    },
    tags: ["JWT", "REST API"],
    Demo: LibraryDemo,
  },
];

const ARCH = {
  clients: [
    { icon: "🌐", name: "Next.js 16", note: "React 19 · Vercel" },
    { icon: "🤖", name: "Claude / ChatGPT", note: { de: "über MCP", en: "via MCP" } },
  ],
  api: { icon: "⚙️", name: "Express API", note: "Node · Google Cloud Run" },
  services: [
    { icon: "✨", name: "Gemini", note: { de: "Text & Bilder", en: "Text & images" } },
    { icon: "🗣️", name: "ElevenLabs", note: { de: "Stimmen & Klone", en: "Voices & clones" } },
    { icon: "🍃", name: "MongoDB Atlas", note: { de: "Nutzer, Geschichten, Cache", en: "Users, stories, cache" } },
  ],
};

const CRAFT = [
  { title: { de: "CI bei jedem PR", en: "CI on every PR" }, text: { de: "Jest, Lint und Build über GitHub Actions, über 100 Tests.", en: "Jest, lint and build on GitHub Actions, 100+ tests." } },
  { title: { de: "Kosten im Griff", en: "Costs under control" }, text: { de: "Rate-Limits pro IP und Konto, Vorlesungen und Bilder werden gecacht.", en: "Per-IP and per-account rate limits; narrations and images are cached." } },
  { title: { de: "Sichere Anmeldung", en: "Secure sign-in" }, text: { de: "JWT, bcrypt und OAuth 2.1 mit PKCE; MCP-Tokens haben einen eigenen Schlüssel.", en: "JWT, bcrypt and OAuth 2.1 with PKCE; MCP tokens use their own key." } },
  { title: { de: "Barrierearm & mobil", en: "Accessible & mobile" }, text: { de: "Tastaturbedienung, „reduced motion“ und Safe-Area-Abstände.", en: "Keyboard support, reduced motion and safe-area insets." } },
];

function Reveal({ children, className = "", as: Tag = "div" }) {
  const [ref, inView] = useInView({ threshold: 0.1 });
  return (
    <Tag ref={ref} className={`reveal ${inView ? "is-visible" : ""} ${className}`}>
      {children}
    </Tag>
  );
}

const card =
  "rounded-3xl border-2 border-black/10 bg-[#fffaf1]/90 p-5 shadow-[0_10px_30px_rgba(61,43,30,0.12)] backdrop-blur-sm night:border-white/10 night:bg-[#221d33]/90 night:shadow-none";

const darkButton =
  "flex items-center justify-center gap-2 rounded-[1.7rem] bg-[#2c2c2c] px-4 py-2 text-xl text-white shadow-[0_4px_0_0_rgba(0,0,0,1)] ring-2 ring-black transition hover:scale-105 active:scale-95 night:bg-white night:text-[#221d33]";

function SectionTitle({ id, children }) {
  return (
    <h2 id={id} className="mb-6 text-center text-2xl font-black sm:text-3xl">
      {children}
    </h2>
  );
}

function ArchNode({ node, language, highlight = false }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3 ${
        highlight
          ? "border-transparent bg-[image:var(--peace)] text-[#2c2c2c]"
          : "border-black/10 bg-white/80 night:border-white/10 night:bg-white/5"
      }`}
    >
      <span aria-hidden="true" className="text-2xl">{node.icon}</span>
      <div className="text-left">
        <div className="font-black leading-tight">{node.name}</div>
        <div className="text-xs opacity-75">
          {typeof node.note === "string" ? node.note : pick(node.note, language)}
        </div>
      </div>
    </div>
  );
}

function Flow() {
  // An animated connector; horizontal on wide screens, vertical on phones.
  return (
    <div aria-hidden="true" className="flex items-center justify-center py-2 md:px-2 md:py-0">
      <span className="flow-line flow-line-v md:hidden" />
      <span className="flow-line flow-line-h hidden md:block" />
    </div>
  );
}

export default function FeaturesPage() {
  const [language] = useLanguagePreference();
  const t = (key) => pick(TEXT[key], language);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-20 flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <Link
          href="/"
          aria-label={language === "en" ? "Back to Kinderbuch" : "Zurück zu Kinderbuch"}
          className="flex h-11 items-center gap-2 rounded-full border-2 border-black/20 bg-white/80 pl-2 pr-4 text-sm font-black shadow-md transition hover:scale-105 night:border-white/50 night:bg-[#1a1528] night:text-white"
        >
          <Image src="/K.svg" alt="" width={28} height={28} className="h-7 w-7" />
          ← Kinderbuch
        </Link>
        <ExperienceControls />
      </header>

      <div className="h-full overflow-y-auto overflow-x-hidden">
        <div className="mx-auto max-w-5xl px-4 pb-[max(3rem,env(safe-area-inset-bottom))] pt-28 sm:px-6">
          <section className="text-center">
            <h1 className="mx-auto max-w-4xl text-balance text-4xl font-black leading-[1.08] sm:text-5xl">
              {t("titleA")} <span className="gradient-text">{t("titleB")}</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed opacity-85">
              {t("intro")}
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 font-black sm:flex-row">
              <Button variant="glow" href="/generate" className="w-64">
                {t("tryIt")}
              </Button>
              <a href={REPO_URL} target="_blank" rel="noreferrer" className={`${darkButton} w-64`}>
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="currentColor">
                  <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
                </svg>
                {t("source")}
              </a>
            </div>
          </section>

          <section className="mt-20" aria-labelledby="features-heading">
            <SectionTitle id="features-heading">{t("featuresTitle")}</SectionTitle>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <Reveal key={feature.id} as="article" className={`${card} flex flex-col gap-4`}>
                  <div>
                    <h3 className="text-lg font-black leading-tight">
                      {pick(feature.title, language)}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed opacity-80">
                      {pick(feature.text, language)}
                    </p>
                  </div>
                  <div className="flex flex-1 flex-col justify-center">
                    <feature.Demo />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {feature.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-black/5 px-2.5 py-1 text-xs font-bold opacity-80 night:bg-white/10"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </Reveal>
              ))}
            </div>
          </section>

          <section className="mt-20" aria-labelledby="how-heading">
            <SectionTitle id="how-heading">{t("howTitle")}</SectionTitle>
            <Reveal className={`${card} sm:p-6`}>
              <div className="grid grid-cols-1 items-center md:grid-cols-[1fr_auto_1fr_auto_1fr]">
                <div className="flex flex-col gap-3">
                  {ARCH.clients.map((node) => (
                    <ArchNode key={node.name} node={node} language={language} />
                  ))}
                </div>
                <Flow />
                <ArchNode node={ARCH.api} language={language} highlight />
                <Flow />
                <div className="flex flex-col gap-3">
                  {ARCH.services.map((node) => (
                    <ArchNode key={node.name} node={node} language={language} />
                  ))}
                </div>
              </div>
            </Reveal>
          </section>

          <section className="mt-20" aria-labelledby="craft-heading">
            <SectionTitle id="craft-heading">{t("craftTitle")}</SectionTitle>
            <Reveal as="dl" className={`${card} grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 sm:p-6`}>
              {CRAFT.map((item) => (
                <div key={item.title.en}>
                  <dt className="font-black">{pick(item.title, language)}</dt>
                  <dd className="mt-0.5 text-sm leading-relaxed opacity-80">
                    {pick(item.text, language)}
                  </dd>
                </div>
              ))}
            </Reveal>
          </section>

          <div className="mt-16 flex justify-center font-black">
            <Button variant="glow" href="/generate" className="w-64">
              {t("tryIt")}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
