"use client";

const IDEAS = {
  de: [
    { emoji: "🦊", label: "Fuchs & Sterne", text: "Ein kleiner Fuchs findet im Wald eine Tür, die direkt zu den Sternen führt." },
    { emoji: "🐉", label: "Mutiger Drache", text: "Ein schüchterner kleiner Drache lernt, dass er Feuer machen kann, um seine Freunde zu wärmen." },
    { emoji: "🌙", label: "Mond-Picknick", text: "Zwei Geschwister machen mit ihrem Teddy ein Picknick auf dem Mond." },
    { emoji: "🐢", label: "Schnelle Schildkröte", text: "Eine Schildkröte gewinnt ein Rennen, weil sie allen Tieren unterwegs hilft." },
  ],
  en: [
    { emoji: "🦊", label: "Fox & stars", text: "A little fox finds a door in the woods that leads straight to the stars." },
    { emoji: "🐉", label: "Brave dragon", text: "A shy little dragon learns that its fire can keep its friends warm." },
    { emoji: "🌙", label: "Moon picnic", text: "Two siblings have a picnic on the moon with their teddy bear." },
    { emoji: "🐢", label: "Speedy turtle", text: "A turtle wins a race because it helps every animal along the way." },
  ],
};

const SPARKLES = [
  { className: "-top-3 left-6 text-xl", delay: "0s" },
  { className: "-top-2 right-10 text-base", delay: "0.9s" },
  { className: "top-1/2 -right-3 text-lg", delay: "1.6s" },
  { className: "-bottom-3 left-1/3 text-sm", delay: "0.4s" },
];

// The story idea box: a paper-like textarea in a flowing rainbow frame, with
// twinkling sparkles and a few ideas to start from.
export default function MagicPrompt({
  id,
  value,
  onChange,
  onKeyDown,
  disabled,
  language,
  placeholder,
  hint,
  hintId,
}) {
  const isGerman = language === "de";
  const ideas = IDEAS[isGerman ? "de" : "en"];

  return (
    <div>
      <div className="relative">
        {SPARKLES.map((sparkle, index) => (
          <span
            key={index}
            aria-hidden="true"
            className={`twinkle pointer-events-none absolute z-10 text-[#f4a77f] drop-shadow night:text-[#f8ceee] ${sparkle.className}`}
            style={{ animationDelay: sparkle.delay }}
          >
            ✦
          </span>
        ))}

        <div className="magic-frame rounded-[1.9rem] p-[3px] shadow-[0_4px_0_0_rgba(0,0,0,1)]">
          <textarea
            id={id}
            value={value}
            onChange={onChange}
            onKeyDown={onKeyDown}
            aria-describedby={hintId}
            placeholder={placeholder}
            rows={7}
            disabled={disabled}
            className="block min-h-48 w-full resize-none rounded-[1.7rem] bg-[#fffaf1] bg-[radial-gradient(circle_at_15%_10%,rgba(247,200,152,0.35),transparent_45%),radial-gradient(circle_at_90%_90%,rgba(156,140,250,0.18),transparent_50%)] p-5 pb-11 text-left text-lg leading-relaxed text-[#3d332d] caret-[#ed8d58] outline-none placeholder:italic placeholder:text-[#8a6b55]/80 disabled:opacity-60 night:bg-[#221d33] night:bg-[radial-gradient(circle_at_15%_10%,rgba(156,140,250,0.3),transparent_45%),radial-gradient(circle_at_90%_90%,rgba(248,206,238,0.15),transparent_50%)] night:text-[#efe6ff] night:caret-[#f8ceee] night:placeholder:text-[#c9b8e8]/70"
          />
        </div>

        {hint && (
          <p
            id={hintId}
            className="pointer-events-none absolute right-5 bottom-3 hidden text-xs font-bold text-[#8a6b55] sm:block night:text-[#c9b8e8]"
          >
            {hint}
          </p>
        )}
      </div>

      <div className="mt-5">
        <p className="mb-2 text-center text-sm font-bold opacity-75">
          {isGerman ? "Brauchst du eine Idee?" : "Need an idea?"}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {ideas.map((idea) => (
            <button
              key={idea.label}
              type="button"
              disabled={disabled}
              onClick={() => onChange({ target: { value: idea.text } })}
              className="rounded-full bg-white/75 px-3 py-1.5 text-sm font-bold shadow-sm ring-2 ring-black/10 transition hover:-translate-y-0.5 hover:bg-white hover:ring-[#f4a77f] focus:outline-none focus:ring-4 focus:ring-pink-300 disabled:opacity-50 night:bg-white/10 night:ring-white/20 night:hover:bg-white/20"
            >
              <span aria-hidden="true">{idea.emoji}</span> {idea.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
