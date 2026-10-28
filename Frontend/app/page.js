"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Button from "./components/Button";
import ExperienceControls, {
  useLanguagePreference,
} from "./components/ExperienceControls";
import Image from "next/image";
import { getToken } from "./utils/auth";

const contributors = [
  { name: "Mateus Morgado", href: "https://github.com/mateusmorgado" },
  { name: "jpg344", href: "https://github.com/jpg344" },
  { name: "Rosa Chapoteau", href: "https://github.com/XRayhanna" },
  {
    name: "Koray Goekalp",
    href: "https://github.com/search?q=Koray+Goekalp&type=users",
  },
  { name: "kogo1011", href: "https://github.com/kogo1011" },
  { name: "Rene", href: "https://github.com/renapEvil" },
];

export default function Home() {
  const router = useRouter();
  const [language] = useLanguagePreference();
  const isGerman = language === "de";

  useEffect(() => {
    // Logged-in users go straight to their dashboard
    if (getToken()) {
      router.push("/dashboard");
    }
  }, [router]);

  return (
    <>
      <div className="fixed right-4 top-[max(1rem,env(safe-area-inset-top))] z-20">
        <ExperienceControls />
      </div>
      <div className="fixed -right-9 -bottom-5 md:-bottom-1 md:right-15 block slide-in-bt">
        <Image
          src="/misc/girl-mag.png"
          alt=""
          width={120}
          height={400}
          className="md:w-[160px] xl:w-[180px]"
        />
      </div>

      <div className="fixed left-0 top-1/3 md:top-1/2 -translate-y-1/2 block slide-in-lr">
        <Image
          src="/kids/boy-peek.png"
          alt=""
          width={100}
          height={400}
          className=" md:w-[140px] xl:w-[160px] "
        />
      </div>
      <div className="fixed -right-15 top-1/3 md:top-1/4 -translate-y-1/2 block slide-in-rl">
        <Image
          src="/misc/lion-mag.png"
          alt=""
          width={180}
          height={220}
          className=" md:w-[260px] xl:w-[280px]"
        />
      </div>
      <div className="h-full overflow-y-auto">
        <div className="flex flex-col min-h-full justify-between pt-8 pb-[max(2rem,env(safe-area-inset-bottom))] px-2 items-center text-center">
          <div className="w-full sm:px-0">
            <Image
              src="/kinderbuch.svg"
              alt="Kinderbuch"
              width={420}
              height={200}
              priority
              className="m-8 w-[300px] sm:w-[390px] xl:w-[500] h-auto mx-auto mb-16 night:invert night:hue-rotate-180"
            />
          </div>
          <div className="mx-64"></div>

          <div className="text-3xl font-black max-w-[14rem] sm:max-w-none mx-auto">
            {isGerman
              ? "Wo Träume zu Geschichten werden"
              : "Where dreams become stories"}
          </div>

          <div className="w-60 font-black grid grid-cols-1 gap-4 justify-items-center ">
            <Button variant="primary" className="w-60" href="/register">
              {isGerman ? "Registrieren" : "Sign up"}
            </Button>
            <Button variant="secondary" className="w-60" href="/login">
              {isGerman ? "Login" : "Log in"}
            </Button>
            <Button variant="glow" className="w-60" href="/generate">
              {isGerman ? "Experiment starten" : "Start experiment"}
            </Button>
          </div>

          <footer className="mt-6 max-w-3xl pb-2 text-xs font-bold">
            <p className="mb-1 uppercase tracking-widest opacity-70">
              {isGerman ? "Mitwirkende" : "Contributors"}
            </p>
            <p className="leading-relaxed opacity-80">
              {contributors.map((contributor, index) => (
                <span key={contributor.name}>
                  {index > 0 && " · "}
                  <a
                    href={contributor.href}
                    target="_blank"
                    rel="noreferrer"
                    className="transition-opacity hover:opacity-70 hover:underline hover:underline-offset-2 focus-visible:rounded-sm focus-visible:outline focus-visible:outline-1"
                    aria-label={`Visit ${contributor.name} on GitHub`}
                  >
                    {contributor.name}
                  </a>
                </span>
              ))}
            </p>
          </footer>
        </div>
      </div>
    </>
  );
}
