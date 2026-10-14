// Full-height form layout shared by login, register and generate.
//
// Phone layout (top to bottom): optional header row, title, the fields
// centered in the free space, then the main action and links pinned to the
// bottom where the thumb rests. On md+ screens everything is centered as one
// group so the button stays next to the fields.
export default function FormScreen({
  header,
  title,
  subtitle,
  children,
  actions,
  footer,
  onSubmit,
  decoration,
}) {
  return (
    <div className="h-full overflow-y-auto">
      {decoration}
      <form
        onSubmit={onSubmit}
        className="relative z-10 mx-auto flex min-h-full w-full max-w-md flex-col px-6 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.75rem,env(safe-area-inset-bottom))] md:justify-center md:gap-10"
      >
        {header && <div className="md:absolute md:inset-x-0 md:top-6">{header}</div>}

        <div className="mt-8 text-center md:mt-0">
          <h1 className="text-4xl font-black leading-tight sm:text-5xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mx-auto mt-4 max-w-xs text-lg">
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex flex-1 flex-col justify-center gap-6 py-8 md:flex-none md:py-0">
          {children}
        </div>

        <div className="flex flex-col items-center gap-5">
          {actions}
          {footer && (
            <p className="text-center text-base">
              {footer}
            </p>
          )}
        </div>
      </form>
    </div>
  );
}

// Link styled to stay readable on the gradient background.
export function FormLink({ href, children }) {
  return (
    <a
      href={href}
      className="font-semibold text-indigo-600 hover:text-indigo-500 night:text-indigo-300 night:hover:text-indigo-200"
    >
      {children}
    </a>
  );
}
