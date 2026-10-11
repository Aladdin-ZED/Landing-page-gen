"use client";
/**
 * Settings → Team (owner only): members with their role, 2FA and last sign-in; invite by creating
 * an account with a one-time temporary password; change role, reset password, disable/enable.
 */
import {
  BadgeCheckIcon,
  CheckIcon,
  CrownIcon,
  HeadsetIcon,
  KeyRoundIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  PaletteIcon,
  PowerIcon,
  ShieldAlertIcon,
  UserPlusIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_LABELS, type Role } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "../common/confirm-dialog";
import { CopyButton } from "../common/copy-button";
import { StatusChip } from "../common/status-chip";
import { RelativeTime } from "../common/time";
import { runAction, type ActionResult } from "../lib/action-result";
import { initials } from "../lib/format";
import { Field, SettingsSection, TextInput } from "./form-kit";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  totpEnabled: boolean;
  disabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface TeamActions {
  invite: (input: { name: string; email: string; role: string }) => Promise<ActionResult<{ email: string; password: string }>>;
  setRole: (userId: string, role: string) => Promise<ActionResult<null>>;
  setDisabled: (userId: string, disabled: boolean) => Promise<ActionResult<null>>;
  resetPassword: (userId: string) => Promise<ActionResult<{ password: string }>>;
}

const ROLE_INFO: Record<Role, { icon: typeof CrownIcon; text: string; tone: "brand" | "violet" | "teal" }> = {
  owner: { icon: CrownIcon, text: "Everything, including team, settings and security.", tone: "brand" },
  editor: { icon: PaletteIcon, text: "Generates, edits, publishes and exports pages. Sees orders and settings.", tone: "violet" },
  agent: { icon: HeadsetIcon, text: "Works the order queue only: confirms, updates statuses, blocks fakes.", tone: "teal" },
};
const ROLES = Object.keys(ROLE_INFO) as Role[];

