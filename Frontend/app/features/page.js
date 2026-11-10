"use client";
import Image from "next/image";
import Link from "next/link";
import Button from "../components/Button";
import ExperienceControls, {
  useLanguagePreference,
} from "../components/ExperienceControls";
import {
  CountUp,
  IllustrationDemo,
  LibraryDemo,
  McpDemo,
  NarrationDemo,
  SettingsDemo,
  StreamingDemo,
  VoiceCloneDemo,
  useInView,
} from "./demos";

const REPO_URL = "https://github.com/mateusmorgado/Kinderbuch-KI";

const pick = (text, language) => text[language] ?? text.de;

const TEXT = {
  back: { de: "Kinderbuch", en: "Kinderbuch" },
  eyebrow: { de: "Full-Stack-KI · Portfolio-Projekt", en: "Full-stack AI · Portfolio project" },
  titleA: { de: "Eine Idee rein.", en: "One idea in." },
  titleB: { de: "Geschichte, Bild und Stimme raus.", en: "A story, a picture and a voice out." },
  intro: {
    de: "Kinderbuch macht aus einem Satz eine illustrierte, vorgelesene Kindergeschichte: live gestreamt von Gemini, gesprochen von ElevenLabs, sogar mit deiner eigenen Stimme, und direkt aus Claude oder ChatGPT nutzbar über einen eigenen MCP-Server.",
    en: "Kinderbuch turns one sentence into an illustrated, narrated children's story: streamed live from Gemini, voiced by ElevenLabs (even in your own voice), and usable straight from Claude or ChatGPT through its own MCP server.",
  },
  tryIt: { de: "Ohne Anmeldung testen", en: "Try it, no sign-up" },
  source: { de: "Code auf GitHub", en: "Source on GitHub" },
  stats: [
    { value: 3, label: { de: "KI-Dienste verbunden", en: "AI services wired up" } },
    { value: 5, label: { de: "MCP-Tools für Claude & ChatGPT", en: "MCP tools for Claude & ChatGPT" } },
    { value: 100, suffix: "+", label: { de: "automatisierte Tests", en: "automated tests" } },
    { value: 2, label: { de: "Sprachen, Tag & Nacht", en: "languages, day & night" } },
  ],
  featuresTitle: { de: "Probier die Funktionen hier aus", en: "Play with the features right here" },
  featuresIntro: {
    de: "Jede Karte ist eine kleine Live-Demo. Darunter steht, wie es technisch funktioniert.",
    en: "Every card is a small live demo, with a note on how it works under the hood.",
  },
  howTitle: { de: "So hängt alles zusammen", en: "How it fits together" },
  howIntro: {
    de: "Ein Next.js-Frontend und eine Express-API, die Gemini, ElevenLabs und MongoDB orchestriert. Claude und ChatGPT sprechen über MCP mit derselben API.",
    en: "A Next.js frontend and an Express API that orchestrates Gemini, ElevenLabs and MongoDB. Claude and ChatGPT talk to the same API over MCP.",
  },
  craftTitle: { de: "Worauf ich beim Bauen geachtet habe", en: "Engineering details I cared about" },
  ctaTitle: { de: "Genug gelesen?", en: "Seen enough?" },
  ctaText: {
    de: "Schreib in 20 Sekunden deine erste Geschichte, ganz ohne Konto.",
    en: "Write your first story in 20 seconds, no account needed.",
  },
  how: { de: "So funktioniert's", en: "Under the hood" },
};

