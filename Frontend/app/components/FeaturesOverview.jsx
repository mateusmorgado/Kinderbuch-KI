"use client";
import Link from "next/link";
import { useLanguagePreference } from "./ExperienceControls";

// Footer link to the /features showcase page, styled like its GitHub button.
export default function FeaturesOverview({ className = "" }) {
  const [language] = useLanguagePreference();

  return (
    <Link
      href="/features"
      className={`group inline-flex items-center gap-1.5 rounded-full bg-[#2c2c2c] px-4 py-1.5 text-sm font-black text-white shadow-[0_3px_0_0_rgba(0,0,0,1)] ring-2 ring-black transition hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pink-300 night:bg-white night:text-[#221d33] ${className}`}
    >
      {language === "en" ? "Features & tech" : "Funktionen & Technik"}
      <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
        →
      </span>
    </Link>
  );
}
