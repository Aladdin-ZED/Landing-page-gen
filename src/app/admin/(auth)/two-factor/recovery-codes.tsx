"use client";

import { CheckIcon, CopyIcon, DownloadIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

/** Shows freshly generated recovery codes once, with copy / download and a "saved" confirmation. */
export function RecoveryCodes({ codes, continueHref }: { codes: string[]; continueHref: string }) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const checkboxId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const text = [
    "COD Studio — two-step verification recovery codes",
    `Generated ${new Date().toISOString().slice(0, 10)}. Each code works once.`,
    "",
    ...codes,
    "",
  ].join("\n");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "cod-studio-recovery-codes.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoking in the same tick can cancel the download in some browsers.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <section aria-labelledby={`${checkboxId}-title`} className="grid gap-5">
      <div className="grid gap-1.5">
        <h2 ref={headingRef} tabIndex={-1} id={`${checkboxId}-title`} className="text-base font-semibold outline-none">
          Save your recovery codes
        </h2>
        <p className="text-sm text-muted-foreground">
          If you lose your phone, each code lets you sign in once. They won&apos;t be shown again.
        </p>
      </div>

      <ol className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border bg-card p-4 font-mono text-[0.9rem] tracking-wide tabular-nums">
        {codes.map((code) => (
          <li key={code} className="select-all">
            {code}
          </li>
        ))}
      </ol>

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" className="h-9" onClick={copy}>
          {copied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button type="button" variant="outline" className="h-9" onClick={download}>
          <DownloadIcon aria-hidden="true" />
          Download
        </Button>
      </div>
      <p aria-live="polite" className="sr-only">
        {copied ? "Recovery codes copied to the clipboard." : ""}
      </p>

      <div className="flex items-center gap-3">
        <Checkbox id={checkboxId} checked={saved} onCheckedChange={(v) => setSaved(v === true)} />
        <Label htmlFor={checkboxId} className="font-normal">
          I&apos;ve stored these codes somewhere safe
        </Label>
      </div>

      {saved ? (
        <Button asChild size="lg" className="h-10 w-full">
          <Link href={continueHref}>Continue</Link>
        </Button>
      ) : (
        <Button type="button" size="lg" className="h-10 w-full" disabled>
          Continue
        </Button>
      )}
    </section>
  );
}
