"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Button from "../components/Button";
import ConfirmDeleteDialog from "../components/ConfirmDeleteDialog";
import LoadingSpGeneric from "../components/LoadingSpGeneric";
import ExperienceControls, {
  useLanguagePreference,
} from "../components/ExperienceControls";
import { getToken } from "../utils/auth";
import { cloneVoice, deleteVoice, getVoice, tryVoice } from "../utils/voice";

// ElevenLabs needs at least about half a minute; one to two minutes of calm
// reading gives a much closer voice.
const MIN_SECONDS = 30;
const MAX_SECONDS = 180;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
// The guest trial reads at most this much of the story (see the backend).
const TRIAL_MAX_CHARS = 3000;

const TEXT = {
  de: {
    back: "Zurück",
    title: "Meine Vorlesestimme",
    intro:
      "Nimm deine Stimme einmal auf, und deine Geschichten werden danach in deiner Stimme vorgelesen, auch wenn du gerade nicht da bist.",
    current: "Deine Stimme",
    since: (date) => `Aufgenommen am ${date}`,
    rerecord: "Neu aufnehmen",
    delete: "Stimme löschen",
    deleteTitle: "Stimme löschen?",
    deleteBody:
      "Die geklonte Stimme und alle damit vorgelesenen Geschichten werden bei uns und bei ElevenLabs gelöscht.",
    deleted: "Deine Stimme wurde gelöscht.",
    step1: "1. Lies diesen Text laut vor",
    tips: "Ruhiger Raum, normaler Abstand zum Mikrofon, mindestens 30 Sekunden, am besten 1 bis 2 Minuten.",
    sample:
      "Es war einmal ein kleiner Igel, der jeden Abend den Sternen gute Nacht sagte. Er kletterte auf seinen Lieblingsstein am Waldrand, schaute in den Himmel und zählte: eins, zwei, drei, ganz viele! Eines Nachts fehlte ein Stern. „Wo bist du denn?“, flüsterte der Igel. Da hörte er ein leises Kichern hinter dem Mond. Der kleine Stern hatte sich versteckt, weil er schüchtern war. „Du musst keine Angst haben“, sagte der Igel freundlich. „Ohne dich ist der Himmel nicht ganz.“ Langsam kam der Stern hervor und leuchtete so hell wie nie zuvor. Seitdem winken sie sich jeden Abend zu, bevor sie einschlafen. Und wenn du ganz genau hinsiehst, kannst du heute Nacht vielleicht auch einen schüchternen Stern entdecken.",
    step2: "2. Aufnehmen",
    start: "Aufnahme starten",
    stop: "Aufnahme beenden",
    again: "Nochmal aufnehmen",
    recording: "Aufnahme läuft",
    tooShort: (s) => `Noch ${s} Sekunden, damit die Stimme gut klingt.`,
    upload: "… oder eine Audiodatei hochladen",
    uploadTooBig: "Die Datei ist größer als 10 MB.",
    noMic: "Das Mikrofon ist nicht verfügbar. Du kannst stattdessen eine Datei hochladen.",
    step3: "3. Name und Einverständnis",
    nameLabel: "Wie soll die Stimme heißen?",
    namePlaceholder: "z. B. Mama, Papa, Oma",
    consent:
      "Das ist meine eigene Stimme, oder die Person auf der Aufnahme hat mir ausdrücklich erlaubt, ihre Stimme zu klonen. Ich weiß, dass die Aufnahme an ElevenLabs gesendet wird, um daraus eine Stimme zu erstellen, und dass ich sie hier jederzeit löschen kann.",
    submit: "Stimme erstellen ✨",
    submitting: "Stimme wird erstellt …",
    created: "Deine Stimme ist fertig! Du findest sie jetzt beim Vorlesen.",
    loadFailed: "Deine Stimme konnte nicht geladen werden.",
    locale: "de-DE",
    trialTitle: "Probier deine eigene Stimme aus",
    trialIntro:
      "Nimm dich kurz auf, und du hörst eine Geschichte in deiner eigenen Stimme, ganz ohne Konto.",
    trialDisclaimerTitle: "Nur zum Ausprobieren, nichts wird behalten",
    trialDisclaimer:
      "Deine Aufnahme wird nur für diese eine Geschichte verwendet. Direkt danach wird die geklonte Stimme bei ElevenLabs wieder gelöscht, und wir speichern weder die Aufnahme noch die Stimme. Mit einem kostenlosen Konto kannst du deine Stimme behalten und jederzeit selbst löschen.",
    trialStory: (title) => `Vorgelesen wird: „${title}“`,
    trialShortened: "Beim Ausprobieren wird der Anfang der Geschichte vorgelesen.",
    trialConsent:
      "Das ist meine eigene Stimme, oder die Person auf der Aufnahme hat mir ausdrücklich erlaubt, ihre Stimme zu klonen. Ich weiß, dass die Aufnahme an ElevenLabs gesendet wird, die Stimme nur für diese eine Geschichte genutzt und danach gelöscht wird.",
    trialStep3: "3. Einverständnis",
    trialSubmit: "Mit meiner Stimme vorlesen ✨",
    trialSubmitting: "Deine Stimme liest gleich vor …",
    trialDone: "So klingt die Geschichte in deiner Stimme. Die Stimme wurde bereits wieder gelöscht.",
    trialRegister: "Stimme behalten: kostenloses Konto erstellen",
    defaultStoryTitle: "Der kleine Igel und der Stern",
  },
  en: {
    back: "Back",
    title: "My reading voice",
    intro:
      "Record your voice once, and your stories can be read aloud in it, even when you are not around.",
    current: "Your voice",
    since: (date) => `Recorded on ${date}`,
    rerecord: "Record again",
    delete: "Delete voice",
    deleteTitle: "Delete this voice?",
    deleteBody:
      "The cloned voice and every story read with it are deleted here and at ElevenLabs.",
    deleted: "Your voice was deleted.",
    step1: "1. Read this text out loud",
    tips: "Quiet room, normal distance to the microphone, at least 30 seconds, ideally 1 to 2 minutes.",
    sample:
      "Once upon a time there was a little hedgehog who said good night to the stars every evening. He climbed onto his favourite stone at the edge of the forest, looked up at the sky and counted: one, two, three, so many! One night a star was missing. “Where are you?” whispered the hedgehog. Then he heard a soft giggle behind the moon. The little star had been hiding because it was shy. “You don't need to be scared,” said the hedgehog kindly. “The sky isn't whole without you.” Slowly the star came out and shone brighter than ever before. Since then they wave to each other every evening before they fall asleep. And if you look very closely tonight, you might spot a shy star too.",
    step2: "2. Record",
    start: "Start recording",
    stop: "Stop recording",
    again: "Record again",
    recording: "Recording",
    tooShort: (s) => `${s} more seconds so the voice sounds right.`,
    upload: "… or upload an audio file",
    uploadTooBig: "The file is larger than 10 MB.",
    noMic: "The microphone is not available. You can upload a file instead.",
    step3: "3. Name and consent",
    nameLabel: "What should the voice be called?",
    namePlaceholder: "e.g. Mum, Dad, Grandma",
    consent:
      "This is my own voice, or the person in the recording has explicitly allowed me to clone their voice. I understand that the recording is sent to ElevenLabs to create the voice, and that I can delete it here at any time.",
    submit: "Create voice ✨",
    submitting: "Creating your voice …",
    created: "Your voice is ready! You can now pick it when a story is read aloud.",
    loadFailed: "Your voice could not be loaded.",
    locale: "en-GB",
    trialTitle: "Try your own voice",
    trialIntro:
      "Record yourself briefly and hear a story in your own voice, no account needed.",
    trialDisclaimerTitle: "Just a try, nothing is kept",
    trialDisclaimer:
      "Your recording is only used for this one story. Right after that, the cloned voice is deleted at ElevenLabs, and we store neither the recording nor the voice. With a free account you can keep your voice and delete it yourself at any time.",
    trialStory: (title) => `Story to be read: “${title}”`,
    trialShortened: "The trial reads the beginning of the story.",
    trialConsent:
      "This is my own voice, or the person in the recording has explicitly allowed me to clone their voice. I understand that the recording is sent to ElevenLabs, and that the voice is only used for this one story and deleted afterwards.",
    trialStep3: "3. Consent",
    trialSubmit: "Read it in my voice ✨",
    trialSubmitting: "Your voice is about to read …",
    trialDone: "This is the story in your voice. The voice has already been deleted.",
    trialRegister: "Keep your voice: create a free account",
    defaultStoryTitle: "The little hedgehog and the star",
  },
};

