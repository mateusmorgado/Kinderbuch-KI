"use client";
import Link from "next/link";
import { useLanguagePreference } from "./ExperienceControls";

// Footer link to the /features showcase page.
export default function FeaturesOverview({ className = "" }) {
  const [language] = useLanguagePreference();

  return (
    <Link
      href="/features"
      className={`group inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest transition hover:scale-105 focus-visible:rounded-sm focus-visible:outline focus-visible:outline-1 ${className}`}
    >
      <span aria-hidden="true" className="twinkle inline-block">
        ✨
      </span>
      <span className="shimmer-text">
        {language === "en" ? "Features & tech" : "Funktionen & Technik"}
      </span>
      <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
        →
      </span>
    </Link>
  );
}
