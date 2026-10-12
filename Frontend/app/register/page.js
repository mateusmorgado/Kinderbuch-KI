"use client";
import { useState } from "react";
import Button from "../components/Button";
import InputField from "../components/InputField";
import FormScreen, { FormLink } from "../components/FormScreen";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import api from "../utils/api";
import Image from "next/image";

// Register function using Axios
const registerUser = async (userData) => {
  const response = await api.post("/api/users", {
    username: userData.username,
    password: userData.password,
  });

  return response.data;
};

export default function Register() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });

  // Define the mutation
  const mutation = useMutation({
    mutationFn: registerUser,
    onSuccess: (data) => {
      toast.success("Registrierung erfolgreich. Sie werden weitergeleitet.");

      if (typeof window !== "undefined") {
        localStorage.setItem("token", data.accessToken); // Store the access token
        localStorage.setItem("user", JSON.stringify({
          id: data.user.id,
          name: data.user.displayName,
          displayName: data.user.displayName,
          username: data.user.username,
        })); // Store user details
      }

      setTimeout(() => {
        router.push("/dashboard"); // Redirect to dashboard after successful registration
      }, 2000);
    },
    onError: (error) => {
      toast.error(
        error.response?.data?.error ||
          error.message ||
          "Registrierung fehlgeschlagen. Bitte versuchen Sie es erneut."
      );
    },
  });

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.id]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  return (
    <FormScreen
      onSubmit={handleSubmit}
      title="Erstelle ein Konto"
      subtitle="Wähle einen Benutzernamen und ein Passwort."
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
          {mutation.isPending ? "Sie werden registriert..." : "Registrieren"}
        </Button>
      }
      footer={
        <>
          Schon ein Konto? <FormLink href="/login">Hier anmelden</FormLink>
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
        placeholder="z. B. kleiner.fuchs"
        autoComplete="username"
      />

      <InputField
        label="Passwort"
        id="password"
        type="password"
        required
        value={formData.password}
        onChange={handleChange}
        placeholder="Mindestens 6 Zeichen"
        autoComplete="new-password"
      />
    </FormScreen>
  );
}