const cardClass =
  "rounded-[2rem] border-2 border-black/10 bg-[#fffaf1]/95 p-6 text-[#3d332d] shadow-[0_18px_50px_rgba(61,43,30,0.16)] sm:p-8 night:border-white/10 night:bg-[#221d33]/95 night:text-[#efe6ff]";
const stepClass =
  "mb-3 text-xs font-black uppercase tracking-[0.2em] text-[#b85c3d] night:text-[#f4a77f]";
const pillClass =
  "flex items-center gap-2 rounded-full px-5 py-2 text-base font-black shadow-[0_3px_0_0_rgba(0,0,0,1)] ring-2 ring-black/80 transition hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-pink-300 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100";

// The story for the guest trial: the one just written on /generate, or the
// sample text when there is none. Long stories are cut at a paragraph.
const loadTrialStory = (t) => {
  let story = null;
  try {
    const stored = JSON.parse(sessionStorage.getItem("generatedStory"));
    if (stored?.story) {
      story = {
        title: stored.prompt?.trim().split(/[.!?]/)[0].slice(0, 90) || t.defaultStoryTitle,
        text: stored.story,
      };
    }
  } catch {
    // No story yet; use the sample.
  }
  story = story || { title: t.defaultStoryTitle, text: t.sample };

  if (story.text.length + story.title.length <= TRIAL_MAX_CHARS - 50) return story;
  let text = "";
  for (const paragraph of story.text.split(/\n+/)) {
    if ((text + paragraph).length > TRIAL_MAX_CHARS - story.title.length - 100) break;
    text += `${paragraph}\n`;
  }
  return { ...story, text: text || story.text.slice(0, 2500), shortened: true };
};

