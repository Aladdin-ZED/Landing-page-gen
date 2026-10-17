/**
 * The item catalog editor (docs/OFFERS.md §B, §H.2, §H.3), shared by the generate wizard and the
 * builder: item cards with photo wells and crops, the delete cascade and the pure catalog operations.
 */
export { ItemsEditor, type ItemsChange, type ItemsEditorProps } from "./items-editor";
export { PhotoWell, type PhotoInfo, type PhotoSource } from "./photo-well";
export { CropDialog, CroppedImg, type CropDialogProps } from "./crop-dialog";
export * from "./model";
