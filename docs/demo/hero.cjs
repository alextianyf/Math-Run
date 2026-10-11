// Builds the README banner (light and dark) and the link-preview card from real
// captures of the game: a 7 written on the talisman with the mouse, and the moment
// the talismans fly at both yokai whose answer is 7.
// Run from the repository root, with the game served locally (see README.md here).
const fs = require("node:fs/promises");
const path = require("node:path");
const { launch, openGame, startRun, setParade, writeSeven, waitForCast } = require("./game.cjs");
const { banner, card, themes } = require("./banner.cjs");

(async () => {
  const root = path.resolve(__dirname, "../..");
  const output = path.join(root, "docs/media");
  const scratch = path.join(root, "artifacts/readme-hero");
  await fs.mkdir(scratch, { recursive: true });

  const browser = await launch();
  try {
    // 1. the real game: write a 7, catch the talisman, then the cast
    const { page, errors } = await openGame(browser);
    await startRun(page);
    await setParade(page, { near: 4, speed: 0.6 });
    await page.waitForTimeout(1200);
    await writeSeven(page);
    await page.waitForTimeout(350);
    // the talisman alone, on a transparent background (its corners are rounded)
    const hide = await page.addStyleTag({ content: "html,body,#app,#dock{background:transparent!important}#stage,#ai-panel{visibility:hidden}" });
    await page.locator("#talisman").screenshot({ path: path.join(scratch, "talisman.png"), omitBackground: true });
    await hide.evaluate((style) => style.remove());
    // the moment the talismans fly — without the "Double banish!" caption over the
    // equations, and cropped to the scene (the talisman already has its own card)
    await page.addStyleTag({ content: "#banner{visibility:hidden}" });
    await waitForCast(page);
    await page.waitForTimeout(140);
    await page.screenshot({ path: path.join(scratch, "shot.png"), clip: { x: 0, y: 0, width: 1010, height: 630 } });
    if (errors.length) throw new Error(`game errors: ${errors.join("; ")}`);
    await page.close();

    // 2. compose: banner in both themes, and the preview card
    const read = async (file) => (await fs.readFile(path.join(scratch, file))).toString("base64");
    const parts = {
      shot: await read("shot.png"),
      talisman: await read("talisman.png"),
      logo: `data:image/svg+xml;base64,${(await fs.readFile(path.join(root, "favicon.svg"))).toString("base64")}`,
    };
    const render = async (html, viewport, file, options = {}) => {
      const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
      await page.setContent(html);
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all([...document.images].map((image) => image.decode()));
      });
      await page.screenshot({ path: path.join(output, file), ...options });
      await page.close();
    };
    for (const theme of Object.keys(themes)) {
      await render(banner({ theme, ...parts }), { width: 1500, height: 500 }, theme === "light" ? "hero.png" : `hero-${theme}.png`);
    }
    await render(card({ theme: "dark", ...parts }), { width: 1200, height: 630 }, "social-card.jpg", { type: "jpeg", quality: 90 });
  } finally {
    await browser.close();
  }
  console.log("Generated hero.png, hero-dark.png and social-card.jpg in docs/media/ from real game captures.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