const formatTime = (seconds) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

// Records from the microphone with MediaRecorder. Resolves the recording
// as a Blob plus its length in seconds.
function useRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef(null);
  const timer = useRef(null);

  const stop = useCallback(() => {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }, []);

  const start = useCallback(
    async (onDone) => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = [];
      const media = new MediaRecorder(stream);
      recorder.current = media;
      let elapsed = 0;

      media.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      media.onstop = () => {
        clearInterval(timer.current);
        stream.getTracks().forEach((track) => track.stop());
        setIsRecording(false);
        const type = (media.mimeType || "audio/webm").split(";")[0];
        onDone(new Blob(chunks, { type }), elapsed);
      };

      setSeconds(0);
      setIsRecording(true);
      media.start();
      timer.current = setInterval(() => {
        elapsed += 1;
        setSeconds(elapsed);
        if (elapsed >= MAX_SECONDS) stop();
      }, 1000);
    },
    [stop],
  );

  useEffect(
    () => () => {
      clearInterval(timer.current);
      if (recorder.current?.state === "recording") {
        recorder.current.onstop = null;
        recorder.current.stop();
        recorder.current.stream?.getTracks().forEach((track) => track.stop());
      }
    },
    [],
  );

  return { isRecording, seconds, start, stop };
}

