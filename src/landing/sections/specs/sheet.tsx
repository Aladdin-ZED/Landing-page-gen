/**
 * specs/sheet — a clean spec sheet: label | value rows on hairlines that draw in one after the other
 * while figures roll up, beside a tall sticky product tile (the page's mask on wide screens) whose
 * key figure floats in a glass callout over its edge. Price and order button close the sheet.
 * Technical archetypes add mono row indices.
 */
import type { ReactElement } from "react";
import { Container, cx } from "@/landing/primitives";
import { Buy, Head, Highlights, Note, SpecList, Tile, visuals, type ViewProps } from "./parts";

export function Sheet({ ctx, data, id, titleId }: ViewProps): ReactElement {
  const img = visuals(ctx, data)[0] ?? null;
  return (
    <Container className={cx("lp-specs__grid", "lp-specs__sheet", !img && "lp-specs--novisual")}>
      <div className="lp-specs__lead">
        <Head ctx={ctx} data={data} titleId={titleId} />
        <Highlights ctx={ctx} data={data} />
      </div>
      {img ? <Tile ctx={ctx} data={data} id={id} asset={img} variant="sheet" sizes="(min-width: 60rem) 34rem, 92vw" /> : null}
      <div className="lp-specs__main">
        <SpecList ctx={ctx} rows={data.rows} layout="rows" count />
        <Note ctx={ctx} data={data} />
        <Buy ctx={ctx} data={data} />
      </div>
    </Container>
  );
}
