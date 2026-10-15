"use client";
import { useState } from "react";
import Button from "../components/Button";
import InputField from "../components/InputField";
import FormScreen, { FormLink } from "../components/FormScreen";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import api from "../utils/api";
import { saveSession } from "../utils/auth";
import Image from "next/image";

// Login function outside the component
const loginUser = async (userData) => {
  const response = await api.post("/login", {
    username: userData.username,
    password: userData.password,
  });

  if (!response.data) {
    throw new Error("Login fehlgeschlagen!");
  }

  return response.data;
};

export default function Login() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });

  const mutation = useMutation({
    mutationFn: loginUser,
    onSuccess: (data) => {
      toast.success("Login erfolgreich! Sie werden weitergeleitet.");

      saveSession(data.accessToken, data);

      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
    },
    onError: (error) => {
      toast.error(
        error.response?.status === 401
          ? "Benutzername oder Passwort ist falsch."
          : error.response?.data?.error ||
            error.message ||
            "Login fehlgeschlagen! Bitte überprüfen Sie Ihre Eingaben."
      );
    },
  });

  function handleChange(e) {
    setFormData({
      ...formData,
      [e.target.id]: e.target.value,
    });
  }

  function handleSubmit(e) {
    e.preventDefault();
    mutation.mutate(formData);
  }

  return (
    <FormScreen
      onSubmit={handleSubmit}
      title="Willkommen zurück"
      subtitle="Melde dich an, um deine Geschichten zu sehen."
      decoration={
        <div className="pointer-events-none fixed bottom-0 left-2 z-0 hidden md:left-10 md:block xl:left-25">
          <Image
            src="/misc/dog.png"
            alt="Dog illustration"
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
          {mutation.isPending ? "Anmeldung..." : "Anmelden"}
        </Button>
      }
      footer={
        <>
          Noch kein Konto? <FormLink href="/register">Hier registrieren</FormLink>
        </>
      }
    >
      <InputField
        label="Benutzername"
        id="username"
        type="text"
        required
        value={formData.username}
        onChange={handleChange}
        autoComplete="username"
        placeholder="Dein Benutzername"
      />

      <InputField
        label="Passwort"
        id="password"
        type="password"
        required
        value={formData.password}
        onChange={handleChange}
        autoComplete="current-password"
        placeholder="Dein Passwort"
      />
    </FormScreen>
  );
}