export default function VoicePage() {
  const router = useRouter();
  const [language] = useLanguagePreference();
  const t = TEXT[language] || TEXT.de;

  const [isLoading, setIsLoading] = useState(true);
  const [voice, setVoice] = useState(null);
  const [consentVersion, setConsentVersion] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const [recording, setRecording] = useState(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [micError, setMicError] = useState(false);
  // Guests get a one-time trial; nothing is saved for them.
  const [isGuest, setIsGuest] = useState(false);
  const [trialStory, setTrialStory] = useState(null);
  const [trialAudioUrl, setTrialAudioUrl] = useState(null);
  const recorder = useRecorder();

  useEffect(() => {
    const guest = !getToken();
    // Login state and the guest's story live in browser storage, which is
    // only available after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsGuest(guest);
    if (guest) setTrialStory(loadTrialStory(t));
    getVoice()
      .then((data) => {
        setVoice(data.voice);
        setConsentVersion(data.consentVersion);
        setShowForm(!data.voice);
      })
      .catch(() => toast.error(t.loadFailed))
      .finally(() => setIsLoading(false));
    // Only on the first visit; the language can change without a reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl]);
  useEffect(
    () => () => trialAudioUrl && URL.revokeObjectURL(trialAudioUrl),
    [trialAudioUrl],
  );

  const acceptRecording = (blob, seconds) => {
    setRecording(blob);
    setRecordingSeconds(seconds);
    setPreviewUrl(URL.createObjectURL(blob));
  };

  const startRecording = async () => {
    setMicError(false);
    setRecording(null);
    setPreviewUrl(null);
    try {
      await recorder.start(acceptRecording);
    } catch {
      setMicError(true);
    }
  };

  const handleUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(t.uploadTooBig);
      return;
    }
    // The length of an uploaded file is checked by ElevenLabs.
    acceptRecording(file, MIN_SECONDS);
  };

  const missingSeconds = Math.max(0, MIN_SECONDS - recordingSeconds);
  const canSubmit = recording && missingSeconds === 0 && consent && !isSubmitting;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    setIsSubmitting(true);
    if (isGuest) {
      try {
        const blob = await tryVoice({
          recording,
          consentVersion,
          title: trialStory.title,
          text: trialStory.text,
        });
        setTrialAudioUrl(URL.createObjectURL(blob));
        setConsent(false);
      } catch (err) {
        toast.error(err.message);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }
    try {
      const created = await cloneVoice({ name, recording, consentVersion });
      setVoice(created);
      setShowForm(false);
      setRecording(null);
      setPreviewUrl(null);
      setConsent(false);
      toast.success(t.created);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteVoice();
      setVoice(null);
      setShowForm(true);
      toast.success(t.deleted);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsDeleting(false);
      setShowDelete(false);
    }
  };

  if (isLoading) return <LoadingSpGeneric />;

  return (
    <div className="h-full overflow-y-auto px-4 pb-16 sm:px-8">
      {showDelete && (
        <ConfirmDeleteDialog
          title={t.deleteTitle}
          body={t.deleteBody}
          isDeleting={isDeleting}
          onCancel={() => setShowDelete(false)}
          onConfirm={handleDelete}
        />
      )}

      <header className="mx-auto flex max-w-3xl items-center justify-between gap-4 py-5 sm:py-7">
        <button
          type="button"
          onClick={() => (isGuest ? router.back() : router.push("/dashboard"))}
          className="flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-base font-bold shadow-md ring-2 ring-black/10 transition hover:scale-105 hover:bg-white focus:outline-none focus:ring-4 focus:ring-pink-300 night:bg-white/10 night:ring-white/20 night:hover:bg-white/20"
        >
          <span aria-hidden="true">←</span> {t.back}
        </button>
        <ExperienceControls />
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-6">
        <section className={cardClass}>
          <h1 className="text-4xl font-black leading-tight sm:text-5xl">
            🎙️ {isGuest ? t.trialTitle : t.title}
          </h1>
          <p className="mt-4 text-lg leading-relaxed opacity-80">
            {isGuest ? t.trialIntro : t.intro}
          </p>

          {isGuest && (
            <div
              role="note"
              className="mt-6 rounded-3xl border-2 border-[#7fb7a4]/60 bg-[#e8f6ef] p-5 text-[#24493d] night:border-[#7fb7a4]/40 night:bg-[#1d3a32] night:text-[#cdeee0]"
            >
              <p className="font-black">🔒 {t.trialDisclaimerTitle}</p>
              <p className="mt-2 text-sm leading-relaxed">{t.trialDisclaimer}</p>
            </div>
          )}

          {voice && (
            <div className="mt-6 flex flex-col gap-4 rounded-3xl bg-[#fff3e2]/80 p-5 sm:flex-row sm:items-center sm:justify-between night:bg-white/5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#8a6b55] night:text-[#c9b8e8]">
                  {t.current}
                </p>
                <p className="text-2xl font-black">{voice.name}</p>
                <p className="text-sm opacity-70">
                  {t.since(
                    new Date(voice.createdAt).toLocaleDateString(t.locale, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    }),
                  )}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {!showForm && (
                  <button
                    type="button"
                    onClick={() => setShowForm(true)}
                    className={`${pillClass} bg-white text-[#2c2c2c]`}
                  >
                    {t.rerecord}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowDelete(true)}
                  className="rounded-full px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-50 focus:outline-none focus:ring-4 focus:ring-red-200 night:text-red-300 night:hover:bg-red-500/10"
                >
                  {t.delete}
                </button>
              </div>
            </div>
          )}
        </section>

        {showForm && (
          <form onSubmit={handleSubmit} className={`${cardClass} flex flex-col gap-8`}>
            <div>
              <h2 className={stepClass}>{t.step1}</h2>
              <p className="mb-4 text-sm opacity-70">{t.tips}</p>
              <blockquote className="max-h-64 overflow-y-auto rounded-3xl border-l-4 border-[#f7c898] bg-white/60 p-5 text-lg leading-[1.8] night:bg-white/5">
                {t.sample}
              </blockquote>
            </div>

            <div>
              <h2 className={stepClass}>{t.step2}</h2>
              <div className="flex flex-wrap items-center gap-4">
                {recorder.isRecording ? (
                  <button
                    type="button"
                    onClick={recorder.stop}
                    className={`${pillClass} bg-red-500 text-white`}
                  >
                    <span aria-hidden="true">■</span> {t.stop}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startRecording}
                    className={`${pillClass} bg-[image:var(--peace)] text-[#2c2c2c]`}
                  >
                    <span aria-hidden="true">●</span> {recording ? t.again : t.start}
                  </button>
                )}
                {recorder.isRecording && (
                  <p role="status" className="flex items-center gap-2 font-bold">
                    <span className="h-3 w-3 animate-pulse rounded-full bg-red-500" />
                    {t.recording} {formatTime(recorder.seconds)} /{" "}
                    {formatTime(MAX_SECONDS)}
                  </p>
                )}
              </div>

              {recorder.isRecording && recorder.seconds < MIN_SECONDS && (
                <p className="mt-3 text-sm opacity-70">
                  {t.tooShort(MIN_SECONDS - recorder.seconds)}
                </p>
              )}
              {!recorder.isRecording && recording && missingSeconds > 0 && (
                <p role="alert" className="mt-3 text-sm font-bold text-red-700 night:text-red-300">
                  {t.tooShort(missingSeconds)}
                </p>
              )}
              {micError && (
                <p role="alert" className="mt-3 text-sm font-bold text-red-700 night:text-red-300">
                  {t.noMic}
                </p>
              )}
              {previewUrl && !recorder.isRecording && (
                <audio src={previewUrl} controls className="mt-4 w-full" />
              )}

              <label className="mt-4 inline-block cursor-pointer text-sm font-bold text-[#b85c3d] underline-offset-4 hover:underline night:text-[#f4a77f]">
                {t.upload}
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleUpload}
                  className="sr-only"
                />
              </label>
            </div>

            <div>
              <h2 className={stepClass}>{isGuest ? t.trialStep3 : t.step3}</h2>
              {isGuest ? (
                trialStory && (
                  <p className="font-bold">
                    {t.trialStory(trialStory.title)}
                    {trialStory.shortened && (
                      <span className="block text-sm font-normal opacity-70">
                        {t.trialShortened}
                      </span>
                    )}
                  </p>
                )
              ) : (
                <>
                  <label className="mb-2 block font-bold" htmlFor="voice-name">
                    {t.nameLabel}
                  </label>
                  <input
                    id="voice-name"
                    type="text"
                    maxLength={40}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={t.namePlaceholder}
                    className="w-full rounded-2xl border-2 border-black/15 bg-white px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-pink-300 night:border-white/20 night:bg-white/10"
                  />
                </>
              )}
              <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl bg-[#fff3e2]/80 p-4 text-sm leading-relaxed night:bg-white/5">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                  className="mt-1 h-5 w-5 shrink-0 accent-[#ed8d58]"
                />
                <span>{isGuest ? t.trialConsent : t.consent}</span>
              </label>
            </div>

            <Button
              variant="primary"
              type="submit"
              disabled={!canSubmit}
              className="self-center px-8 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting
                ? isGuest
                  ? t.trialSubmitting
                  : t.submitting
                : isGuest
                  ? t.trialSubmit
                  : t.submit}
            </Button>

            {trialAudioUrl && (
              <div role="status" className="rounded-3xl bg-[#fff3e2]/80 p-5 night:bg-white/5">
                <p className="mb-3 font-bold">{t.trialDone}</p>
                <audio src={trialAudioUrl} controls autoPlay className="w-full" />
                <div className="mt-4 text-center">
                  <Button variant="secondary" href="/register" className="text-lg">
                    {t.trialRegister}
                  </Button>
                </div>
              </div>
            )}
          </form>
        )}
      </main>
    </div>
  );
}
