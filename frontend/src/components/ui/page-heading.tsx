/**
 * The heading block at the top of a screen: optional illustration, title,
 * subtitle, and an optional action on the right.
 *
 * The illustration is **opt-in**. `.page-head` is rendered by 44 pages — every
 * `[id]` detail view and every `/new` form uses it too — so wiring an image in
 * at the CSS level would put a drawing on "New sales order" and on every
 * invoice, competing with dense figures on exactly the screens that need none.
 * Only the top-level tabs pass one.
 */

import Image from "next/image";
import type { ReactNode } from "react";

interface PageHeadingProps {
  title: string;
  subtitle?: ReactNode;
  /** Path under /public, e.g. "/img/tabs/sales-order.webp". Omit for no image. */
  image?: string;
  action?: ReactNode;
}

/** Rendered size in CSS pixels. The source files are 360px — 3x — because
 *  downscaling is the only direction that doesn't lose detail. */
const SLOT = 112;

export function PageHeading({ title, subtitle, image, action }: PageHeadingProps) {
  return (
    <div className="page-head">
      <div className="page-head-main">
        {image ? (
          <Image
            className="page-head-art"
            src={image}
            alt=""
            width={SLOT}
            height={SLOT}
            /* Decorative: the title beside it already names the screen, so a
               description here would just make a screen reader say it twice. */
            aria-hidden="true"
            priority
            /* Next's optimizer was serving `w=128&q=75` — it threw away the 360px
               detail and re-encoded an already-lossy WebP a second time, which
               on fine linework shows as visible softening, and left only 1.14x
               the displayed size so it blurred on any retina screen. These files
               are already hand-trimmed WebP at exactly 3x the slot and weigh
               9-20 KB, so there is nothing for the optimizer to win and a
               re-encode to lose. Serve them untouched. */
            unoptimized
          />
        ) : null}
        <div>
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}
