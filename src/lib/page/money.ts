/**
 * Money helpers with no dependencies (the landing runtime bundle imports them; pricing.ts re-exports
 * them). Money in documents has ≤ 2 decimals; prices are computed in integer cents.
 */

export type Cents = number;
/** Money (≤ 2 decimals) → integer cents. */
export const toCents = (m: number): Cents => Math.round(m * 100);
/** Integer cents → money, once, for display and storage. */
export const fromCents = (c: Cents): number => c / 100;
/** Money rounded to 2 decimals (legacy helper; prices are computed in cents). */
export const round2 = (n: number) => Math.round(n * 100) / 100;
