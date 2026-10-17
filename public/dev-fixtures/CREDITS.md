# Dev fixture photos — credits

Sample product photos used by the development fixtures (`src/lib/page/fixtures.ts`) and the QA
renders (`scripts/qa`). They are never part of a published page or an export.

All photos come from [Unsplash](https://unsplash.com) and are used under the
[Unsplash License](https://unsplash.com/license): free to use, including commercially, no
permission or attribution required (credit given here anyway). The files are resized WebP
renditions (480 / 960 / 1440 px wide) named `<assetId>-<width>.webp`, like real media keys.
Rebuild them with `npx tsx scripts/qa/fixture-images.ts`.

| Fixture image | Asset id | Photographer | Source |
|---|---|---|---|
| argan-amber | `998b0718f328c3caadde3ff7afbafd16` | Kadarius Seegars | https://unsplash.com/photos/GDSNp1RJyLE |
| argan-stand | `5fee6bf12dbbef51d30f2c9d5f251674` | Kadarius Seegars | https://unsplash.com/photos/9nh0lK1FqGE |
| argan-flat | `510d3fcf85d14964f90772e18eb4b536` | Cosmin Ursea | https://unsplash.com/photos/5lVlt93fn7w |
| massage-side | `2354c5d9b88be6ec89d2efa0d0d9f904` | Kedibone Isaac Makhumisane | https://unsplash.com/photos/lG3CRe9sjuE |
| massage-detail | `195c5361a11688a5e4dfd85c3fc9218d` | Kedibone Isaac Makhumisane | https://unsplash.com/photos/hMQsX8iGNQU |
| blender-hand | `1303e53b29a3006ef1381930643c87e2` | BlendJet | https://unsplash.com/photos/daa-gr83Mf0 |
| blender-fruit | `c5a0913383417911c3572b8ed81cf1eb` | Melissa Walker Horn | https://unsplash.com/photos/loyxR74E4vU |
| parfum-glass | `55e4c8246376fe46c9055d88b1387baf` | Kier in Sight Archives | https://unsplash.com/photos/j1vg92xdoX4 |
| parfum-tray | `0adb2ba97e1013e60401e63989862c79` | Lindsey Savage | https://unsplash.com/photos/jSoc-A8rwfo |

Derived photos of the Offers v2 fixtures (`duo`, `tshirt`, `colors`), built offline by
`npx tsx scripts/qa/fixture-derived.ts` from the photos above (Unsplash License: modifications
allowed) or drawn as vector mockups:

| Fixture image | Asset id | Made from |
|---|---|---|
| duo-pair (16:9) | `40b88379a913d4547c42c7cbc4a04fa8` | argan-amber + parfum-glass, side by side |
| duo-serum (4:5) | `b6ee0e53782ccb2b5721c474d0975ee5` | argan-stand, cropped |
| tee-noir (4:5) | `4508cdd123b86a79e0e2c542f861e2cb` | vector t-shirt mockup (no photo) |
| tee-blanc (4:5) | `3f0fb0c3cdf3fe94a7779062d416a8ea` | vector t-shirt mockup (no photo) |
| tee-gris (4:5) | `549fe175e9e879b760036480016220ed` | vector t-shirt mockup (no photo) |
