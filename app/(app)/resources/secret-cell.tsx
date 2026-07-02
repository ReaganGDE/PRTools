"use client";
import { useState } from "react";
import { Eye, EyeOff, Copy, Check } from "lucide-react";
import { revealPassword } from "./actions";

/**
 * Masked password with reveal/copy. The plaintext is fetched from the
 * server only when requested, and only for roles with `resources.reveal`.
 */
export function SecretCell({
  resourceId,
  canReveal,
}: {
  resourceId: string;
  canReveal: boolean;
}) {
  const [secret, setSecret] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  if (!canReveal) {
    return <span className="font-mono text-xs text-zinc-400">••••••••</span>;
  }

  async function fetchSecret(): Promise<string | null> {
    if (secret !== null) return secret;
    setBusy(true);
    setError(false);
    try {
      const value = await revealPassword(resourceId);
      setSecret(value);
      return value;
    } catch {
      setError(true);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function toggle() {
    if (!visible) {
      const value = await fetchSecret();
      if (value === null) return;
    }
    setVisible(!visible);
  }

  async function copy() {
    const value = await fetchSecret();
    if (value === null) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-mono text-xs">
        {visible && secret !== null ? secret : "••••••••"}
      </span>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        title={visible ? "Hide password" : "Show password"}
        className="text-zinc-400 hover:text-zinc-700 disabled:opacity-50 dark:hover:text-zinc-200"
      >
        {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
      <button
        type="button"
        onClick={copy}
        disabled={busy}
        title="Copy password"
        className="text-zinc-400 hover:text-zinc-700 disabled:opacity-50 dark:hover:text-zinc-200"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-green-600" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
      {error ? (
        <span className="text-xs text-red-600">couldn&apos;t load</span>
      ) : null}
    </span>
  );
}
