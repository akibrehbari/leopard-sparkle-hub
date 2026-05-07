"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useLogin } from "@/lib/auth/auth.hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const login = useLogin();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login.mutate(
      { username, password },
      {
        onSuccess: (user) => router.replace(user.role === "influencer" ? "/influencer" : next),
      },
    );
  };

  const errMessage =
    login.error instanceof Error ? login.error.message : null;

  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="size-12 rounded-xl bg-gradient-primary grid place-items-center shadow-glow mb-3">
            <span className="text-primary-foreground font-bold text-base">eL</span>
          </div>
          <h1 className="text-lg font-semibold">eLeopards Dashboard</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Sign in to continue</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="card-surface rounded-xl p-6 space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              autoComplete="username"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {errMessage && (
            <div className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {errMessage}
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={login.isPending || !username || !password}
          >
            {login.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </Button>
        </form>

        <p className="text-center text-[11px] text-muted-foreground mt-4">
          Internal use only · eLeopards
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
