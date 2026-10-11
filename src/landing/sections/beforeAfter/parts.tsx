/**
 * Pieces shared by the three before/after compositions: heading, the moment tag (label over
 * time), the photo of a moment (graded sample or the customer's photo, untouched), result points,
 * the credit line and the foot (honesty note + optional order button).
 */
import type { ReactNode } from "react";
import {
  Cta,
  Icon,
  Picture,
  RichText,
  SectionHeader,
  cx,
  editAttr,
  reveal,
  type PictureFrame,
} from "@/landing/primitives";
import type { RenderContext } from "../../types";
import { initials, splitCredit, ui, type Data, type Shot } from "./model";

interface Base {
  ctx: RenderContext;
  data: Data;
}

export function Head({
  ctx,
  data,
  titleId,
  align = "start",
}: Base & { titleId: string; align?: "start" | "split" }) {
  return (
    <SectionHeader
      ctx={ctx}
      kicker={data.kicker}
      title={data.title}
      lead={data.lead}
      editBase=""
      titleId={titleId}
      align={align}
      size="m"
      className="lp-beforeAfter__head"
    />
  );
}

/** Above this many characters (label + time) a `tight` tag keeps its label only. */
const TIGHT_CHARS = 22;

/**
 * Moment tag — "Avant" over "Jour 1": the label in the label face, the time small in tabular
 * figures. `look`: glass (smoked frosted card over a photo) or solid (accent, the after card).
 * `tight` (two tags sharing one frame, the time repeated beside it): a long label drops its time.
 */
export function Tag({
  ctx,
  shot,
  look = "glass",
  tight = false,
}: {
  ctx: RenderContext;
  shot: Shot;
  look?: "glass" | "solid";
  tight?: boolean;
}) {
  const when =
    tight && shot.label && shot.label.length + shot.when.length > TIGHT_CHARS
      ? ""
      : shot.when;
  if (!shot.label && !when) return null;
  return (
    <span
      className="lp-beforeAfter__tag"
      data-look={look}
      data-side={shot.side}
      {...(look === "glass" ? { "data-bg": "dark" } : {})}
    >
      {shot.label ? (
        <span
          className="lp-beforeAfter__tagl"
          {...editAttr(ctx, `${shot.path}.label`)}
        >
          {shot.label}
        </span>
      ) : null}
      {/* stacked visually; read as "Avant, Jour 1" */}
      {shot.label && when ? (
        <span className="lp-visually-hidden">, </span>
      ) : null}
      {/* RichText: a time like "Jours 1–3" keeps its order on Arabic pages */}
      {when ? (
        <RichText
          as="span"
          className="lp-beforeAfter__tagw"
          text={when}
          ctx={ctx}
          decorate={false}
          editPath={`${shot.path}.when`}
        />
      ) : null}
    </span>
  );
}

/**
 * The photo of one moment. A graded stand-in (sample) carries data-grade so CSS mutes it; a
 * moment with no photo at all renders its caption as a quiet note card instead.
 */
export function Media({
  ctx,
  shot,
  sizes,
  frame,
  className,
  children,
}: {
  ctx: RenderContext;
  shot: Shot;
  sizes: string;
  /** the exact frame the photo is shown in (subject-aware crop: faces and hands whole) */
  frame?: PictureFrame;
  className?: string;
  children?: ReactNode;
}) {
  if (!shot.asset) {
    return (
      <div
        className={cx(
          "lp-beforeAfter__media",
          "lp-beforeAfter__media--type",
          className,
        )}
        data-side={shot.side}
      >
        {shot.caption ? (
          <RichText
            as="p"
            className="lp-beforeAfter__typecap"
            text={shot.caption}
            ctx={ctx}
            decorate={false}
            editPath={`${shot.path}.caption`}
          />
        ) : null}
        {children}
      </div>
    );
  }
  return (
    <div
      className={cx("lp-beforeAfter__media", className)}
      data-side={shot.side}
      data-grade={shot.grade}
    >
      <Picture
        asset={shot.asset}
        sizes={sizes}
        alt={shot.alt}
        fit={shot.asset.alpha ? "contain" : "cover"}
        frame={shot.asset.alpha ? undefined : frame}
        className="lp-beforeAfter__pic"
      />
      {children}
    </div>
  );
}

/** Caption of a moment (what you see), editable in place. */
export function Caption({ ctx, shot }: { ctx: RenderContext; shot: Shot }) {
  if (!shot.caption) return null;
  return (
    <RichText
      as="p"
      className="lp-beforeAfter__cap"
      text={shot.caption}
      ctx={ctx}
      decorate={false}
      editPath={`${shot.path}.caption`}
    />
  );
}

/** Result points — a check in a small accent disc + a short phrase, rising one after another. */
export function Results({ ctx, data }: Base) {
  const items = data.results.filter((r) => r.text.trim());
  if (!items.length) return null;
  return (
    <ul
      className="lp-beforeAfter__results"
      role="list"
      aria-label={ui(ctx).results}
      data-stagger="80"
    >
      {items.map((r, i) => (
        <li key={i} className="lp-beforeAfter__result" {...reveal("rise")}>
          <span className="lp-beforeAfter__check" aria-hidden="true">
            <Icon name="check" size="1em" strokeWidth={2.4} />
          </span>
          <RichText
            as="span"
            text={r.text}
            ctx={ctx}
            decorate={false}
            editPath={`results.${i}.text`}
          />
        </li>
      ))}
    </ul>
  );
}

/**
 * Credit — an initials disc beside two lines: a quiet "Photos de" over the name, the city softer
 * ("Salma B. · Casablanca"). Read as one phrase: "Photos de Salma B. · Casablanca".
 */
export function Credit({ ctx, data }: Base) {
  const who = data.who.trim();
  if (!who) return null;
  const { name, place } = splitCredit(who);
  return (
    <p className="lp-beforeAfter__who">
      <span className="lp-beforeAfter__avatar" aria-hidden="true">
        {initials(who)}
      </span>
      <span className="lp-beforeAfter__whob">
        <span className="lp-beforeAfter__whol">{ui(ctx).credit} </span>
        <span className="lp-beforeAfter__whot" {...editAttr(ctx, "who")}>
          <span className="lp-beforeAfter__whon">{name}</span>
          {place ? (
            <span className="lp-beforeAfter__whop"> · {place}</span>
          ) : null}
        </span>
      </span>
    </p>
  );
}

/** Honesty note + optional order button. */
export function Foot({ ctx, data }: Base) {
  const note = data.note.trim();
  if (!note && !data.cta) return null;
  return (
    <div className="lp-beforeAfter__foot">
      {note ? (
        <p className="lp-beforeAfter__note" {...reveal("fade", 200)}>
          <Icon name="info" size="1.05em" />
          <RichText as="span" text={note} ctx={ctx} decorate={false} editPath="note" />
        </p>
      ) : null}
      {data.cta ? (
        <div className="lp-beforeAfter__cta" {...reveal("rise", 240)}>
          <Cta
            ctx={ctx}
            label={data.ctaLabel || undefined}
            editPath="ctaLabel"
          />
        </div>
      ) : null}
    </div>
  );
}
