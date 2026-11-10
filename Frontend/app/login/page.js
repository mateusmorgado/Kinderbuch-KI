"use client";
import Link from "next/link";
import { useState } from "react";
import Button from "../components/Button";
import InputField from "../components/InputField";
import FormScreen, { FormLink } from "../components/FormScreen";
import ExperienceControls, {
  useLanguagePreference,
} from "../components/ExperienceControls";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import api from "../utils/api";
import { saveSession } from "../utils/auth";
import Image from "next/image";

const TEXT = {
  de: {
    home: "Startseite",
    title: "Willkommen zurück",
    subtitle: "Melde dich an, um deine Geschichten zu sehen.",
    username: "Benutzername",
    usernamePlaceholder: "Dein Benutzername",
    password: "Passwort",
    passwordPlaceholder: "Dein Passwort",
    submit: "Anmelden",
    submitting: "Anmeldung ...",
    success: "Willkommen zurück!",
    wrongLogin: "Benutzername oder Passwort ist falsch.",
    failed: "Login fehlgeschlagen. Bitte versuche es erneut.",
    switchText: "Noch kein Konto?",
    switchLink: "Hier registrieren",
  },
  en: {
    home: "Home",
    title: "Welcome back",
    subtitle: "Log in to see your stories.",
    username: "Username",
    usernamePlaceholder: "Your username",
    password: "Password",
    passwordPlaceholder: "Your password",
    submit: "Log in",
    submitting: "Logging in ...",
    success: "Welcome back!",
    wrongLogin: "Wrong username or password.",
    failed: "Login failed. Please try again.",
    switchText: "No account yet?",
    switchLink: "Sign up here",
  },
};

const loginUser = async ({ username, password }) => {
  const response = await api.post("/login", { username, password });
  return response.data;
};

export default function Login() {
  const router = useRouter();
  const [language] = useLanguagePreference();
  const t = TEXT[language] || TEXT.de;
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });

  const mutation = useMutation({
    mutationFn: loginUser,
    onSuccess: (data) => {
      saveSession(data.accessToken, data);
      toast.success(t.success);
      router.push("/dashboard");
    },
    onError: (error) => {
      toast.error(error.response?.status === 401
          ? t.wrongLogin
          : error.response?.data?.error || t.failed);
    },
  });

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.id]: e.target.value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  return (
    <FormScreen
      onSubmit={handleSubmit}
      header={
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-base font-bold shadow-md ring-2 ring-black/10 transition hover:scale-105 hover:bg-white focus:outline-none focus:ring-4 focus:ring-pink-300 night:bg-white/10 night:ring-white/20 night:hover:bg-white/20"
          >
            <span aria-hidden="true">←</span> {t.home}
          </Link>
          <ExperienceControls />
        </div>
      }
      title={t.title}
      subtitle={t.subtitle}
      decoration={
        <div className="pointer-events-none fixed bottom-0 left-2 z-0 hidden md:left-10 md:block xl:left-25">
          <Image
            src="/misc/dog.png"
            alt=""
            width={140}
            height={400}
            className="md:w-[220px] xl:w-[240px]"
            priority
          />
        </div>
      }
      actions={
        <Button
          type="submit"
          variant="secondary"
          className="w-full max-w-xs py-4 font-black"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? t.submitting : t.submit}
        </Button>
      }
      footer={
        <>
          {t.switchText} <FormLink href="/register">{t.switchLink}</FormLink>
        </>
      }
    >
      <InputField
        label={t.username}
        id="username"
        type="text"
        required
        value={formData.username}
        onChange={handleChange}
        autoComplete="username"
        placeholder={t.usernamePlaceholder}
      />

      <InputField
        label={t.password}
        id="password"
        type="password"
        required
        value={formData.password}
        onChange={handleChange}
        autoComplete="current-password"
        placeholder={t.passwordPlaceholder}
      />
    </FormScreen>
  );
}
