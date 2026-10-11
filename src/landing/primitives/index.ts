/**
 * Landing primitives — the shared building blocks of every section (API: ./README.md).
 * All components are pure (props → JSX): no hooks, context, browser globals, Date or randomness.
 * Styling lives in src/landing/styles/base.css (classes prefixed `lp-`), driven by theme tokens
 * and the html data-attributes produced by the theme engine (docs/DESIGN.md §2.5: data-arch,
 * data-btn, data-card, data-emphasis, data-mask, data-glyph, data-texture, data-radius,
 * data-shadow, data-surfaces, data-motion, data-base, data-density).
 */

/* helpers */
export {
  cx,
  editAttr,
  joinPath,
  cssVars,
  reveal,
  REVEAL_KINDS,
  ROTATION_RANGE,
  seededRotation,
  safeHex,
  safePosition,
  safeRatio,
  round,
  clamp,
  pad2,
  brandName,
  isPlaceholderStoreName,
} from "./util";
export type { ClassValue, RevealKind, RevealAttrs } from "./util";

/* text */
export { RichText } from "./RichText";
export type { RichTextProps, TextTag } from "./RichText";
export { parseInline, parseBlocks, inlineText, plainText } from "./markup";
export type { InlineNode, BlockNode } from "./markup";
export { SectionHeader, TITLE_REVEAL } from "./SectionHeader";
export type { SectionHeaderProps } from "./SectionHeader";
export { Kicker, Eyebrow } from "./Kicker";
export type { KickerProps, EyebrowProps } from "./Kicker";

/* media */
export { Picture, pictureCrop, frameRegions, quietCorner, cropSubjectOf } from "./Picture";
export type { PictureProps, MaskKind, PictureFrame, FrameRegions, Corner } from "./Picture";
export { ProductStage, resolveProductVisual, STAGES } from "./ProductStage";
export type { ProductStageProps, StageKind, VisualKind } from "./ProductStage";

/* commerce */
export { Cta, LinkButton, safeHref } from "./Cta";
export type { CtaProps, CtaVariant } from "./Cta";
export { Price, Money, moneyParts, savingsOf, savingsLabel } from "./Price";
export type { PriceProps, MoneyParts } from "./Price";
export { Stars } from "./Stars";
export type { StarsProps } from "./Stars";
export { Badge, Chip, Sticker } from "./Badge";
export type { Tone, StickerShape, StickerProps } from "./Badge";
export { TrustRow, defaultTrustItems } from "./TrustRow";
export type { TrustRowProps, TrustItem } from "./TrustRow";
export { Counter } from "./Counter";
export type { CounterProps } from "./Counter";
export { Countdown, isoToMs } from "./Countdown";
export type { CountdownProps } from "./Countdown";

/* motion & layout */
export { MarqueeTrack } from "./MarqueeTrack";
export type { MarqueeTrackProps } from "./MarqueeTrack";
export { Container, SectionShell, SkipLink } from "./layout";
export type { ContainerProps, SectionShellProps, SectionSpace, SkipLinkProps } from "./layout";

/* icons & ornaments */
export { Icon } from "./Icon";
export type { IconProps } from "./Icon";
export { ICONS, ICON_NAMES, isIconName } from "./icons";
export type { IconName } from "./icons";
export { Ornament } from "./Ornament";
export type { OrnamentProps } from "./Ornament";
export { ORNAMENTS, ORNAMENT_KINDS, ORNAMENT_BY_ARCHETYPE, STAR_BY_ARCHETYPE } from "./shapes";
export type { OrnamentKind, StarKind } from "./shapes";

/* form */
export {
  FieldShell,
  Input,
  PhoneInput,
  Select,
  Textarea,
  Radio,
  Checkbox,
  Honeypot,
  fieldIds,
  describedBy,
} from "./form";
export type {
  FieldName,
  FieldShellProps,
  InputProps,
  PhoneInputProps,
  SelectProps,
  TextareaProps,
  ChoiceProps,
} from "./form";
