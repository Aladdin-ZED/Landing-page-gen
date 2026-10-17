/**
 * Offer editing (docs/OFFERS.md §H.4), shared by the builder's Offers panel and the generate
 * wizard's Offers step: offer cards and the OfferEditor (contents composer, rules, price, visual,
 * details), the products shelf, preset tiles and the "Suggest offers" diff, the Display picker
 * with its combos, the mini composition, and the pure models (presets, sentences, edits).
 */
export { OfferEditor, type OfferEditorProps, type OffersDoc } from "./offer-editor";
export { OfferList, type OfferListProps } from "./offer-list";
export { MiniVisual } from "./mini-visual";
export { PresetMenu, SuggestDialog } from "./preset-menu";
export { Shelf } from "./shelf";
export { DisplayPicker, COMBOS, comboDisplay, comboOf, archetypeDisplay, PICKER_UI, type ComboId } from "./display-picker";
export { presetOffer, suggestOffers, charm, colorTarget, offerId, type OfferPreset } from "./presets";
export { offerSentence, contentsLine, contentsText } from "./text";
export * from "./model";
