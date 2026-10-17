/**
 * Product options editor, shared by the generate wizard (Details step), the item cards and the
 * builder (Product panel): choice groups, combined options (color × size) and custom fields. See
 * variants-editor.tsx; the presets and the color dictionary live in src/lib/page/variant-presets.ts,
 * the pure matrix operations in matrix-model.ts.
 */
export { VariantsEditor, type VariantsEditorProps, type VariantPhoto } from "./variants-editor";
export { Dot } from "./options-field";
export { DraftInput, Disclosure, IconAction, MoneyInput } from "./parts";
export { matrixSummary, type Rekey } from "./matrix-model";