const FEATURES = [
  {
    id: "stream",
    span: "md:col-span-2",
    icon: "✍️",
    title: { de: "Geschichten, live geschrieben", en: "Stories written live" },
    text: {
      de: "Die Geschichte erscheint Wort für Wort, während Gemini sie schreibt, statt nach zehn Sekunden Ladebalken.",
      en: "The story appears word by word while Gemini writes it, instead of after ten seconds of spinner.",
    },
    how: {
      de: "Die API liest Geminis Server-Sent Events und reicht sie als NDJSON an einen ReadableStream im Browser weiter.",
      en: "The API reads Gemini's server-sent events and relays them as NDJSON to a ReadableStream in the browser.",
    },
    tags: ["Gemini", "SSE → NDJSON", "ReadableStream"],
    Demo: StreamingDemo,
  },
  {
    id: "image",
    icon: "🎨",
    title: { de: "Ein Bild zu jeder Geschichte", en: "A picture for every story" },
    text: {
      de: "Die KI malt passend zur Geschichte. Gespeicherte Geschichten bekommen jederzeit ein neues Bild.",
      en: "The AI paints a matching illustration, and saved stories can get a new one any time.",
    },
    how: {
      de: "Gemini-Bildmodell, Bilder in MongoDB gespeichert und über eine eigene Route ausgeliefert.",
      en: "Gemini image model; images stored in MongoDB and served from their own route.",
    },
    tags: ["Gemini Image", "MongoDB"],
    Demo: IllustrationDemo,
  },
  {
    id: "narrate",
    icon: "🔊",
    title: { de: "Vorgelesen in drei Stimmen", en: "Read aloud in three voices" },
    text: {
      de: "Eine weibliche, eine männliche oder deine eigene Stimme liest die Geschichte vor.",
      en: "A female, a male or your own voice reads the story aloud.",
    },
    how: {
      de: "ElevenLabs-Sprachsynthese; jede Aufnahme wird gecacht, damit niemand zweimal dafür bezahlt.",
      en: "ElevenLabs text-to-speech; every recording is cached so nobody pays for it twice.",
    },
    tags: ["ElevenLabs TTS", "Caching"],
    Demo: NarrationDemo,
  },
  {
    id: "clone",
    icon: "🎙️",
    title: { de: "Mit deiner eigenen Stimme", en: "In your own voice" },
    text: {
      de: "Eine kurze Sprachprobe reicht, und Mama oder Papa lesen jede Geschichte vor. Gäste dürfen es einmal testen, danach wird die Stimme sofort gelöscht.",
      en: "A short voice sample is enough for Mum or Dad to read every story. Guests can try it once, and the voice is deleted right afterwards.",
    },
    how: {
      de: "Aufnahme im Browser mit MediaRecorder, Klon bei ElevenLabs, versionierte Einwilligung und automatisches Löschen.",
      en: "Recorded in the browser with MediaRecorder, cloned at ElevenLabs, with versioned consent and automatic deletion.",
    },
    tags: ["MediaRecorder", "Voice cloning", "Consent"],
    Demo: VoiceCloneDemo,
  },
  {
    id: "mcp",
    icon: "🤖",
    title: { de: "Direkt aus Claude & ChatGPT", en: "Straight from Claude & ChatGPT" },
    text: {
      de: "Verbinde deinen KI-Assistenten, und er schreibt, illustriert und speichert Geschichten in deiner Bibliothek.",
      en: "Connect your AI assistant and it writes, illustrates and saves stories into your library.",
    },
    how: {
      de: "Eigener MCP-Server mit fünf Tools und OAuth 2.1 mit PKCE, damit jeder Aufruf für das richtige Konto läuft.",
      en: "A custom MCP server with five tools and OAuth 2.1 with PKCE, so every call runs as the right user.",
    },
    tags: ["MCP", "OAuth 2.1 + PKCE", "Zod"],
    Demo: McpDemo,
  },
  {
    id: "settings",
    icon: "🌙",
    title: { de: "Tag & Nacht, Deutsch & Englisch", en: "Day & night, German & English" },
    text: {
      de: "Ein sanfter Nachtmodus für die Gutenachtgeschichte und die ganze App in zwei Sprachen. Probier es aus, die Knöpfe sind echt.",
      en: "A gentle night mode for bedtime and the whole app in two languages. Go on, these buttons are real.",
    },
    how: {
      de: "Ein React-Context speichert die Wahl, ein eigener Tailwind-Variant „night:“ stylt alles um.",
      en: "A React context stores the choice, and a custom Tailwind “night:” variant restyles everything.",
    },
    tags: ["i18n", "Tailwind v4", "React Context"],
    Demo: SettingsDemo,
  },
  {
    id: "library",
    icon: "📚",
    title: { de: "Deine Bibliothek", en: "Your library" },
    text: {
      de: "Mit Konto werden Geschichten gespeichert, wiedergelesen und durchgeblättert.",
      en: "With an account, stories are saved, reread and paged through.",
    },
    how: {
      de: "REST-API mit JWT-Login, bcrypt-Passwörtern und Rate-Limits gegen Missbrauch.",
      en: "REST API with JWT login, bcrypt passwords and rate limits against abuse.",
    },
    tags: ["JWT", "bcrypt", "Rate limits"],
    Demo: LibraryDemo,
  },
];

