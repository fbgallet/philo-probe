// A single page holding every generated figure, so they can be looked at
// together rather than opened one file at a time. Written by `npm run charts`
// beside the SVGs; open results/charts/index.html in any browser.
//
// It is also the seed of the printable version: the @media print rules here are
// what a full article page would inherit.

export function contactSheet(locales: string[], figures: Array<[string, string]>): string {
  const section = (loc: string) => `
    <section>
      <h2>${loc === "fr" ? "Français" : "English"}</h2>
      ${figures
        .map(
          ([file, caption]) => `
      <figure>
        <img src="${loc}/${file}.svg" alt="${caption}">
        <figcaption>${caption} — <code>${loc}/${file}.svg</code></figcaption>
      </figure>`,
        )
        .join("")}
    </section>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Figures — philo-probe</title>
<style>
  :root { color-scheme: light dark; }
  body {
    margin: 0 auto; padding: 2.5rem 1.5rem 4rem; max-width: 62rem;
    font: 16px/1.6 ui-sans-serif, -apple-system, "Segoe UI", Roboto, sans-serif;
    color: #1c1917; background: #fff;
  }
  h1 { font-size: 1.5rem; margin: 0 0 .3rem; }
  .lede { color: #78716c; margin: 0 0 2.5rem; max-width: 44rem; }
  h2 {
    font-size: .8rem; text-transform: uppercase; letter-spacing: .09em;
    color: #78716c; border-bottom: 1px solid #e7e5e4;
    padding-bottom: .5rem; margin: 3rem 0 1.5rem;
  }
  figure { margin: 0 0 2.5rem; }
  /* The SVGs carry their own width; cap them and let them scale down. */
  img { display: block; width: 100%; max-width: 100%; height: auto; }
  figcaption { color: #78716c; font-size: .8rem; margin-top: .5rem; }
  code { font-size: .95em; color: #57534e; }
  @media (prefers-color-scheme: dark) {
    body { color: #e7e5e4; background: #1c1917; }
    /* The figures are drawn on white, so they keep a light card in dark mode. */
    img { background: #fff; border-radius: 4px; }
    h2 { border-color: #44403c; }
  }
  @media print {
    body { max-width: none; padding: 0; color: #000; background: #fff; }
    h2 { break-before: page; }
    section:first-of-type h2 { break-before: auto; }
    figure { break-inside: avoid; }
  }
</style>
</head>
<body>
<h1>Figures</h1>
<p class="lede">Generated from the collected answers by <code>npm run charts</code>.
Re-run it after any change to the data: a figure that disagrees with the write-up
means one of the two is out of date.</p>
${locales.map(section).join("")}
</body>
</html>
`;
}
