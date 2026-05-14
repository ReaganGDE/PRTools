"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AVAILABLE_MERGE_FIELDS } from "@/lib/email/render-template";

export function EmailTemplateForm({
  action,
  initial,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  initial?: { name?: string; subject?: string; body?: string };
  submitLabel: string;
}) {
  const [body, setBody] = useState(initial?.body ?? "");
  const [subject, setSubject] = useState(initial?.subject ?? "");

  function insertField(field: string) {
    setBody((b) => b + `{{${field}}}`);
  }

  return (
    <form action={action} className="grid max-w-3xl gap-4">
      <div className="grid gap-2">
        <Label htmlFor="name">Template name</Label>
        <Input
          id="name"
          name="name"
          required
          defaultValue={initial?.name ?? ""}
          placeholder="e.g. Film X press release v1"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="subject">Subject</Label>
        <Input
          id="subject"
          name="subject"
          required
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Hey {{first_name}}, screener for Film X"
        />
      </div>
      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="body">Body (HTML)</Label>
          <div className="flex flex-wrap gap-1">
            {AVAILABLE_MERGE_FIELDS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => insertField(f)}
                className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                + {`{{${f}}}`}
              </button>
            ))}
          </div>
        </div>
        <textarea
          id="body"
          name="body"
          required
          rows={14}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="rounded-md border border-zinc-200 bg-white p-3 font-mono text-sm dark:border-zinc-800 dark:bg-zinc-950"
          placeholder={`<p>Hi {{first_name}},</p>\n<p>We're releasing...</p>`}
        />
        <p className="text-xs text-zinc-500">
          Plain HTML. Use <code>{`{{first_name}}`}</code>,{" "}
          <code>{`{{outlet}}`}</code>, etc. Unsubscribe footer is added
          automatically at send time.
        </p>
      </div>
      <div className="flex gap-2">
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