const ARCH = {
  clients: [
    { icon: "🌐", name: "Next.js 16", note: { de: "React 19 · Vercel", en: "React 19 · Vercel" } },
    { icon: "🤖", name: "Claude / ChatGPT", note: { de: "über MCP", en: "via MCP" } },
  ],
  api: { icon: "⚙️", name: "Express API", note: { de: "Node · Google Cloud Run", en: "Node · Google Cloud Run" } },
  services: [
    { icon: "✨", name: "Gemini", note: { de: "Text & Bilder", en: "Text & images" } },
    { icon: "🗣️", name: "ElevenLabs", note: { de: "Stimmen & Klone", en: "Voices & clones" } },
    { icon: "🍃", name: "MongoDB Atlas", note: { de: "Nutzer, Geschichten, Cache", en: "Users, stories, cache" } },
  ],
};

const CRAFT = [
  { icon: "🧪", title: { de: "CI bei jedem PR", en: "CI on every PR" }, text: { de: "GitHub Actions führt Jest-Tests, Lint und Build aus, Backend gegen eine In-Memory-MongoDB.", en: "GitHub Actions runs Jest, lint and build; the backend tests against an in-memory MongoDB." } },
  { icon: "🛡️", title: { de: "Kosten im Griff", en: "Costs under control" }, text: { de: "Rate-Limits pro IP und pro Konto, damit KI-Aufrufe kein Loch in die Kasse reißen.", en: "Per-IP and per-account rate limits so AI calls can't run up the bill." } },
  { icon: "♿", title: { de: "Barrierearm", en: "Accessible" }, text: { de: "Tastaturbedienung, Fokus-Ringe und weniger Animation bei „reduced motion“.", en: "Keyboard support, focus rings and calmer animation for reduced-motion users." } },
  { icon: "📱", title: { de: "Mobile first", en: "Mobile first" }, text: { de: "Safe-Area-Abstände für Notch und Gestenleiste, getestet auf kleinen Displays.", en: "Safe-area insets for notches and gesture bars, checked on small screens." } },
  { icon: "🔐", title: { de: "Getrennte Tokens", en: "Separate tokens" }, text: { de: "MCP-Tokens nutzen einen eigenen abgeleiteten Schlüssel und gelten nie für die Website-API.", en: "MCP tokens use their own derived key and are never accepted by the website API." } },
  { icon: "💸", title: { de: "Caching", en: "Caching" }, text: { de: "Vorlesungen und Bilder werden einmal erzeugt und dann aus der Datenbank geliefert.", en: "Narrations and images are generated once, then served from the database." } },
];

function Reveal({ children, className = "", delay = 0, as: Tag = "div" }) {
  const [ref, inView] = useInView({ threshold: 0.15 });
  return (
    <Tag
      ref={ref}
      className={`reveal ${inView ? "is-visible" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}

const card =
  "rounded-[2rem] bg-[#fffaf1]/90 p-5 ring-2 ring-black shadow-[0_6px_0_0_rgba(0,0,0,1)] backdrop-blur-sm night:bg-[#221d33]/90 night:ring-white/25 night:shadow-[0_6px_0_0_rgba(0,0,0,0.6)]";

function Tag({ children }) {
  return (
    <span className="rounded-full bg-black/5 px-2.5 py-1 font-mono text-[0.7rem] font-bold night:bg-white/10">
      {children}
    </span>
  );
}

function ArchNode({ node, language, highlight = false }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl px-4 py-3 ring-2 ring-black shadow-[0_4px_0_0_rgba(0,0,0,1)] night:ring-white/25 ${
        highlight ? "bg-[image:var(--adventure)] text-[#2c2c2c]" : "bg-white night:bg-[#2f2748]"
      }`}
    >
      <span aria-hidden="true" className="text-2xl">{node.icon}</span>
      <div className="text-left">
        <div className="font-black leading-tight">{node.name}</div>
        <div className="text-xs opacity-75">{pick(node.note, language)}</div>
      </div>
    </div>
  );
}

