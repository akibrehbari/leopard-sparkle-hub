"use client";

import { useState } from "react";
import { Eye, EyeOff, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface Props {
  id: string;
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  optional?: boolean;
  minLength?: number;
}

const ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789-_";

export function generatePassword(length = 16): string {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    let out = "";
    for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
    return out;
  }
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return out;
}

export function PasswordField({ id, label = "Password", value, onChange, placeholder, optional, minLength = 8 }: Props) {
  const [show, setShow] = useState(false);

  const generate = () => {
    onChange(generatePassword());
    setShow(true);
  };

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}{" "}
        {optional && (
          <span className="text-muted-foreground font-normal">(leave blank to keep)</span>
        )}
      </Label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            id={id}
            type={show ? "text" : "password"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder ?? (optional ? "New password" : `At least ${minLength} characters`)}
            autoComplete="new-password"
            className="pr-9 font-mono text-xs"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={generate} title="Generate random password">
          <RefreshCw className="size-4" />
        </Button>
      </div>
      {!optional && (
        <p className="text-[11px] text-muted-foreground">
          Stored as a bcrypt hash. Copy the password before submitting — it cannot be recovered later, only reset.
        </p>
      )}
    </div>
  );
}
