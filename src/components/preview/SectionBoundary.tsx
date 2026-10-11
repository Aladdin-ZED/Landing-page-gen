"use client";
/**
 * Per-section error boundary for the admin preview: a section that throws while rendering is
 * replaced by a selectable placeholder instead of blanking the whole preview. Resets when the
 * section's data changes (resetKey).
 */
import { Component, type ReactNode } from "react";
import type { SectionBg } from "@/lib/page/schema";

/** Error note used as the content of a section whose render() threw (the page wrapper keeps data-sid). */
export function SectionErrorNote({ label, message }: { label: string; message: string }) {
  return (
    <div className="lp-container">
      <p className="lpx-error" role="alert">
        {`"${label}" could not be displayed: ${message}`}
      </p>
    </div>
  );
}

/** Whole placeholder section (boundary fallback replaces the section root, so it carries data-sid itself). */
export function SectionErrorBlock({ sectionId, label, bg, message }: { sectionId: string; label: string; bg: SectionBg; message: string }) {
  return (
    <section className="lp-section" data-sid={sectionId} data-bg={bg} data-space="tight">
      <SectionErrorNote label={label} message={message} />
    </section>
  );
}

interface Props {
  sectionId: string;
  label: string;
  bg: SectionBg;
  resetKey: string;
  children: ReactNode;
}

interface State {
  message: string | null;
}

export class SectionBoundary extends Component<Props, State> {
  state: State = { message: null };

  static getDerivedStateFromError(error: unknown): State {
    return { message: error instanceof Error ? error.message : "render error" };
  }

  componentDidUpdate(prev: Props) {
    if (this.state.message !== null && prev.resetKey !== this.props.resetKey) this.setState({ message: null });
  }

  render() {
    if (this.state.message !== null) {
      return <SectionErrorBlock sectionId={this.props.sectionId} label={this.props.label} bg={this.props.bg} message={this.state.message} />;
    }
    return this.props.children;
  }
}

/** Last-resort boundary around the whole frame body: reports DOM/reconciliation crashes so the frame can remount. */
export class FrameBoundary extends Component<{ onCrash: (error: unknown) => void; children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false };

  static getDerivedStateFromError(): { crashed: boolean } {
    return { crashed: true };
  }

  componentDidCatch(error: unknown) {
    this.props.onCrash(error);
  }

  render() {
    return this.state.crashed ? null : this.props.children;
  }
}