function Flow() {
  // An animated connector; horizontal on wide screens, vertical on phones.
  return (
    <div aria-hidden="true" className="flex items-center justify-center py-1 md:px-1 md:py-0">
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
          className="flex items-center gap-2 rounded-full bg-white/80 py-1.5 pl-2 pr-4 text-sm font-black shadow-md ring-2 ring-black/20 backdrop-blur transition hover:scale-105 night:bg-[#1a1528]/80 night:ring-white/40"
        >
          <Image src="/K.svg" alt="" width={28} height={28} className="h-7 w-7" />
          ← {t("back")}
        </Link>
        <ExperienceControls />
      </header>

      <div className="h-full overflow-y-auto overflow-x-hidden">
        <div className="mx-auto max-w-6xl px-4 pb-[max(3rem,env(safe-area-inset-bottom))] pt-24 sm:px-6">
          {/* Hero */}
          <section className="relative text-center">
            <span aria-hidden="true" className="twinkle absolute left-[6%] top-6 text-2xl">✨</span>
            <span aria-hidden="true" className="twinkle absolute right-[8%] top-28 text-xl [animation-delay:1s]">⭐</span>
            <Reveal>
              <span className="inline-block rounded-full bg-white/80 px-4 py-1.5 text-xs font-black uppercase tracking-widest ring-2 ring-black/15 night:bg-white/10 night:ring-white/20">
                {t("eyebrow")}
              </span>
            </Reveal>
            <Reveal delay={100}>
              <h1 className="mx-auto mt-6 max-w-5xl text-balance text-4xl font-black leading-[1.05] sm:text-6xl">
                {t("titleA")}
                <br />
                <span className="shimmer-text">{t("titleB")}</span>
              </h1>
            </Reveal>
            <Reveal delay={200}>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed opacity-85">
                {t("intro")}
              </p>
            </Reveal>
            <Reveal delay={300} className="mt-8 flex flex-col items-center justify-center gap-4 font-black sm:flex-row">
              <Button variant="glow" href="/generate" className="w-64">
                {t("tryIt")} →
              </Button>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noreferrer"
                className="flex w-64 items-center justify-center gap-2 rounded-[1.7rem] bg-[#2c2c2c] px-4 py-2 text-xl text-white shadow-[0_4px_0_0_rgba(0,0,0,1)] ring-2 ring-black transition hover:scale-105 active:scale-95 night:bg-white night:text-[#221d33]"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="currentColor">
                  <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
                </svg>
                {t("source")}
              </a>
            </Reveal>

            <Reveal delay={400} as="dl" className="mx-auto mt-12 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-4">
              {TEXT.stats.map((stat) => (
                <div key={stat.label.en} className={`${card} !p-4`}>
                  <dt className="sr-only">{pick(stat.label, language)}</dt>
                  <dd className="text-4xl font-black">
                    <CountUp value={stat.value} suffix={stat.suffix} />
                  </dd>
                  <dd aria-hidden="true" className="mt-1 text-xs font-bold leading-snug opacity-75">
                    {pick(stat.label, language)}
                  </dd>
                </div>
              ))}
            </Reveal>
          </section>

          {/* Feature bento */}
          <section className="mt-24" aria-labelledby="features-heading">
            <Reveal className="mb-8 text-center">
              <h2 id="features-heading" className="text-3xl font-black sm:text-4xl">
                {t("featuresTitle")}
              </h2>
              <p className="mx-auto mt-2 max-w-xl opacity-80">{t("featuresIntro")}</p>
            </Reveal>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              {FEATURES.map((feature, index) => (
                <Reveal
                  key={feature.id}
                  delay={(index % 3) * 90}
                  as="article"
                  className={`${card} flex flex-col gap-4 transition-transform duration-300 hover:-translate-y-1 ${feature.span || ""}`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[image:var(--calm)] text-2xl ring-2 ring-black"
                    >
                      {feature.icon}
                    </span>
                    <div>
                      <h3 className="text-xl font-black leading-tight">
                        {pick(feature.title, language)}
                      </h3>
                      <p className="mt-1 text-sm leading-relaxed opacity-80">
                        {pick(feature.text, language)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col justify-center">
                    <feature.Demo />
                  </div>
                  <div className="border-t-2 border-dashed border-black/10 pt-3 night:border-white/15">
                    <p className="text-xs leading-relaxed">
                      <span className="font-black uppercase tracking-widest opacity-60">
                        {t("how")}:{" "}
                      </span>
                      <span className="opacity-85">{pick(feature.how, language)}</span>
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {feature.tags.map((tag) => (
                        <Tag key={tag}>{tag}</Tag>
                      ))}
                    </div>
                  </div>
                </Reveal>
              ))}

              <Reveal
                delay={180}
                as="article"
                className="flex flex-col justify-between gap-4 rounded-[2rem] bg-gradient-to-br from-pink-400 via-fuchsia-500 to-orange-300 p-5 text-white ring-2 ring-black shadow-[0_6px_0_0_rgba(0,0,0,1)] transition-transform duration-300 hover:-translate-y-1"
              >
                <div>
                  <span aria-hidden="true" className="text-4xl">🧪</span>
                  <h3 className="mt-2 text-2xl font-black leading-tight">
                    {language === "en" ? "No account? No problem." : "Kein Konto? Kein Problem."}
                  </h3>
                  <p className="mt-1 leading-relaxed text-white/90">
                    {language === "en"
                      ? "“Start experiment” lets anyone write a story, see its picture and hear it read aloud, guarded by per-IP limits."
                      : "Mit „Experiment starten“ schreibt jeder eine Geschichte, sieht ihr Bild und hört sie vorgelesen, geschützt durch Limits pro IP."}
                  </p>
                </div>
                <Link
                  href="/generate"
                  className="self-start rounded-full bg-white px-5 py-2.5 font-black text-[#2c2c2c] shadow-[0_4px_0_0_rgba(0,0,0,1)] ring-2 ring-black transition hover:scale-105 active:scale-95"
                >
                  {language === "en" ? "Start experiment →" : "Experiment starten →"}
                </Link>
              </Reveal>
            </div>
          </section>

          {/* Architecture */}
          <section className="mt-24" aria-labelledby="how-heading">
            <Reveal className="mb-8 text-center">
              <h2 id="how-heading" className="text-3xl font-black sm:text-4xl">
                {t("howTitle")}
              </h2>
              <p className="mx-auto mt-2 max-w-2xl opacity-80">{t("howIntro")}</p>
            </Reveal>
            <Reveal className={`${card} !p-6`}>
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

          {/* Engineering details */}
          <section className="mt-24" aria-labelledby="craft-heading">
            <Reveal className="mb-8 text-center">
              <h2 id="craft-heading" className="text-3xl font-black sm:text-4xl">
                {t("craftTitle")}
              </h2>
            </Reveal>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {CRAFT.map((item, index) => (
                <Reveal key={item.icon} delay={(index % 3) * 80} className={`${card} flex gap-3`}>
                  <span aria-hidden="true" className="text-3xl">{item.icon}</span>
                  <div>
                    <h3 className="font-black">{pick(item.title, language)}</h3>
                    <p className="mt-1 text-sm leading-relaxed opacity-80">{pick(item.text, language)}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>

          {/* Final call to action */}
          <Reveal as="section" className="relative mt-24 overflow-hidden rounded-[2rem] bg-[#2c2c2c] px-6 py-12 text-center text-white ring-2 ring-black shadow-[0_6px_0_0_rgba(0,0,0,1)] night:bg-[#120f1d] night:ring-white/25">
            <Image
              src="/misc/dragon.webp"
              alt=""
              width={140}
              height={122}
              className="dragon-float pointer-events-none absolute -right-4 -top-2 w-24 opacity-90 sm:right-6 sm:top-4 sm:w-36"
            />
            <h2 className="text-3xl font-black sm:text-4xl">{t("ctaTitle")}</h2>
            <p className="mx-auto mt-2 max-w-md text-white/80">{t("ctaText")}</p>
            <div className="mt-6 flex justify-center font-black">
              <Button variant="glow" href="/generate" className="w-64">
                {t("tryIt")} →
              </Button>
            </div>
          </Reveal>
        </div>
      </div>
    </>
  );
}
