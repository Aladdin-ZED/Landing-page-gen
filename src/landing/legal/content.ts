/**
 * Legal document texts — privacy policy, terms of sale, shipping & returns, contact — in ar / fr / en,
 * built from the store identity (Settings → Store) and the page (market, currency, form fields,
 * delivery fee, ad pixels actually configured).
 *
 * Careful templates, not legal advice:
 *  - Morocco (market MA): loi n° 09-08 (personal data, CNDP) and loi n° 31-08 (consumer protection:
 *    7-day withdrawal right for distance sales), cash on delivery.
 *  - EU markets: GDPR and the 14-day withdrawal right; other markets: neutral wording.
 *  - Nothing is invented: missing company details (legal name, address, ICE, RC…) become visible
 *    gaps (`ph`) the merchant must complete in Settings → Store; no registration number is ever made up.
 */
import type { PageLinks, RenderContext, StoreContext } from "../types";
import { b, callout, link, list, p, ph, type Block, type Inline, type LegalChrome, type LegalKind, type LegalSection, type LegalText } from "./model";

export type LegalLang = "ar" | "fr" | "en";
type Regime = "MA" | "EU" | "INTL";

const EU_MARKETS = new Set(["FR", "BE", "ES", "DE", "IT", "NL", "PT"]);

interface Facts {
  regime: Regime;
  store: StoreContext;
  product: string;
  currency: string;
  /** delivery fee per order (0 = free) and its formatted amount */
  fee: number;
  feeText: string;
  /** delivery promise as written on the page ("Livraison 24–48h partout au Maroc") */
  delivery: string;
  /** names of the ad / analytics pixels configured on the page */
  pixels: string[];
  /** platforms among them that can also receive server events (Meta, TikTok): hashed contact data */
  serverPlatforms: string[];
  fields: { city: boolean; citySelect: boolean; address: boolean; note: boolean; email: boolean };
  links: PageLinks;
}

/** Page language → legal text language (other locales read the English text). */
export const legalLang = (locale: string): LegalLang => (locale === "ar" || locale === "fr" ? locale : "en");

/* ------------------------------------------------------------------ */
/* Contact channels (built from validated store data only)             */
/* ------------------------------------------------------------------ */

const NBSP = String.fromCharCode(0xa0);