export function TeamPanel({ members, currentUserId, actions }: { members: TeamMember[]; currentUserId: string; actions: TeamActions }) {
  const router = useRouter();
  const [inviting, setInviting] = useState(false);
  const [credentials, setCredentials] = useState<{ title: string; email: string; password: string } | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "reset" | "disable" | "enable"; member: TeamMember } | null>(null);
  // the dialog keeps showing the last request while it animates out (confirm is already null)
  const [shown, setShown] = useState(confirm);
  if (confirm && confirm !== shown) setShown(confirm);
  const [busy, setBusy] = useState<string | null>(null);
  const active = members.filter((m) => !m.disabled).length;

  const changeRole = async (m: TeamMember, role: Role) => {
    if (role === m.role) return;
    setBusy(m.id);
    try {
      const ok = await runAction(actions.setRole(m.id, role), { success: `${m.name} is now ${ROLE_LABELS[role].toLowerCase()} — they were signed out to apply it` });
      if (ok !== undefined) router.refresh();
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <SettingsSection
        title="Members"
        description={`${active} active member${active === 1 ? "" : "s"}. New members get a temporary password you hand over yourself — nothing is emailed.`}
        aside={
          <Button variant="brand" className="rounded-full px-4" onClick={() => setInviting(true)}>
            <UserPlusIcon />
            Add member
          </Button>
        }
        style={{ ["--i" as string]: 1 }}
      >
        <ul className="grid gap-2">
          <AnimatePresence initial={false}>
            {members.map((m) => {
              const self = m.id === currentUserId;
              const info = ROLE_INFO[m.role];
              return (
                <motion.li
                  key={m.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "grid gap-3 rounded-2xl p-3.5 ring-1 ring-inset sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center",
                    m.disabled ? "bg-foreground/[0.02] ring-foreground/[0.05]" : "ring-foreground/[0.08]",
                  )}
                >
                  <div className={cn("flex min-w-0 items-center gap-3", m.disabled && "opacity-55")}>
                    <span
                      aria-hidden="true"
                      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(140deg,color-mix(in_oklab,var(--brand)_22%,var(--card)),color-mix(in_oklab,var(--chart-3)_22%,var(--card)))] text-sm font-semibold text-foreground/80 ring-1 ring-foreground/10"
                    >
                      {initials(m.name)}
                    </span>
                    <div className="grid min-w-0 gap-0.5">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
                        <span className="truncate">{m.name}</span>
                        {self && <span className="text-xs font-normal text-muted-foreground">(you)</span>}
                        {m.disabled && <StatusChip tone="neutral">Disabled</StatusChip>}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {m.email} · {m.lastLoginAt ? <>last seen <RelativeTime iso={m.lastLoginAt} /></> : "never signed in"}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    {m.totpEnabled ? (
                      <StatusChip tone="emerald" title="Two-step verification is on">
                        2FA
                      </StatusChip>
                    ) : (
                      <StatusChip tone="warn" title="Two-step verification is off">
                        No 2FA
                      </StatusChip>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild disabled={self || m.disabled || busy === m.id}>
                        <button
                          type="button"
                          className="inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium ring-1 ring-foreground/10 transition-colors ring-inset hover:bg-foreground/[0.04] disabled:cursor-default disabled:hover:bg-transparent"
                          aria-label={`Role of ${m.name}: ${ROLE_LABELS[m.role]}`}
                        >
                          {busy === m.id ? <Loader2Icon className="size-3.5 animate-spin" /> : <info.icon className="size-3.5" />}
                          {ROLE_LABELS[m.role]}
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-72 rounded-xl">
                        <DropdownMenuLabel>Role</DropdownMenuLabel>
                        <DropdownMenuRadioGroup value={m.role} onValueChange={(r) => void changeRole(m, r as Role)}>
                          {ROLES.map((r) => (
                            <DropdownMenuRadioItem key={r} value={r} className="items-start py-2">
                              <span className="grid gap-0.5">
                                <span className="font-medium">{ROLE_LABELS[r]}</span>
                                <span className="text-xs text-muted-foreground">{ROLE_INFO[r].text}</span>
                              </span>
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    {!self && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" className="rounded-full" aria-label={`More actions for ${m.name}`}>
                            <MoreHorizontalIcon />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 rounded-xl">
                          {!m.disabled && (
                            <DropdownMenuItem onSelect={() => setConfirm({ kind: "reset", member: m })}>
                              <KeyRoundIcon />
                              Reset password
                            </DropdownMenuItem>
                          )}
                          {!m.disabled && <DropdownMenuSeparator />}
                          {m.disabled ? (
                            <DropdownMenuItem onSelect={() => setConfirm({ kind: "enable", member: m })}>
                              <PowerIcon />
                              Enable account
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem variant="destructive" onSelect={() => setConfirm({ kind: "disable", member: m })}>
                              <PowerIcon />
                              Disable account
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
        {members.length === 1 && (
          <div className="adm-aurora flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3.5 ring-1 ring-brand/15 ring-inset">
            <p className="text-sm text-pretty">
              <span className="font-medium">It&apos;s just you for now.</span>{" "}
              <span className="text-muted-foreground">Add your call-center agents so they confirm orders without seeing your pages or settings.</span>
            </p>
            <Button variant="outline" size="sm" className="rounded-full" onClick={() => setInviting(true)}>
              <HeadsetIcon />
              Add an agent
            </Button>
          </div>
        )}
      </SettingsSection>

      <SettingsSection title="What each role can do" style={{ ["--i" as string]: 2 }}>
        <ul className="grid gap-3 md:grid-cols-3">
          {ROLES.map((r) => {
            const info = ROLE_INFO[r];
            return (
              <li key={r} className="grid content-start gap-2 rounded-2xl p-4 ring-1 ring-foreground/[0.07] ring-inset">
                <StatusChip tone={info.tone} dot={false} className="justify-self-start">
                  <info.icon className="size-3.5" />
                  {ROLE_LABELS[r]}
                </StatusChip>
                <p className="text-sm leading-relaxed text-pretty text-muted-foreground">{info.text}</p>
              </li>
            );
          })}
        </ul>
      </SettingsSection>

      <InviteDialog
        open={inviting}
        onOpenChange={setInviting}
        invite={actions.invite}
        onCreated={(c) => {
          setInviting(false);
          setCredentials({ title: "Member added", ...c });
          router.refresh();
        }}
      />

      <CredentialsDialog credentials={credentials} onClose={() => setCredentials(null)} />

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        destructive={shown?.kind === "disable"}
        icon={shown?.kind === "reset" ? <KeyRoundIcon /> : shown?.kind === "disable" ? <ShieldAlertIcon /> : <BadgeCheckIcon />}
        title={
          shown?.kind === "reset"
            ? `Reset ${shown.member.name}'s password?`
            : shown?.kind === "disable"
              ? `Disable ${shown?.member.name}?`
              : `Enable ${shown?.member.name}?`
        }
        description={
          shown?.kind === "reset"
            ? "Their current password stops working and they are signed out everywhere. You'll get a new temporary password to hand over."
            : shown?.kind === "disable"
              ? "They are signed out at once and can't sign in again until you enable the account. Their past work and audit trail stay."
              : "They can sign in again with their existing password."
        }
        confirmLabel={shown?.kind === "reset" ? "Reset password" : shown?.kind === "disable" ? "Disable account" : "Enable account"}
        pendingLabel="Working…"
        onConfirm={async () => {
          if (!shown) return;
          const m = shown.member;
          if (shown.kind === "reset") {
            const res = await runAction(actions.resetPassword(m.id));
            if (!res) return false;
            setCredentials({ title: "New temporary password", email: m.email, password: res.password });
          } else {
            const res = await runAction(actions.setDisabled(m.id, shown.kind === "disable"), {
              success: shown.kind === "disable" ? `${m.name} can no longer sign in` : `${m.name} can sign in again`,
            });
            if (res === undefined) return false;
          }
          router.refresh();
        }}
      />
    </>
  );
}

function InviteDialog({
  open,
  onOpenChange,
  invite,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invite: TeamActions["invite"];
  onCreated: (c: { email: string; password: string }) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("agent");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await runAction(invite({ name, email, role }));
      if (res) {
        setName("");
        setEmail("");
        setRole("agent");
        onCreated(res);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="gap-5 rounded-2xl p-6 sm:max-w-lg">
        <DialogHeader className="gap-1.5">
          <DialogTitle className="text-[1.05rem] font-semibold tracking-[-0.01em]">Add a team member</DialogTitle>
          <DialogDescription>We create the account with a temporary password. You share it with them — and the private admin link.</DialogDescription>
        </DialogHeader>
        <form id="invite-form" onSubmit={submit} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name">
              {(fp) => <TextInput {...fp} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required autoComplete="off" placeholder="Salma" />}
            </Field>
            <Field label="Email">
              {(fp) => <TextInput {...fp} type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={191} required autoComplete="off" placeholder="salma@store.ma" />}
            </Field>
          </div>
          <fieldset className="grid gap-2">
            <legend className="mb-1.5 text-sm font-medium">Role</legend>
            <div role="radiogroup" aria-label="Role" className="grid gap-2">
              {ROLES.map((r) => {
                const info = ROLE_INFO[r];
                const selected = role === r;
                return (
                  <button
                    key={r}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setRole(r)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl p-3 text-start ring-1 transition-[box-shadow,background-color] duration-200 ring-inset outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      selected ? "bg-brand/[0.06] ring-brand/45" : "ring-foreground/10 hover:ring-foreground/20",
                    )}
                  >
                    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", selected ? "bg-brand text-brand-foreground" : "bg-foreground/[0.06]")}>
                      <info.icon className="size-4" />
                    </span>
                    <span className="grid flex-1 gap-0.5">
                      <span className="text-sm font-medium">{ROLE_LABELS[r]}</span>
                      <span className="text-xs text-muted-foreground">{info.text}</span>
                    </span>
                    <span className={cn("flex size-5 items-center justify-center rounded-full transition-all", selected ? "scale-100 bg-brand text-brand-foreground" : "scale-75 opacity-0")}>
                      <CheckIcon className="size-3" strokeWidth={3} />
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        </form>
        <DialogFooter>
          <Button variant="ghost" className="rounded-full" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="invite-form" className="rounded-full px-4" disabled={saving || !name.trim() || !email.trim()}>
            {saving ? <Loader2Icon className="animate-spin" /> : <UserPlusIcon />}
            Create account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** One-time display of a temporary password (never retrievable later). */
function CredentialsDialog({ credentials, onClose }: { credentials: { title: string; email: string; password: string } | null; onClose: () => void }) {
  return (
    <Dialog open={credentials !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-5 rounded-2xl p-6 sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader className="gap-1.5">
          <DialogTitle className="text-[1.05rem] font-semibold tracking-[-0.01em]">{credentials?.title}</DialogTitle>
          <DialogDescription>Shown once. Send it privately; they should change it in Settings → Security after signing in.</DialogDescription>
        </DialogHeader>
        {credentials && (
          <dl className="grid gap-2 rounded-2xl bg-foreground/[0.03] p-4 ring-1 ring-foreground/[0.07] ring-inset">
            <div className="flex items-center justify-between gap-3">
              <div className="grid min-w-0">
                <dt className="text-xs text-muted-foreground">Email</dt>
                <dd className="truncate text-sm font-medium">{credentials.email}</dd>
              </div>
              <CopyButton value={credentials.email} label="Copy email" />
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-foreground/[0.07] pt-2">
              <div className="grid min-w-0">
                <dt className="text-xs text-muted-foreground">Temporary password</dt>
                <dd className="font-mono text-[0.95rem] font-semibold tracking-wide select-all">{credentials.password}</dd>
              </div>
              <CopyButton value={credentials.password} label="Copy password" toastMessage="Password copied" />
            </div>
          </dl>
        )}
        <DialogFooter>
          <CopyButton
            value={credentials ? `Email: ${credentials.email}\nTemporary password: ${credentials.password}` : ""}
            label="Copy both"
            size="default"
            variant="outline"
            className="rounded-full"
          />
          <Button className="rounded-full px-4" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
