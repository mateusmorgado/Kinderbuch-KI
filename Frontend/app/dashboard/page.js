"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "../components/Button";
import Image from "next/image";
import { clearSession, getToken } from "../utils/auth";
import LoadingSpGeneric from "../components/LoadingSpinner";
import ConnectAssistants from "../components/ConnectAssistants";
import FeaturesOverview from "../components/FeaturesOverview";
import ExperienceControls, {
  useLanguagePreference,
} from "../components/ExperienceControls";

export default function Dashboard() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [language] = useLanguagePreference();
  const isGerman = language === "de";

  useEffect(() => {
    const checkAuth = () => {
      const token = getToken();
      const userData = localStorage.getItem("user");

      if (!token) {
        router.push("/");
      } else if (userData) {
        try {
          const user = JSON.parse(userData);
          // Change user.name to user.displayName since that's what's stored in localStorage
          if (user && user.displayName) {
            const firstNameOnly = user.displayName.split(" ")[0];
            setFirstName(firstNameOnly);
          } else {
            // Handle case where user object doesn't have a displayName property
            setFirstName("");
          }
        } catch (error) {
          console.error("Error parsing user data:", error);
          setFirstName("");
        }
      } else {
        // If no user data but token exists
        setFirstName("");
      }

      setIsLoading(false);
    };

    checkAuth();
  }, [router]);

  const handleLogout = () => {
    clearSession();
    router.push("/");
  };

  if (isLoading) {
    return <LoadingSpGeneric />;
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="fixed right-4 top-[max(1rem,env(safe-area-inset-top))] z-20">
        <ExperienceControls />
      </div>
      <div className="flex flex-col min-h-full items-center px-4 pt-[max(4.5rem,calc(env(safe-area-inset-top)+3.5rem))] pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center">
        <main className="flex w-full flex-1 flex-col items-center justify-center">
          <Image
            src="/kinderbuch.svg"
            alt="Kinderbuch"
            width={350}
            height={200}
            priority
            className="w-[260px] sm:w-[390px] xl:w-[500px] h-auto mx-auto mb-8 sm:mb-12 night:invert night:hue-rotate-180"
          />

          <h1 className="text-2xl sm:text-3xl font-black max-w-[18rem] sm:max-w-md mx-auto mb-8 sm:mb-10 leading-tight">
            {firstName
              ? firstName.charAt(0).toUpperCase() + firstName.slice(1)
              : isGerman
                ? "Hallo"
                : "Hello"}
            ,
            <br />
            {isGerman
              ? "willkommen zu deiner zauberhaften Bibliothek!"
              : "welcome to your magical library!"}
          </h1>

          <div className="w-full max-w-[19rem] font-black grid grid-cols-1 gap-4 mb-10">
            <Button variant="primary" className="w-full" href="/generate">
              {isGerman ? "Erstelle eine Geschichte" : "Create a story"} 📝
            </Button>
            <Button variant="secondary" className="w-full" href="/mystories">
              {isGerman ? "Meine Geschichten" : "My stories"} 📚
            </Button>
            <Button variant="secondary" className="w-full" href="/voice">
              {isGerman ? "Meine Vorlesestimme" : "My reading voice"} 🎙️
            </Button>
          </div>

          <ConnectAssistants />
        </main>

        <footer className="mt-6 flex flex-col items-center text-xs font-bold">
          <hr className="mb-3 w-24 border-t-2 border-current opacity-20" />
          <div className="flex items-center gap-3">
            <FeaturesOverview />
            <span aria-hidden="true" className="opacity-50">
              ·
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="uppercase tracking-widest opacity-70 transition-opacity hover:opacity-100 hover:underline hover:underline-offset-2 focus-visible:rounded-sm focus-visible:outline focus-visible:outline-1"
            >
              Logout
            </button>
          </div>
        </footer>
      </div>

      <div className="fixed right-0 bottom-1/5 hidden md:block slide-in-rl">
        <Image
          src="/kids/girl.png"
          alt=""
          width={100}
          height={400}
          className="md:w-[160px] xl:w-[180px]"
        />
      </div>

      <div className="fixed -left-5 top-2/7 xl:top-2/5 hidden md:block slide-in-lr">
        <Image
          src="/misc/boy-mag.png"
          alt=""
          width={100}
          height={400}
          className="md:w-[160px] xl:w-[180px]"
        />
      </div>
    </div>
  );
}