/** "+212 6 12 34 56 78" for Moroccan numbers (no-break spaces: a number never wraps), "+<digits>" otherwise. */
export function displayWhatsapp(digits: string): string {
  const m = /^212([5-7])(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(digits);
  return m ? ["+212", m[1], m[2], m[3], m[4], m[5]].join(NBSP) : `+${digits}`;
}

/** A store phone for reading: Moroccan numbers grouped like WhatsApp ones, anything else as typed. */
export function displayPhone(phone: string): string {
  const compact = phone.replace(/[\s().-]/g, "");
  const intl = compact.startsWith("+") ? compact.slice(1) : compact.startsWith("00") ? compact.slice(2) : null;
  return intl && /^212[5-7]\d{8}$/.test(intl) ? displayWhatsapp(intl) : phone;
}

export const whatsappHref = (digits: string) => `https://wa.me/${digits}`;
export const telHref = (phone: string) => `tel:${phone.replace(/(?!^\+)[^0-9]/g, "")}`;
export const mailHref = (email: string) => `mailto:${email}`;

interface Channel {
  key: "whatsapp" | "phone" | "email";
  text: string;
  href: string;
  external: boolean;
}

export function contactChannels(store: StoreContext): Channel[] {
  const out: Channel[] = [];
  if (store.whatsapp) out.push({ key: "whatsapp", text: displayWhatsapp(store.whatsapp), href: whatsappHref(store.whatsapp), external: true });
  if (store.phone) out.push({ key: "phone", text: displayPhone(store.phone), href: telHref(store.phone), external: false });
  if (store.email) out.push({ key: "email", text: store.email, href: mailHref(store.email), external: false });
  return out;
}

/** "WhatsApp +212 6…, phone 05… or e-mail x@y" — or a gap when the store has no contact at all. */
function contactLine(f: Facts, lang: LegalLang, words: { whatsapp: string; phone: string; email: string; or: string; missing: string }): Inline[] {
  const chans = contactChannels(f.store);
  if (!chans.length) return [ph(words.missing)];
  const out: Inline[] = [];
  chans.forEach((c, i) => {
    if (i > 0) out.push(i === chans.length - 1 ? ` ${words.or} ` : LIST[lang].sep);
    out.push(`${words[c.key]} `, link(c.text, c.href, c.external));
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* Identity ledger                                                     */
/* ------------------------------------------------------------------ */

interface IdentityWords {
  name: string;
  legalName: string;
  address: string;
  ice: string;
  rc: string;
  registration: string;
  phone: string;
  whatsapp: string;
  email: string;
  phLegalName: string;
  phAddress: string;
  phIce: string;
  phRc: string;
  phRegistration: string;
  phEmail: string;
}

function identity(f: Facts, w: IdentityWords): Block {
  const s = f.store;
  const rows: { label: string; value: Inline[] }[] = [
    { label: w.name, value: [s.name] },
    { label: w.legalName, value: [s.legalName ? s.legalName : ph(w.phLegalName)] },
    { label: w.address, value: [s.address ? [s.address, s.city].filter(Boolean).join(", ") : ph(w.phAddress)] },
  ];
  if (f.regime === "MA") {
    rows.push({ label: w.ice, value: [s.ice ? s.ice : ph(w.phIce)] });
    rows.push({ label: w.rc, value: [s.rc ? s.rc : ph(w.phRc)] });
  } else if (f.regime === "EU") {
    rows.push({ label: w.registration, value: [ph(w.phRegistration)] });
  }
  if (s.whatsapp) rows.push({ label: w.whatsapp, value: [link(displayWhatsapp(s.whatsapp), whatsappHref(s.whatsapp), true)] });
  if (s.phone) rows.push({ label: w.phone, value: [link(displayPhone(s.phone), telHref(s.phone))] });
  rows.push({ label: w.email, value: [s.email ? link(s.email, mailHref(s.email)) : ph(w.phEmail)] });
  return { kind: "facts", rows };
}

/** List punctuation per language: Arabic uses its own comma and attaches "و" to the next word. */
const LIST: Record<LegalLang, { sep: string; and: string }> = {
  fr: { sep: ", ", and: " et " },
  en: { sep: ", ", and: " and " },
  ar: { sep: "، ", and: " و" },
};

/** first character in the Arabic block (U+0600–U+06FF) */
const ARABIC_START = /^[؀-ۿ]/;

/** Join list items with commas and a final conjunction ("a, b et c" · "أ، ب وج"; "و" stays apart from a Latin name). */
function enumerate(items: string[], lang: LegalLang): string {
  if (items.length <= 1) return items.join("");
  const last = items[items.length - 1]!;
  const and = lang === "ar" && !ARABIC_START.test(last) ? " و " : LIST[lang].and;
  return items.slice(0, -1).join(LIST[lang].sep) + and + last;
}

const sec = (id: string, title: string, ...blocks: (Block | null | false)[]): LegalSection => ({
  id,
  title,
  blocks: blocks.filter((x): x is Block => !!x),
});

/* ------------------------------------------------------------------ */
/* Français                                                            */
/* ------------------------------------------------------------------ */

function fr(f: Facts): Record<LegalKind, LegalText> {
  const MA = f.regime === "MA";
  const EU = f.regime === "EU";
  const s = f.store;
  const contact = contactLine(f, "fr", { whatsapp: "sur WhatsApp au", phone: "par téléphone au", email: "par e-mail à", or: "ou", missing: "moyen de contact du service client" });
  const ident = identity(f, {
    name: "Nom commercial",
    legalName: "Raison sociale",
    address: "Adresse",
    ice: "ICE",
    rc: "Registre du commerce",
    registration: "Immatriculation",
    phone: "Téléphone",
    whatsapp: "WhatsApp",
    email: "E-mail",
    phLegalName: "raison sociale",
    phAddress: "adresse du siège",
    phIce: "ICE (15 chiffres)",
    phRc: "numéro et ville du RC",
    phRegistration: "numéro d'immatriculation et de TVA",
    phEmail: "e-mail de contact",
  });
  const currency = f.currency === "MAD" ? "dirhams marocains (MAD)" : f.currency === "EUR" ? "euros (EUR)" : f.currency;
  const fields = [
    "nom complet",
    "numéro de téléphone",
    ...(f.fields.city ? ["ville"] : []),
    ...(f.fields.address ? ["adresse de livraison"] : []),
    ...(f.fields.email ? ["adresse e-mail"] : []),
  ];
  const days = MA ? "7 jours" : EU ? "14 jours" : null;
  const feeLine: Inline[] = f.fee > 0
    ? ["Des frais de livraison de ", b(f.feeText), " par commande s'ajoutent au prix des produits ; ils figurent dans le récapitulatif du formulaire, avant la confirmation."]
    : [b("La livraison est offerte"), ", quel que soit le pack choisi."];

  const privacy: LegalText = {
    kind: "privacy",
    title: "Politique de confidentialité",
    summary: [
      ["Nous ne demandons que le nécessaire pour livrer votre commande : ", b(enumerate(fields, "fr")), "."],
      ["Vos données ne sont jamais vendues. Elles sont transmises au livreur pour la livraison", f.pixels.length ? " et, pour la mesure de nos publicités, aux plateformes listées plus bas." : "."],
      ["Vous pouvez à tout moment demander l'accès, la rectification ou la suppression de vos données", MA ? " (loi n° 09-08)." : "."],
    ],
    sections: [
      sec("controller", "Qui est responsable de vos données", p("Le responsable du traitement de vos données est la boutique ", b(s.name), ", identifiée ci-dessous."), ident),
      sec(
        "data",
        "Les données que nous collectons",
        p("Lorsque vous commandez avec le formulaire de cette page :"),
        list(
          [b("Contact"), " : nom complet, numéro de téléphone", f.fields.email ? ", adresse e-mail ;" : " ;"],
          ...(f.fields.city || f.fields.address
            ? [[b("Livraison"), " : ", enumerate([...(f.fields.city ? ["ville"] : []), ...(f.fields.address ? ["adresse"] : []), ...(f.fields.note ? ["remarque éventuelle pour le livreur"] : [])], "fr"), " ;"] as Inline[]]
            : []),
          [b("Commande"), " : produit, pack et options choisis, montant, date et heure."],
        ),
        p("Automatiquement, lors de votre visite :"),
        list(
          ["des données techniques : type d'appareil et de navigateur, page de provenance, paramètres de campagne présents dans le lien ;"],
          ["votre adresse IP, enregistrée sous une forme chiffrée irréversible, pour lutter contre les fausses commandes et les abus ;"],
          ["un identifiant de visite anonyme, pour les statistiques de fréquentation de la page."],
        ),
        callout("cash-hand", "Aucune donnée bancaire n'est collectée : ", b("vous payez en espèces à la livraison"), "."),
      ),
      sec(
        "purposes",
        "Pourquoi nous les utilisons",
        list(
          ["traiter votre commande, vous appeler ou vous écrire sur WhatsApp pour la confirmer, et organiser la livraison ;"],
          ["assurer le service client, les échanges et les retours ;"],
          ["prévenir la fraude et les fausses commandes ;"],
          [f.pixels.length ? "mesurer la fréquentation de la page et l'efficacité de nos publicités." : "mesurer la fréquentation de la page et améliorer nos offres."],
        ),
        MA
          ? p("Ces traitements reposent sur votre consentement, donné lorsque vous envoyez le formulaire, et sur la nécessité d'exécuter la commande que vous passez.")
          : EU
            ? p("Ces traitements reposent sur l'exécution de votre commande (article 6.1.b du RGPD), sur notre intérêt légitime à prévenir la fraude et, pour la mesure publicitaire, sur votre consentement.")
            : p("Ces traitements reposent sur l'exécution de la commande que vous passez et sur notre intérêt légitime à prévenir la fraude."),
      ),
      sec(
        "recipients",
        "Qui peut y accéder",
        list(
          ["l'équipe de la boutique, pour la confirmation et le suivi des commandes ;"],
          ["la société de livraison, qui reçoit uniquement ce qui est nécessaire à la livraison : nom, téléphone, ville, adresse et montant à encaisser ;"],
          ["nos prestataires techniques (hébergement du site, outils de gestion des commandes), qui agissent sur nos instructions", f.pixels.length ? " ;" : "."],
          ...(f.pixels.length ? [["les plateformes publicitaires citées dans « Cookies et traceurs », pour les seules informations qui y sont décrites."] as Inline[]] : []),
        ),
        p("Vos données ne sont jamais vendues ni louées.", MA ? " Certains prestataires techniques peuvent être situés hors du Maroc." : EU ? " Si un prestataire est situé hors de l'Union européenne, le transfert est encadré par les garanties prévues par le RGPD." : ""),
      ),
      sec(
        "retention",
        "Combien de temps nous les gardons",
        p("Les données de commande sont conservées le temps nécessaire au traitement de la commande, au service après-vente et aux éventuelles réclamations, puis archivées pendant la durée imposée par nos obligations légales, comptables et fiscales. Les données techniques de lutte contre la fraude sont conservées pour une durée limitée."),
      ),
      sec(
        "cookies",
        "Cookies et traceurs",
        p("La page utilise le stockage de votre navigateur pour mémoriser votre commande en cours (afin d'afficher la page de confirmation) et un identifiant de visite anonyme pour les statistiques."),
        f.pixels.length
          ? p("Pour mesurer nos publicités, la page charge également : ", b(enumerate(f.pixels, "fr")), ". Ces services peuvent déposer leurs propres cookies et recevoir des informations sur votre visite et votre commande (produit, montant), selon leurs propres politiques de confidentialité.")
          : p("Aucun pixel publicitaire tiers n'est utilisé sur cette page."),
        f.serverPlatforms.length > 0 &&
          p(
            "Quand vous passez commande, notre serveur peut aussi confirmer l'achat directement à ",
            b(enumerate(f.serverPlatforms, "fr")),
            " pour mesurer nos publicités. Votre numéro de téléphone et votre nom (ainsi que votre e-mail et votre ville si vous les indiquez) ne leur sont jamais envoyés en clair : seule une empreinte irréversible (hachage SHA-256) est transmise, avec l'adresse IP et le type de navigateur utilisés pour la commande.",
          ),
        p("Vous pouvez effacer ces données à tout moment depuis les réglages de votre navigateur."),
      ),
      sec(
        "security",
        "Sécurité",
        p("La page est servie de manière chiffrée (HTTPS). L'accès aux commandes est réservé aux personnes habilitées de la boutique."),
      ),
      sec(
        "rights",
        "Vos droits",
        MA
          ? p("Conformément à la ", b("loi n° 09-08"), " relative à la protection des personnes physiques à l'égard du traitement des données à caractère personnel, vous disposez d'un droit d'accès, de rectification et d'opposition, pour des motifs légitimes, au traitement de vos données. Vous pouvez aussi demander leur suppression.")
          : EU
            ? p("Conformément au ", b("RGPD"), ", vous disposez d'un droit d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité de vos données, et vous pouvez retirer votre consentement à tout moment.")
            : p("Vous pouvez demander l'accès à vos données, leur rectification ou leur suppression."),
        p("Pour exercer ces droits, contactez-nous ", ...contact, ", en indiquant le numéro de téléphone utilisé pour commander."),
        MA
          ? p("Si vous estimez que vos droits ne sont pas respectés, vous pouvez saisir la Commission nationale de contrôle de la protection des données à caractère personnel (CNDP) : ", link("www.cndp.ma", "https://www.cndp.ma", true), ".")
          : EU
            ? p("Vous pouvez aussi introduire une réclamation auprès de l'autorité de protection des données de votre pays (en France : la CNIL, ", link("www.cnil.fr", "https://www.cnil.fr", true), ").")
            : null,
      ),
      sec("changes", "Mises à jour", p("Cette politique peut évoluer avec nos pratiques ou la loi. La date de la dernière mise à jour figure en haut de cette page.")),
    ],
  };

  const terms: LegalText = {
    kind: "terms",
    title: "Conditions générales de vente",
    summary: [
      ["Commande en 30 secondes, sans compte, et ", b("paiement en espèces à la livraison"), "."],
      ["Nous vous appelons pour confirmer avant d'expédier."],
      days ? ["Vous disposez de ", b(days), " après réception pour changer d'avis", MA ? " (loi n° 31-08)." : "."] : ["Vous pouvez changer d'avis après réception, dans les conditions décrites ci-dessous."],
    ],
    sections: [
      sec("seller", "Le vendeur", p("Les présentes conditions régissent les ventes conclues sur cette page entre la boutique ", b(s.name), " et toute personne qui y passe commande (« le client »)."), ident),
      sec(
        "scope",
        "Application",
        p("Toute commande implique l'acceptation des présentes conditions, consultables à tout moment depuis le bas de la page. Elles s'appliquent aux commandes livrées ", MA ? "au Maroc." : "dans les zones desservies par la boutique."),
      ),
      sec(
        "products",
        "Produits",
        p("Les caractéristiques essentielles du produit « ", b(f.product), " » sont présentées sur la page : description, photos, contenance ou dimensions, options. Les photos sont aussi fidèles que possible ; de légères différences de couleur peuvent exister selon les écrans."),
        p("Les offres sont valables dans la limite des stocks disponibles. Si un article devient indisponible après votre commande, nous vous prévenons et vous proposons un autre article ou l'annulation, sans frais."),
      ),
      sec(
        "prices",
        "Prix",
        p("Les prix sont indiqués en ", currency, ", toutes taxes comprises. ", ...feeLine),
        p("Le prix applicable est celui affiché au moment de la commande, y compris pour les packs et les offres à durée limitée. Un prix barré correspond au prix de référence des mêmes articles achetés à l'unité ou au prix pratiqué auparavant."),
      ),
      sec(
        "order",
        "Commande",
        list(
          ["Vous choisissez votre pack et vos options, puis remplissez le formulaire."],
          ["Un numéro de commande s'affiche sur la page de confirmation."],
          ["Nous vous appelons ou vous écrivons sur WhatsApp pour confirmer la commande et l'adresse : la commande est expédiée après cette confirmation."],
        ),
        p("Nous pouvons refuser ou annuler une commande manifestement fausse ou incomplète, ou passée de mauvaise foi (par exemple des commandes répétées jamais retirées)."),
      ),
      sec(
        "payment",
        "Paiement à la livraison",
        callout("cash-hand", "Le paiement s'effectue ", b("en espèces, au livreur, à la réception du colis"), ". Aucun paiement n'est demandé en ligne."),
        p("Vous pouvez vérifier votre colis à la réception, avant de payer. S'il est endommagé ou ne correspond pas à votre commande, vous pouvez le refuser sans rien payer."),
      ),
      sec("delivery", "Livraison", p("Les zones, délais et frais de livraison sont détaillés dans la page ", link("Livraison & retours", f.links.shipping), ".")),
      sec(
        "withdrawal",
        "Droit de rétractation",
        MA
          ? p("Conformément à la ", b("loi n° 31-08"), " édictant des mesures de protection du consommateur, vous disposez d'un délai de ", b("7 jours"), " à compter de la réception de votre commande pour exercer votre droit de rétractation, sans avoir à vous justifier ni à payer de pénalité, à l'exception des frais de retour.")
          : EU
            ? p("Conformément à la réglementation européenne sur les contrats à distance, vous disposez d'un délai de ", b("14 jours"), " à compter de la réception de votre commande pour vous rétracter, sans avoir à vous justifier. Les frais de retour restent à votre charge.")
            : p("Vous pouvez vous rétracter après réception de votre commande dans le délai prévu par la loi applicable ; les frais de retour restent à votre charge."),
        p("Pour l'exercer, contactez-nous ", ...contact, " en indiquant votre numéro de commande. Le produit doit être retourné complet, dans son état d'origine. ",
          MA
            ? "Nous vous remboursons les sommes versées sans délai, et au plus tard dans les 15 jours suivant l'exercice de votre droit de rétractation."
            : EU
              ? "Nous vous remboursons les sommes versées au plus tard 14 jours après votre rétractation ; nous pouvons attendre d'avoir reçu le produit en retour."
              : "Nous vous remboursons les sommes versées dans les délais prévus par la loi applicable.",
        ),
        p(
          "Ce droit ne s'applique pas, dans les cas prévus par la loi, aux produits confectionnés selon vos spécifications ou personnalisés, ni aux produits qui, du fait de leur nature, ne peuvent être réexpédiés ou sont susceptibles de se détériorer rapidement",
          EU ? ", ni aux produits d'hygiène ou cosmétiques descellés après la livraison." : ".",
        ),
      ),
      sec(
        "warranty",
        "Garanties",
        p("Les produits bénéficient de la garantie légale contre les défauts de la chose vendue. Si votre produit présente un défaut ou ne correspond pas à votre commande, contactez-nous avec une photo : nous l'échangeons ou vous remboursons, et les frais de retour sont à notre charge."),
      ),
      sec("data", "Données personnelles", p("Les informations du formulaire servent uniquement à traiter et livrer votre commande. Voir notre ", link("Politique de confidentialité", f.links.privacy), ".")),
      sec(
        "disputes",
        "Réclamations et droit applicable",
        p("Pour toute réclamation, contactez d'abord notre service client ", ...contact, " : nous recherchons une solution amiable dans les meilleurs délais."),
        MA
          ? p("Les présentes conditions sont soumises au droit marocain. À défaut d'accord amiable, le litige est porté devant les juridictions marocaines compétentes.")
          : EU
            ? p("Les présentes conditions sont soumises au droit du pays du vendeur, sans préjudice des dispositions protectrices du pays de résidence du consommateur. Vous pouvez recourir gratuitement à un médiateur de la consommation : ", ph("nom et site du médiateur"), ".")
            : p("À défaut d'accord amiable, le litige est porté devant les juridictions compétentes."),
      ),
    ],
  };

  const shipping: LegalText = {
    kind: "shipping",
    title: "Livraison & retours",
    summary: [
      [b(f.delivery)],
      f.fee > 0 ? ["Frais de livraison : ", b(f.feeText), " par commande."] : [b("Livraison offerte"), " sur toutes les commandes."],
      ["Paiement en espèces à la réception, ", b("après vérification du colis"), "."],
      days ? ["Échange ou retour possible pendant ", b(days), " après réception."] : ["Échange ou retour possible après réception, selon les conditions ci-dessous."],
    ],
    sections: [
      sec(
        "zones",
        "Où nous livrons",
        MA
          ? p(
              "Nous livrons dans toutes les villes du Maroc desservies par notre société de livraison.",
              f.fields.citySelect ? " Si votre ville n'apparaît pas dans la liste du formulaire, choisissez « Autre ville » et précisez votre localité dans l'adresse." : "",
            )
          : p("Nous livrons dans les zones desservies par notre société de livraison. En cas de doute, contactez-nous avant de commander."),
      ),
      sec(
        "times",
        "Délais",
        p("Délai indicatif : ", b(f.delivery), ". Il court à partir de la confirmation de votre commande par téléphone et peut être plus long pour les zones éloignées, les jours fériés ou en période de forte affluence ; nous vous prévenons en cas de retard."),
      ),
      sec("fees", "Frais de livraison", p(...feeLine)),
      sec(
        "steps",
        "Comment se passe la livraison",
        list(
          [b("Confirmation"), " — nous vous appelons ou vous écrivons sur WhatsApp pour confirmer la commande et l'adresse."],
          [b("Expédition"), " — votre colis est remis à notre société de livraison."],
          [b("Livraison"), " — le livreur vous appelle avant de passer : gardez votre téléphone à portée de main."],
          [b("Paiement"), " — vous vérifiez le colis, puis vous payez le livreur en espèces."],
        ),
        p("Si vous êtes absent ou injoignable, le livreur vous recontacte pour convenir d'un nouveau passage. Un colis non retiré après plusieurs tentatives nous est retourné et la commande est annulée."),
      ),
      sec("check", "À la réception", callout("shield-check", "Vérifiez l'état du colis et son contenu ", b("avant de payer"), ". S'il est endommagé, incomplet ou ne correspond pas à votre commande, vous pouvez le refuser : vous ne payez rien.")),
      sec(
        "returns",
        "Rétractation et retours",
        days
          ? p("Vous disposez de ", b(days), " à compter de la réception pour retourner un produit qui ne vous convient pas, sans justification", MA ? " (loi n° 31-08)" : "", ". Les frais de retour sont à votre charge, sauf produit défectueux ou erreur de notre part.")
          : p("Vous pouvez retourner un produit qui ne vous convient pas dans le délai prévu par la loi applicable. Les frais de retour sont à votre charge, sauf produit défectueux ou erreur de notre part."),
        list(
          ["Contactez-nous ", ...contact, " en indiquant votre numéro de commande."],
          ["Renvoyez le produit complet, dans son état et son emballage d'origine, selon les instructions que nous vous donnons."],
          ["Après réception et vérification du produit, nous vous remboursons par virement ou par un autre moyen convenu ensemble."],
        ),
        p("Voir aussi les exceptions prévues dans nos ", link("Conditions générales de vente", f.links.terms), "."),
      ),
      sec(
        "exchange",
        "Échanges",
        p("Une autre taille, une autre couleur ou un autre article ? Contactez-nous ", days ? `dans les ${days} suivant la réception` : "après réception", " : nous organisons l'échange selon les stocks disponibles. Les éventuels frais de réexpédition vous sont indiqués avant l'échange."),
      ),
      sec(
        "defects",
        "Produit défectueux ou erreur",
        p("Si vous recevez un produit défectueux ou différent de votre commande, signalez-le-nous dès que possible avec une photo. Nous le remplaçons ou vous remboursons, et les frais de retour sont à notre charge."),
      ),
    ],
  };

  const contactDoc: LegalText = {
    kind: "contact",
    title: "Contact",
    summary: [
      s.whatsapp ? ["Le plus rapide : ", b("écrivez-nous sur WhatsApp"), "."] : ["Une question sur un produit ou une commande ? Nous sommes là pour vous aider."],
      ["Pour une commande, indiquez votre numéro de commande et le téléphone utilisé."],
    ],
    sections: [
      sec("reach", "Nous joindre", p("Écrivez-nous ou appelez-nous ", ...contact, ".")),
      sec(
        "orders",
        "Suivi de commande",
        p("Après votre commande, nous vous appelons pour la confirmer. Pour toute question sur une livraison en cours, contactez-nous avec votre numéro de commande (affiché sur la page de confirmation) et le numéro de téléphone utilisé pour commander."),
      ),
      sec(
        "company",
        "Informations légales",
        ident,
        p("Consultez aussi notre ", link("Politique de confidentialité", f.links.privacy), ", nos ", link("Conditions générales de vente", f.links.terms), " et la page ", link("Livraison & retours", f.links.shipping), "."),
      ),
    ],
  };

  return { privacy, terms, shipping, contact: contactDoc };
}

/* ------------------------------------------------------------------ */
/* العربية                                                             */
/* ------------------------------------------------------------------ */

function ar(f: Facts): Record<LegalKind, LegalText> {
  const MA = f.regime === "MA";
  const EU = f.regime === "EU";
  const s = f.store;
  const contact = contactLine(f, "ar", { whatsapp: "عبر واتساب على الرقم", phone: "بالهاتف على الرقم", email: "بالبريد الإلكتروني على", or: "أو", missing: "وسيلة التواصل مع خدمة الزبناء" });
  const ident = identity(f, {
    name: "الاسم التجاري",
    legalName: "الاسم القانوني للشركة",
    address: "العنوان",
    ice: "المعرف الموحد للمقاولة (ICE)",
    rc: "السجل التجاري",
    registration: "رقم التسجيل",
    phone: "الهاتف",
    whatsapp: "واتساب",
    email: "البريد الإلكتروني",
    phLegalName: "الاسم القانوني للشركة",
    phAddress: "عنوان المقر",
    phIce: "المعرف الموحد للمقاولة (15 رقما)",
    phRc: "رقم السجل التجاري ومدينته",
    phRegistration: "رقم التسجيل ورقم الضريبة على القيمة المضافة",
    phEmail: "البريد الإلكتروني للتواصل",
  });
  const currency = f.currency === "MAD" ? "الدرهم المغربي" : f.currency === "EUR" ? "اليورو" : f.currency;
  const fields = [
    "الاسم الكامل",
    "رقم الهاتف",
    ...(f.fields.city ? ["المدينة"] : []),
    ...(f.fields.address ? ["عنوان التوصيل"] : []),
    ...(f.fields.email ? ["البريد الإلكتروني"] : []),
  ];
  const days = MA ? "7 أيام" : EU ? "14 يوما" : null;
  const feeLine: Inline[] = f.fee > 0
    ? ["تضاف إلى ثمن المنتجات مصاريف توصيل قدرها ", b(f.feeText), " عن كل طلب، وتظهر في ملخص الاستمارة قبل التأكيد."]
    : [b("التوصيل مجاني"), " مهما كان العرض الذي تختاره."];

  const privacy: LegalText = {
    kind: "privacy",
    title: "سياسة الخصوصية",
    summary: [
      ["لا نطلب منك إلا ما يلزم لتوصيل طلبك: ", b(enumerate(fields, "ar")), "."],
      ["لا نبيع معطياتك أبدا. نرسلها إلى عامل التوصيل لتسليم طلبك", f.pixels.length ? "، وإلى المنصات الإعلانية المذكورة أسفله لقياس أداء إعلاناتنا." : "."],
      ["يمكنك في أي وقت طلب الاطلاع على معطياتك أو تصحيحها أو حذفها", MA ? " (القانون رقم 09.08)." : "."],
    ],
    sections: [
      sec("controller", "المسؤول عن معطياتك", p("المسؤول عن معالجة معطياتك هو متجر ", b(s.name), "، وبياناته كالتالي:"), ident),
      sec(
        "data",
        "المعطيات التي نجمعها",
        p("عند الطلب عبر استمارة هذه الصفحة:"),
        list(
          [b("التواصل"), ": الاسم الكامل ورقم الهاتف", f.fields.email ? " والبريد الإلكتروني؛" : "؛"],
          ...(f.fields.city || f.fields.address
            ? [[b("التوصيل"), ": ", enumerate([...(f.fields.city ? ["المدينة"] : []), ...(f.fields.address ? ["العنوان"] : []), ...(f.fields.note ? ["ملاحظة لعامل التوصيل إن وجدت"] : [])], "ar"), "؛"] as Inline[]]
            : []),
          [b("الطلب"), ": المنتج والعرض والخيارات المختارة والمبلغ وتاريخ الطلب وساعته."],
        ),
        p("وتُجمع تلقائيا أثناء زيارتك:"),
        list(
          ["معطيات تقنية: نوع الجهاز والمتصفح، والصفحة التي أتيت منها، ومعايير الحملة الإعلانية الموجودة في الرابط؛"],
          ["عنوان IP الخاص بك، مسجلا بصيغة مشفرة لا يمكن استرجاعها، لمحاربة الطلبات الوهمية وأشكال الاحتيال؛"],
          ["معرّف زيارة مجهول الهوية، لإحصاء عدد زوار الصفحة."],
        ),
        callout("cash-hand", "لا نجمع أي معطيات بنكية: ", b("تؤدي ثمن طلبك نقدا عند الاستلام"), "."),
      ),
      sec(
        "purposes",
        "لماذا نستعملها",
        list(
          ["معالجة طلبك، والاتصال بك هاتفيا أو عبر واتساب لتأكيده، وتنظيم التوصيل؛"],
          ["خدمة الزبناء والاستبدال والإرجاع؛"],
          ["الوقاية من الاحتيال والطلبات الوهمية؛"],
          [f.pixels.length ? "قياس عدد زوار الصفحة وفعالية إعلاناتنا." : "قياس عدد زوار الصفحة وتحسين عروضنا."],
        ),
        MA
          ? p("تستند هذه المعالجة إلى موافقتك التي تعبر عنها عند إرسال الاستمارة، وإلى ضرورة تنفيذ الطلب الذي تقدمت به.")
          : EU
            ? p("تستند هذه المعالجة إلى تنفيذ طلبك (المادة 6.1.ب من النظام الأوروبي العام لحماية البيانات)، وإلى مصلحتنا المشروعة في الوقاية من الاحتيال، وإلى موافقتك فيما يخص القياس الإعلاني.")
            : p("تستند هذه المعالجة إلى تنفيذ الطلب الذي تقدمت به وإلى مصلحتنا المشروعة في الوقاية من الاحتيال."),
      ),
      sec(
        "recipients",
        "من يمكنه الاطلاع عليها",
        list(
          ["فريق المتجر، لتأكيد الطلبات وتتبعها؛"],
          ["شركة التوصيل، التي لا تتوصل إلا بما يلزم للتسليم: الاسم والهاتف والمدينة والعنوان والمبلغ المطلوب تحصيله؛"],
          ["مزودونا التقنيون (استضافة الموقع وأدوات تدبير الطلبات)، الذين يعملون وفق تعليماتنا", f.pixels.length ? "؛" : "."],
          ...(f.pixels.length ? [["المنصات الإعلانية المذكورة في فقرة «ملفات تعريف الارتباط وأدوات التتبع»، وذلك فقط بخصوص المعطيات الموضحة فيها."] as Inline[]] : []),
        ),
        p("لا نبيع معطياتك ولا نؤجرها أبدا.", MA ? " وقد يوجد بعض المزودين التقنيين خارج المغرب." : EU ? " وإذا وُجد مزود خارج الاتحاد الأوروبي، يتم النقل وفق الضمانات المنصوص عليها في النظام الأوروبي العام لحماية البيانات." : ""),
      ),
      sec(
        "retention",
        "مدة الاحتفاظ بها",
        p("نحتفظ بمعطيات الطلب طوال المدة اللازمة لمعالجته ولخدمة ما بعد البيع وللشكايات المحتملة، ثم تُؤرشف خلال المدة التي تفرضها التزاماتنا القانونية والمحاسبية والضريبية. أما المعطيات التقنية الخاصة بمحاربة الاحتيال فنحتفظ بها لمدة محدودة."),
      ),
      sec(
        "cookies",
        "ملفات تعريف الارتباط وأدوات التتبع",
        p("تستعمل الصفحة ذاكرة متصفحك لحفظ طلبك الجاري (لعرض صفحة التأكيد)، ومعرّف زيارة مجهول الهوية لأغراض إحصائية."),
        f.pixels.length
          ? p("ولقياس إعلاناتنا، تحمّل الصفحة أيضا: ", b(enumerate(f.pixels, "ar")), ". قد تضع هذه الخدمات ملفات تعريف ارتباط خاصة بها وتتوصل بمعلومات عن زيارتك وطلبك (المنتج والمبلغ)، وفق سياسات الخصوصية الخاصة بها.")
          : p("لا تستعمل هذه الصفحة أي أداة تتبع إعلانية تابعة لجهات خارجية."),
        f.serverPlatforms.length > 0 &&
          p(
            "عند تأكيد طلبك، قد يُبلغ خادمنا أيضا ",
            b(enumerate(f.serverPlatforms, "ar")),
            " بعملية الشراء مباشرة، لقياس أداء إعلاناتنا. لا نرسل إليها أبدا رقم هاتفك واسمك (ولا بريدك الإلكتروني ومدينتك إن أدخلتهما) بشكل مقروء، بل فقط بصمة رقمية لا يمكن الرجوع منها إلى المعلومة الأصلية (تجزئة SHA-256)، مع عنوان IP ونوع المتصفح المستعملين في الطلب.",
          ),
        p("يمكنك مسح هذه المعطيات في أي وقت من إعدادات متصفحك."),
      ),
      sec("security", "الأمان", p("تُعرض هذه الصفحة عبر اتصال مشفر (HTTPS)، ولا يطلع على الطلبات إلا الأشخاص المؤهلون داخل المتجر.")),
      sec(
        "rights",
        "حقوقك",
        MA
          ? p("طبقا لـ", b("القانون رقم 09.08"), " المتعلق بحماية الأشخاص الذاتيين تجاه معالجة المعطيات ذات الطابع الشخصي، لك الحق في الولوج إلى معطياتك وتصحيحها، والتعرض لأسباب مشروعة على معالجتها. ويمكنك أيضا طلب حذفها.")
          : EU
            ? p("طبقا لـ", b("النظام الأوروبي العام لحماية البيانات"), "، لك الحق في الولوج إلى معطياتك وتصحيحها ومحوها وتقييد معالجتها والاعتراض عليها ونقلها، ويمكنك سحب موافقتك في أي وقت.")
            : p("يمكنك طلب الاطلاع على معطياتك أو تصحيحها أو حذفها."),
        p("لممارسة هذه الحقوق، تواصل معنا ", ...contact, "، مع ذكر رقم الهاتف الذي استعملته في الطلب."),
        MA
          ? p("وإذا رأيت أن حقوقك لم تُحترم، يمكنك اللجوء إلى اللجنة الوطنية لمراقبة حماية المعطيات ذات الطابع الشخصي: ", link("www.cndp.ma", "https://www.cndp.ma", true), ".")
          : EU
            ? p("ويمكنك أيضا تقديم شكاية لدى سلطة حماية البيانات في بلدك.")
            : null,
      ),
      sec("changes", "التحديثات", p("قد تتغير هذه السياسة تبعا لتطور ممارساتنا أو القانون. ويظهر تاريخ آخر تحديث في أعلى هذه الصفحة.")),
    ],
  };

  const terms: LegalText = {
    kind: "terms",
    title: "الشروط العامة للبيع",
    summary: [
      ["طلب في 30 ثانية بلا حساب، و", b("الدفع نقدا عند الاستلام"), "."],
      ["نتصل بك لتأكيد الطلب قبل الإرسال."],
      days ? ["لديك ", b(days), " بعد الاستلام لتغيير رأيك", MA ? " (القانون رقم 31.08)." : "."] : ["يمكنك تغيير رأيك بعد الاستلام وفق الشروط المبينة أسفله."],
    ],
    sections: [
      sec("seller", "البائع", p("تنظم هذه الشروط عمليات البيع المبرمة عبر هذه الصفحة بين متجر ", b(s.name), " وكل شخص يتقدم بطلب («الزبون»)."), ident),
      sec(
        "scope",
        "نطاق التطبيق",
        p("يعني كل طلب قبول هذه الشروط، التي يمكن الاطلاع عليها في أي وقت من أسفل الصفحة. وتطبق على الطلبات المسلّمة ", MA ? "داخل المغرب." : "في المناطق التي يخدمها المتجر."),
      ),
      sec(
        "products",
        "المنتجات",
        p("تُعرض الخصائص الأساسية لمنتج «", b(f.product), "» في الصفحة: الوصف والصور والسعة أو الأبعاد والخيارات. الصور أقرب ما يمكن إلى الواقع، وقد تظهر فروق طفيفة في الألوان حسب الشاشات."),
        p("العروض صالحة في حدود المخزون المتوفر. وإذا نفد منتج بعد طلبك، نخبرك ونقترح عليك منتجا آخر أو إلغاء الطلب دون أي مصاريف."),
      ),
      sec(
        "prices",
        "الأسعار",
        p("الأسعار معروضة بـ", currency, "، شاملة لجميع الضرائب. ", ...feeLine),
        p("السعر المعتمد هو المعروض لحظة الطلب، بما في ذلك العروض المجمعة والعروض المحدودة في الزمن. ويمثل السعر المشطوب السعر المرجعي لنفس المنتجات عند شرائها بالوحدة أو السعر المعمول به سابقا."),
      ),
      sec(
        "order",
        "الطلب",
        list(
          ["تختار العرض والخيارات، ثم تملأ الاستمارة."],
          ["يظهر رقم طلبك في صفحة التأكيد."],
          ["نتصل بك هاتفيا أو عبر واتساب لتأكيد الطلب والعنوان، ولا يُرسل الطلب إلا بعد هذا التأكيد."],
        ),
        p("يحق لنا رفض أو إلغاء أي طلب يتبين أنه وهمي أو ناقص أو تم بسوء نية (مثل الطلبات المتكررة التي لا يتم تسلمها)."),
      ),
      sec(
        "payment",
        "الدفع عند الاستلام",
        callout("cash-hand", "يتم الأداء ", b("نقدا لعامل التوصيل عند استلام الطرد"), "، ولا يُطلب منك أي أداء عبر الإنترنت."),
        p("يمكنك معاينة طردك عند الاستلام وقبل الأداء. وإذا كان متضررا أو لا يطابق طلبك، يمكنك رفضه دون أداء أي شيء."),
      ),
      sec("delivery", "التوصيل", p("تجد مناطق التوصيل وآجاله ومصاريفه في صفحة ", link("التوصيل والإرجاع", f.links.shipping), ".")),
      sec(
        "withdrawal",
        "حق التراجع",
        MA
          ? p("طبقا لـ", b("القانون رقم 31.08"), " القاضي بتحديد تدابير لحماية المستهلك، لك أجل ", b("7 أيام"), " ابتداء من تاريخ استلام طلبك لممارسة حقك في التراجع، دون الحاجة إلى تبرير ودون أداء أي غرامة، باستثناء مصاريف الإرجاع.")
          : EU
            ? p("طبقا للتنظيم الأوروبي الخاص بالعقود عن بعد، لك أجل ", b("14 يوما"), " ابتداء من تاريخ استلام طلبك للتراجع دون الحاجة إلى تبرير، وتبقى مصاريف الإرجاع على عاتقك.")
            : p("يمكنك التراجع بعد استلام طلبك داخل الأجل الذي ينص عليه القانون المعمول به، وتبقى مصاريف الإرجاع على عاتقك."),
        p("لممارسة هذا الحق، تواصل معنا ", ...contact, " مع ذكر رقم الطلب. يجب إرجاع المنتج كاملا وفي حالته الأصلية. ",
          MA
            ? "ونرد لك المبالغ المؤداة دون تأخير، وفي أجل أقصاه 15 يوما من تاريخ ممارستك لحق التراجع."
            : EU
              ? "ونرد لك المبالغ المؤداة في أجل أقصاه 14 يوما من تاريخ تراجعك، ويمكننا انتظار توصلنا بالمنتج المرجع."
              : "ونرد لك المبالغ المؤداة داخل الآجال التي ينص عليها القانون المعمول به.",
        ),
        p("لا يسري هذا الحق، في الحالات التي ينص عليها القانون، على المنتجات المصنوعة حسب مواصفاتك أو المخصصة لك، ولا على المنتجات التي لا يمكن إعادة إرسالها بحكم طبيعتها أو المعرضة للتلف السريع", EU ? "، ولا على منتجات النظافة أو التجميل التي فُتح غلافها بعد التسليم." : "."),
      ),
      sec("warranty", "الضمانات", p("تستفيد المنتجات من الضمان القانوني لعيوب الشيء المبيع. وإذا كان منتجك معيبا أو لا يطابق طلبك، تواصل معنا مع صورة: نستبدله أو نرد لك ثمنه، وتكون مصاريف الإرجاع على عاتقنا.")),
      sec("data", "المعطيات الشخصية", p("لا تُستعمل معلومات الاستمارة إلا لمعالجة طلبك وتوصيله. اطلع على ", link("سياسة الخصوصية", f.links.privacy), ".")),
      sec(
        "disputes",
        "الشكايات والقانون المطبق",
        p("لأي شكاية، تواصل أولا مع خدمة الزبناء ", ...contact, "، وسنبحث معك عن حل ودي في أقرب الآجال."),
        MA
          ? p("تخضع هذه الشروط للقانون المغربي. وفي غياب حل ودي، يُعرض النزاع على المحاكم المغربية المختصة.")
          : EU
            ? p("تخضع هذه الشروط لقانون بلد البائع، دون المساس بالمقتضيات الحمائية لبلد إقامة المستهلك. ويمكنك اللجوء مجانا إلى وسيط الاستهلاك: ", ph("اسم الوسيط وموقعه"), ".")
            : p("في غياب حل ودي، يُعرض النزاع على المحاكم المختصة."),
      ),
    ],
  };

  const shipping: LegalText = {
    kind: "shipping",
    title: "التوصيل والإرجاع",
    summary: [
      [b(f.delivery)],
      f.fee > 0 ? ["مصاريف التوصيل: ", b(f.feeText), " عن كل طلب."] : [b("التوصيل مجاني"), " لجميع الطلبات."],
      ["الدفع نقدا عند الاستلام، ", b("بعد معاينة الطرد"), "."],
      days ? ["الاستبدال أو الإرجاع ممكن خلال ", b(days), " بعد الاستلام."] : ["الاستبدال أو الإرجاع ممكن بعد الاستلام وفق الشروط أسفله."],
    ],
    sections: [
      sec(
        "zones",
        "أين نوصل",
        MA
          ? p("نوصل إلى جميع مدن المغرب التي تخدمها شركة التوصيل التي نتعامل معها.", f.fields.citySelect ? " وإذا لم تجد مدينتك في لائحة الاستمارة، اختر «مدينة أخرى» واكتب اسم منطقتك في العنوان." : "")
          : p("نوصل إلى المناطق التي تخدمها شركة التوصيل التي نتعامل معها. وإذا كان لديك شك، تواصل معنا قبل الطلب."),
      ),
      sec("times", "آجال التوصيل", p("الأجل التقريبي: ", b(f.delivery), ". يبدأ احتسابه من تأكيد طلبك هاتفيا، وقد يطول بالنسبة للمناطق البعيدة أو في أيام العطل أو فترات الضغط، وسنخبرك في حال حدوث أي تأخير.")),
      sec("fees", "مصاريف التوصيل", p(...feeLine)),
      sec(
        "steps",
        "كيف يتم التوصيل",
        list(
          [b("التأكيد"), " — نتصل بك هاتفيا أو عبر واتساب لتأكيد الطلب والعنوان."],
          [b("الإرسال"), " — نسلم طردك لشركة التوصيل."],
          [b("التسليم"), " — يتصل بك عامل التوصيل قبل المرور، فاحرص على أن يكون هاتفك قريبا منك."],
          [b("الأداء"), " — تعاين الطرد، ثم تؤدي الثمن نقدا لعامل التوصيل."],
        ),
        p("إذا كنت غائبا أو تعذر الاتصال بك، يعيد عامل التوصيل الاتصال بك للاتفاق على موعد جديد. والطرد الذي لا يُتسلم بعد عدة محاولات يُعاد إلينا ويُلغى الطلب."),
      ),
      sec("check", "عند الاستلام", callout("shield-check", "عاين حالة الطرد ومحتواه ", b("قبل الأداء"), ". وإذا كان متضررا أو ناقصا أو لا يطابق طلبك، يمكنك رفضه دون أداء أي شيء.")),
      sec(
        "returns",
        "التراجع والإرجاع",
        days
          ? p("لديك ", b(days), " ابتداء من تاريخ الاستلام لإرجاع منتج لم يناسبك دون الحاجة إلى تبرير", MA ? " (القانون رقم 31.08)" : "", ". وتكون مصاريف الإرجاع على عاتقك، إلا إذا كان المنتج معيبا أو كان الخطأ من جهتنا.")
          : p("يمكنك إرجاع منتج لم يناسبك داخل الأجل الذي ينص عليه القانون المعمول به. وتكون مصاريف الإرجاع على عاتقك، إلا إذا كان المنتج معيبا أو كان الخطأ من جهتنا."),
        list(
          ["تواصل معنا ", ...contact, " مع ذكر رقم الطلب."],
          ["أرجع المنتج كاملا، في حالته وتغليفه الأصليين، حسب التعليمات التي نقدمها لك."],
          ["بعد توصلنا بالمنتج والتحقق منه، نرد لك المبلغ بتحويل بنكي أو بوسيلة أخرى نتفق عليها معا."],
        ),
        p("اطلع أيضا على الاستثناءات المذكورة في ", link("الشروط العامة للبيع", f.links.terms), "."),
      ),
      sec(
        "exchange",
        "الاستبدال",
        p("مقاس آخر أو لون آخر أو منتج آخر؟ تواصل معنا ", days ? `خلال ${days} بعد الاستلام` : "بعد الاستلام", "، وسننظم الاستبدال حسب المخزون المتوفر. ونخبرك بمصاريف إعادة الإرسال، إن وجدت، قبل الاستبدال."),
      ),
      sec("defects", "منتج معيب أو خطأ في الطلب", p("إذا توصلت بمنتج معيب أو مختلف عن طلبك، أخبرنا في أقرب وقت مع صورة. نستبدله أو نرد لك ثمنه، وتكون مصاريف الإرجاع على عاتقنا.")),
    ],
  };

  const contactDoc: LegalText = {
    kind: "contact",
    title: "تواصل معنا",
    summary: [
      s.whatsapp ? ["الأسرع: ", b("راسلنا عبر واتساب"), "."] : ["عندك سؤال على منتج أو طلب؟ نحن هنا لمساعدتك."],
      ["بخصوص طلب، اذكر رقم الطلب ورقم الهاتف الذي استعملته."],
    ],
    sections: [
      sec("reach", "كيف تتواصل معنا", p("راسلنا أو اتصل بنا ", ...contact, ".")),
      sec("orders", "تتبع الطلب", p("بعد طلبك، نتصل بك لتأكيده. ولأي سؤال عن توصيل جار، تواصل معنا مع ذكر رقم الطلب (الظاهر في صفحة التأكيد) ورقم الهاتف الذي استعملته في الطلب.")),
      sec(
        "company",
        "المعلومات القانونية",
        ident,
        p("اطلع أيضا على ", link("سياسة الخصوصية", f.links.privacy), " و", link("الشروط العامة للبيع", f.links.terms), " وصفحة ", link("التوصيل والإرجاع", f.links.shipping), "."),
      ),
    ],
  };

  return { privacy, terms, shipping, contact: contactDoc };
}

/* ------------------------------------------------------------------ */
/* English                                                             */
/* ------------------------------------------------------------------ */

function en(f: Facts): Record<LegalKind, LegalText> {
  const MA = f.regime === "MA";
  const EU = f.regime === "EU";
  const s = f.store;
  const contact = contactLine(f, "en", { whatsapp: "on WhatsApp at", phone: "by phone at", email: "by e-mail at", or: "or", missing: "customer service contact" });
  const ident = identity(f, {
    name: "Trading name",
    legalName: "Legal name",
    address: "Address",
    ice: "ICE",
    rc: "Trade register (RC)",
    registration: "Registration",
    phone: "Phone",
    whatsapp: "WhatsApp",
    email: "E-mail",
    phLegalName: "legal company name",
    phAddress: "registered address",
    phIce: "ICE (15 digits)",
    phRc: "RC number and city",
    phRegistration: "company and VAT registration numbers",
    phEmail: "contact e-mail",
  });
  const currency = f.currency === "MAD" ? "Moroccan dirhams (MAD)" : f.currency === "EUR" ? "euros (EUR)" : f.currency;
  const fields = [
    "full name",
    "phone number",
    ...(f.fields.city ? ["city"] : []),
    ...(f.fields.address ? ["delivery address"] : []),
    ...(f.fields.email ? ["e-mail address"] : []),
  ];
  const days = MA ? "7 days" : EU ? "14 days" : null;
  const feeLine: Inline[] = f.fee > 0
    ? ["A delivery fee of ", b(f.feeText), " per order is added to the product price; it is shown in the form summary before you confirm."]
    : [b("Delivery is free"), ", whichever pack you choose."];

  const privacy: LegalText = {
    kind: "privacy",
    title: "Privacy policy",
    summary: [
      ["We only ask for what it takes to deliver your order: ", b(enumerate(fields, "en")), "."],
      ["Your data is never sold. It is shared with the courier for delivery", f.pixels.length ? " and, to measure our ads, with the platforms listed below." : "."],
      ["You can ask to access, correct or delete your data at any time", MA ? " (Law No. 09-08)." : "."],
    ],
    sections: [
      sec("controller", "Who is responsible for your data", p("The controller of your data is the store ", b(s.name), ", identified below."), ident),
      sec(
        "data",
        "The data we collect",
        p("When you order with the form on this page:"),
        list(
          [b("Contact"), ": full name, phone number", f.fields.email ? ", e-mail address;" : ";"],
          ...(f.fields.city || f.fields.address
            ? [[b("Delivery"), ": ", enumerate([...(f.fields.city ? ["city"] : []), ...(f.fields.address ? ["address"] : []), ...(f.fields.note ? ["an optional note for the courier"] : [])], "en"), ";"] as Inline[]]
            : []),
          [b("Order"), ": product, pack and options chosen, amount, date and time."],
        ),
        p("Automatically, during your visit:"),
        list(
          ["technical data: device and browser type, referring page, campaign parameters in the link;"],
          ["your IP address, stored in an irreversibly encrypted form, to fight fake orders and abuse;"],
          ["an anonymous visit identifier, for page traffic statistics."],
        ),
        callout("cash-hand", "No bank details are collected: ", b("you pay in cash on delivery"), "."),
      ),
      sec(
        "purposes",
        "Why we use it",
        list(
          ["to process your order, call you or message you on WhatsApp to confirm it, and arrange delivery;"],
          ["to provide customer service, exchanges and returns;"],
          ["to prevent fraud and fake orders;"],
          [f.pixels.length ? "to measure page traffic and the performance of our ads." : "to measure page traffic and improve our offers."],
        ),
        MA
          ? p("This processing is based on your consent, given when you send the form, and on the need to fulfil the order you place.")
          : EU
            ? p("This processing is based on the performance of your order (GDPR Article 6(1)(b)), on our legitimate interest in preventing fraud and, for ad measurement, on your consent.")
            : p("This processing is based on the performance of the order you place and on our legitimate interest in preventing fraud."),
      ),
      sec(
        "recipients",
        "Who can access it",
        list(
          ["the store team, to confirm and follow up orders;"],
          ["the delivery company, which only receives what delivery requires: name, phone, city, address and the amount to collect;"],
          ["our technical providers (website hosting, order management tools), acting on our instructions", f.pixels.length ? ";" : "."],
          ...(f.pixels.length ? [["the advertising platforms named under “Cookies and trackers”, for the information described there only."] as Inline[]] : []),
        ),
        p("Your data is never sold or rented.", MA ? " Some technical providers may be located outside Morocco." : EU ? " If a provider is located outside the European Union, the transfer is covered by the safeguards required by the GDPR." : ""),
      ),
      sec(
        "retention",
        "How long we keep it",
        p("Order data is kept for as long as needed to process the order, provide after-sales service and handle any claims, then archived for the period required by our legal, accounting and tax obligations. Anti-fraud technical data is kept for a limited time."),
      ),
      sec(
        "cookies",
        "Cookies and trackers",
        p("This page uses your browser storage to remember your current order (to show the confirmation page) and an anonymous visit identifier for statistics."),
        f.pixels.length
          ? p("To measure our ads, the page also loads: ", b(enumerate(f.pixels, "en")), ". These services may set their own cookies and receive information about your visit and your order (product, amount), under their own privacy policies.")
          : p("No third-party advertising pixel is used on this page."),
        f.serverPlatforms.length > 0 &&
          p(
            "When you place an order, our server may also confirm the purchase directly to ",
            b(enumerate(f.serverPlatforms, "en")),
            " to measure our ads. Your phone number and name (and your email and city, if you give them) are never sent to them in readable form: only an irreversible fingerprint (a SHA-256 hash) is shared, along with the IP address and browser type used for the order.",
          ),
        p("You can clear this data at any time in your browser settings."),
      ),
      sec("security", "Security", p("This page is served over an encrypted connection (HTTPS). Access to orders is restricted to authorised store staff.")),
      sec(
        "rights",
        "Your rights",
        MA
          ? p("Under Moroccan ", b("Law No. 09-08"), " on the protection of individuals with regard to the processing of personal data, you have the right to access and correct your data and to object, on legitimate grounds, to its processing. You can also ask us to delete it.")
          : EU
            ? p("Under the ", b("GDPR"), ", you have the right to access, correct, erase, restrict, object to and port your data, and you can withdraw your consent at any time.")
            : p("You can ask to access, correct or delete your data."),
        p("To exercise these rights, contact us ", ...contact, ", quoting the phone number you ordered with."),
        MA
          ? p("If you believe your rights have not been respected, you can contact Morocco's data protection authority, the CNDP: ", link("www.cndp.ma", "https://www.cndp.ma", true), ".")
          : EU
            ? p("You can also lodge a complaint with the data protection authority of your country.")
            : null,
      ),
      sec("changes", "Updates", p("This policy may change with our practices or the law. The date of the latest update is shown at the top of this page.")),
    ],
  };

  const terms: LegalText = {
    kind: "terms",
    title: "Terms of sale",
    summary: [
      ["Order in 30 seconds, no account needed, and ", b("pay in cash on delivery"), "."],
      ["We call you to confirm before shipping."],
      days ? ["You have ", b(days), " after delivery to change your mind", MA ? " (Law No. 31-08)." : "."] : ["You can change your mind after delivery, under the conditions below."],
    ],
    sections: [
      sec("seller", "The seller", p("These terms govern sales made on this page between the store ", b(s.name), " and anyone who places an order (“the customer”)."), ident),
      sec(
        "scope",
        "Scope",
        p("Placing an order means accepting these terms, which can be read at any time from the bottom of the page. They apply to orders delivered ", MA ? "in Morocco." : "in the areas the store serves."),
      ),
      sec(
        "products",
        "Products",
        p("The essential features of “", b(f.product), "” are presented on the page: description, photos, size or capacity, options. Photos are as faithful as possible; colours may vary slightly between screens."),
        p("Offers are valid while stocks last. If an item becomes unavailable after you order, we let you know and offer another item or a free cancellation."),
      ),
      sec(
        "prices",
        "Prices",
        p("Prices are shown in ", currency, ", all taxes included. ", ...feeLine),
        p("The price that applies is the one displayed when you order, including packs and limited-time offers. A struck-through price is the reference price of the same items bought individually, or the price previously charged."),
      ),
      sec(
        "order",
        "Ordering",
        list(
          ["You choose your pack and options, then fill in the form."],
          ["An order number is shown on the confirmation page."],
          ["We call you or message you on WhatsApp to confirm the order and the address; the order ships after this confirmation."],
        ),
        p("We may refuse or cancel an order that is clearly fake, incomplete or placed in bad faith (for example repeated orders that are never collected)."),
      ),
      sec(
        "payment",
        "Cash on delivery",
        callout("cash-hand", "You pay ", b("in cash, to the courier, when you receive the parcel"), ". No online payment is ever requested."),
        p("You can check your parcel on delivery, before paying. If it is damaged or does not match your order, you can refuse it and pay nothing."),
      ),
      sec("delivery", "Delivery", p("Delivery areas, times and fees are detailed on the ", link("Shipping & returns", f.links.shipping), " page.")),
      sec(
        "withdrawal",
        "Right of withdrawal",
        MA
          ? p("Under Moroccan ", b("Law No. 31-08"), " on consumer protection, you have ", b("7 days"), " from receiving your order to withdraw from the purchase, without giving a reason or paying any penalty, except for the return costs.")
          : EU
            ? p("Under EU rules on distance contracts, you have ", b("14 days"), " from receiving your order to withdraw, without giving a reason. Return costs are yours to bear.")
            : p("You can withdraw after receiving your order within the period set by the applicable law; return costs are yours to bear."),
        p("To do so, contact us ", ...contact, " with your order number. The product must be returned complete and in its original condition. ",
          MA
            ? "We refund the amounts paid without delay, and at the latest within 15 days of the day you exercised your right of withdrawal."
            : EU
              ? "We refund the amounts paid at the latest 14 days after your withdrawal; we may wait until we have received the product back."
              : "We refund the amounts paid within the time limits set by the applicable law.",
        ),
        p("As provided by law, this right does not apply to products made to your specifications or personalised, nor to products which by their nature cannot be sent back or may deteriorate quickly", EU ? ", nor to hygiene or cosmetic products unsealed after delivery." : "."),
      ),
      sec("warranty", "Warranty", p("Products are covered by the legal warranty against defects in the goods sold. If your product is faulty or does not match your order, contact us with a photo: we exchange or refund it, and return costs are on us.")),
      sec("data", "Personal data", p("The information in the form is only used to process and deliver your order. See our ", link("Privacy policy", f.links.privacy), ".")),
      sec(
        "disputes",
        "Complaints and governing law",
        p("For any complaint, first contact our customer service ", ...contact, ": we will look for an amicable solution as quickly as possible."),
        MA
          ? p("These terms are governed by Moroccan law. Failing an amicable agreement, the dispute will be brought before the competent Moroccan courts.")
          : EU
            ? p("These terms are governed by the law of the seller's country, without prejudice to the protective rules of the consumer's country of residence. You can use a consumer mediator free of charge: ", ph("mediator name and website"), ".")
            : p("Failing an amicable agreement, the dispute will be brought before the competent courts."),
      ),
    ],
  };

  const shipping: LegalText = {
    kind: "shipping",
    title: "Shipping & returns",
    summary: [
      [b(f.delivery)],
      f.fee > 0 ? ["Delivery fee: ", b(f.feeText), " per order."] : [b("Free delivery"), " on every order."],
      ["Pay in cash on delivery, ", b("after checking the parcel"), "."],
      days ? ["Exchange or return within ", b(days), " of delivery."] : ["Exchange or return after delivery, under the conditions below."],
    ],
    sections: [
      sec(
        "zones",
        "Where we deliver",
        MA
          ? p("We deliver to every Moroccan city served by our delivery company.", f.fields.citySelect ? " If your city is not in the form's list, choose “Other city” and add your locality to the address." : "")
          : p("We deliver to the areas served by our delivery company. If in doubt, contact us before ordering."),
      ),
      sec("times", "Delivery times", p("Estimated time: ", b(f.delivery), ". It starts when your order is confirmed by phone and may be longer for remote areas, on public holidays or at busy times; we let you know about any delay.")),
      sec("fees", "Delivery fees", p(...feeLine)),
      sec(
        "steps",
        "How delivery works",
        list(
          [b("Confirmation"), " — we call you or message you on WhatsApp to confirm the order and address."],
          [b("Shipping"), " — your parcel is handed to our delivery company."],
          [b("Delivery"), " — the courier calls you before coming: keep your phone close."],
          [b("Payment"), " — you check the parcel, then pay the courier in cash."],
        ),
        p("If you are away or unreachable, the courier contacts you again to arrange a new visit. A parcel not collected after several attempts is returned to us and the order is cancelled."),
      ),
      sec("check", "On delivery", callout("shield-check", "Check the parcel and its contents ", b("before paying"), ". If it is damaged, incomplete or does not match your order, you can refuse it: you pay nothing.")),
      sec(
        "returns",
        "Withdrawal and returns",
        days
          ? p("You have ", b(days), " from delivery to return a product that does not suit you, without giving a reason", MA ? " (Law No. 31-08)" : "", ". Return costs are yours, unless the product is faulty or we made a mistake.")
          : p("You can return a product that does not suit you within the period set by the applicable law. Return costs are yours, unless the product is faulty or we made a mistake."),
        list(
          ["Contact us ", ...contact, " with your order number."],
          ["Send the product back complete, in its original condition and packaging, following our instructions."],
          ["Once we have received and checked it, we refund you by bank transfer or another method agreed together."],
        ),
        p("See also the exceptions listed in our ", link("Terms of sale", f.links.terms), "."),
      ),
      sec("exchange", "Exchanges", p("Another size, colour or item? Contact us ", days ? `within ${days} of delivery` : "after delivery", " and we arrange the exchange subject to stock. Any re-shipping cost is quoted before the exchange.")),
      sec("defects", "Faulty product or mistake", p("If you receive a faulty product or one that differs from your order, tell us as soon as possible with a photo. We replace or refund it, and return costs are on us.")),
    ],
  };

  const contactDoc: LegalText = {
    kind: "contact",
    title: "Contact",
    summary: [
      s.whatsapp ? ["Fastest: ", b("message us on WhatsApp"), "."] : ["A question about a product or an order? We are here to help."],
      ["About an order? Include your order number and the phone number you used."],
    ],
    sections: [
      sec("reach", "Reach us", p("Message or call us ", ...contact, ".")),
      sec("orders", "Order follow-up", p("After you order, we call you to confirm it. For any question about a delivery in progress, contact us with your order number (shown on the confirmation page) and the phone number you ordered with.")),
      sec(
        "company",
        "Legal information",
        ident,
        p("See also our ", link("Privacy policy", f.links.privacy), ", our ", link("Terms of sale", f.links.terms), " and the ", link("Shipping & returns", f.links.shipping), " page."),
      ),
    ],
  };

  return { privacy, terms, shipping, contact: contactDoc };
}

/* ------------------------------------------------------------------ */
/* Chrome                                                              */
/* ------------------------------------------------------------------ */

const CHROME: Record<LegalLang, LegalChrome> = {
  fr: {
    kicker: "Informations légales",
    updated: "Mise à jour le",
    toc: "Sommaire",
    inShort: "En bref",
    back: "Retour à la page",
    questions: "Une question ?",
    questionsText: "Notre équipe vous répond rapidement, avant comme après votre commande.",
    whatsapp: "Écrire sur WhatsApp",
    call: "Appeler",
    email: "Envoyer un e-mail",
    todo: "À compléter :",
    documents: "Documents",
    identity: "Identité du vendeur",
    cod: "Paiement à la livraison",
  },
  ar: {
    kicker: "معلومات قانونية",
    updated: "آخر تحديث:",
    toc: "المحتوى",
    inShort: "باختصار",
    back: "الرجوع إلى الصفحة",
    questions: "عندك سؤال؟",
    questionsText: "فريقنا يجيبك بسرعة، قبل الطلب وبعده.",
    whatsapp: "راسلنا على واتساب",
    call: "اتصل بنا",
    email: "أرسل بريدا إلكترونيا",
    todo: "يُستكمل:",
    documents: "الوثائق",
    identity: "هوية البائع",
    cod: "الدفع عند الاستلام",
  },
  en: {
    kicker: "Legal information",
    updated: "Updated",
    toc: "Contents",
    inShort: "In short",
    back: "Back to the page",
    questions: "A question?",
    questionsText: "Our team answers quickly, before and after you order.",
    whatsapp: "Message on WhatsApp",
    call: "Call us",
    email: "Send an e-mail",
    todo: "To be completed:",
    documents: "Documents",
    identity: "Seller identity",
    cod: "Cash on delivery",
  },
};

export const legalChrome = (lang: LegalLang): LegalChrome => CHROME[lang];

/* ------------------------------------------------------------------ */
/* Entry points                                                        */
/* ------------------------------------------------------------------ */

const PIXEL_NAMES = {
  metaPixelId: "Meta Pixel (Facebook, Instagram)",
  tiktokPixelId: "TikTok Pixel",
  snapPixelId: "Snap Pixel (Snapchat)",
  ga4Id: "Google Analytics",
} as const;

/**
 * Platforms whose pixels can also get the order from the server (Meta Conversions API, TikTok
 * Events API, when the store adds an access token): the customer's phone and name (email and city
 * when given) go out hashed with SHA-256, with the IP address and browser of the order.
 */
const SERVER_EVENT_PLATFORMS = {
  metaPixelId: "Meta",
  tiktokPixelId: "TikTok",
} as const;

function factsOf(ctx: RenderContext): Facts {
  const { doc } = ctx;
  const market = doc.market;
  return {
    regime: market === "MA" ? "MA" : EU_MARKETS.has(market) ? "EU" : "INTL",
    store: ctx.store,
    product: doc.product.name,
    currency: doc.currency,
    fee: doc.offers.shippingFee,
    feeText: ctx.money(doc.offers.shippingFee),
    delivery: ctx.t("trust.delivery"),
    pixels: (Object.keys(PIXEL_NAMES) as (keyof typeof PIXEL_NAMES)[]).filter((k) => !!doc.tracking[k]).map((k) => PIXEL_NAMES[k]),
    serverPlatforms: (Object.keys(SERVER_EVENT_PLATFORMS) as (keyof typeof SERVER_EVENT_PLATFORMS)[]).filter((k) => !!doc.tracking[k]).map((k) => SERVER_EVENT_PLATFORMS[k]),
    fields: {
      city: doc.form.city !== "hidden",
      citySelect: doc.form.city === "select",
      address: doc.form.address !== "hidden",
      note: doc.form.note !== "hidden",
      email: doc.form.email !== "hidden",
    },
    links: ctx.links,
  };
}

/** The four legal documents of a page, in its language (ar / fr; other locales: English). */
export function legalTexts(ctx: RenderContext): Record<LegalKind, LegalText> {
  const f = factsOf(ctx);
  const lang = legalLang(ctx.locale);
  return lang === "ar" ? ar(f) : lang === "fr" ? fr(f) : en(f);
}

export function legalText(kind: LegalKind, ctx: RenderContext): LegalText {
  return legalTexts(ctx)[kind];
}
