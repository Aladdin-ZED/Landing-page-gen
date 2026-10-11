/**
 * Markets public API (isomorphic).
 *  - ./info  — specs, cities, money/number formatting. Light: safe for browser bundles
 *              (admin preview, landing renderer). Import "@/lib/markets/info" from client code.
 *  - ./phone — phone validation with libphonenumber "max" metadata (~145 KB): server-side truth.
 * This index re-exports both for server code.
 */
export type { City, MarketSpec, MoneySpec, NormalizedPhone, PhoneSpec } from "./types";
export {
  cityLabel,
  cityOptions,
  findCity,
  formatMoney,
  formatNumber,
  getMarket,
  marketInfoForLocale,
  marketName,
  moneySpec,
  numberLocale,
  phoneSpec,
} from "./info";
export { normalizePhone, phoneToNational, toAsciiDigits, callingPrefix } from "./phone";
export { MA_CITIES, OTHER_CITY } from "./cities-ma";
export { MARKET_SPECS, PHONE_SPECS } from "./specs";
