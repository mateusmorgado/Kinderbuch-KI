"use client";
import { useState } from "react";
import Button from "../components/Button";
import InputField from "../components/InputField";
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
    <div className="flex flex-col items-center justify-center min-h-screen">
      <div className="fixed left-2 md:left-10 xl:left-25 bottom-0 block slide-in-bt">
              <Image
                src="/misc/dog.png"
                alt="Dog illustration"
                width={140}
                height={400}
                className="md:w-[220px] xl:w-[240px]"
                priority
              />
            </div>
      <div className="flex min-h-full flex-1 flex-col justify-top md:justify-center px-6 pt-2 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-sm">
          <h2 className="mt-10 text-center text-4xl font-black leading-9 tracking-tight">
            Erstelle ein Konto
          </h2>
        </div>

        <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
          <form onSubmit={handleSubmit} className="space-y-6">
            <InputField
              label="Benutzername"
              id="username"
              type="text"
              required
              value={formData.username}
              onChange={handleChange}
              placeholder="Wähle einen Benutzernamen"
              autoComplete="username"
            />

            <InputField
              label="Passwort"
              id="password"
              type="password"
              required
              value={formData.password}
              onChange={handleChange}
              placeholder="Geben Sie Ihr Passwort ein"
              autoComplete="new-password"
            />

            <div className="font-black flex justify-center">
              <Button className="min-w-60" type="submit" variant="secondary" disabled={mutation.isPending}>
                {mutation.isPending ? "Sie werden registriert...": "Registrieren"}
              </Button>
            </div>
          </form>

          <p className="mt-10 text-center text-sm md:max-w-sm text-gray-500">
            Sie haben schon ein Konto?{" "}
            <a
              href="/login"
              className="font-semibold text-indigo-600 hover:text-indigo-500"
            >
              Melden Sie sich hier an
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}