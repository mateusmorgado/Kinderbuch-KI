"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "../components/Button";
import Image from "next/image";
import { clearSession, getToken } from "../utils/auth";
import LoadingSpGeneric from "../components/LoadingSpinner";
import ConnectAssistants from "../components/ConnectAssistants";
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
      <div className="flex flex-col min-h-full justify-between items-center pb-[env(safe-area-inset-bottom)] text-center">
        <div className="w-full px-4 py-6 sm:px-0">
          <Image
            src="/kinderbuch.svg"
            alt="Kinderbuch"
            width={350}
            height={200}
            priority
            className="m-8 w-[300px] sm:w-[390px] xl:w-[500] h-auto mx-auto mb-16 night:invert night:hue-rotate-180"
          />
        </div>

        <div className="text-3xl font-black max-w-[20rem] xl:max-w-none mx-auto mb-12">
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
        </div>

        <div className="font-black grid grid-cols-1 gap-6 justify-items-center mb-8  ">
          <Button variant="primary" className="min-w-74" href="/generate">
            {isGerman ? "Erstelle eine Geschichte" : "Create a story"} 📝
          </Button>
          <Button variant="secondary" className="min-w-74" href="/mystories">
            {isGerman ? "Meine Geschichten" : "My stories"} 📚
          </Button>
          <Button variant="secondary" className="min-w-74" href="/voice">
            {isGerman ? "Meine Vorlesestimme" : "My reading voice"} 🎙️
          </Button>
          <Button variant="tertiary" onClick={handleLogout}>
            Logout
          </Button>
        </div>

        <ConnectAssistants />
      </div>

      <div className="fixed right-0 bottom-3/5 md:bottom-1/5 block slide-in-rl">
        <Image
          src="/kids/girl.png"
          alt=""
          width={100}
          height={400}
          className="md:w-[160px] xl:w-[180px]"
        />
      </div>

      <div className="fixed -left-5 top-1/5 md:top-2/7 xl:top-2/5 block slide-in-lr">
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
