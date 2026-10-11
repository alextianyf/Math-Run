// Records the README demo from the real game in headless Edge: yokai walk in with
// their equations, a 7 is written on the talisman with the mouse, the model reads
// it, and one talisman banishes both yokai whose answer is 7.
// Frames (with their real timing) go to artifacts/readme-demo/; encode.py turns
// them into docs/media/demo.gif. Run from the repository root (see README.md here).
const fs = require("node:fs/promises");
const path = require("node:path");
const { launch, openGame, startRun, setParade, writeSeven, waitForCast } = require("./game.cjs");

(async () => {
  const root = path.resolve(__dirname, "../..");
  const output = path.join(root, "artifacts/readme-demo");
  await fs.mkdir(output, { recursive: true });
  for (const file of await fs.readdir(output)) await fs.rm(path.join(output, file), { recursive: true, force: true });

  const browser = await launch();
  try {
    const { page, errors } = await openGame(browser);
    await startRun(page);
    await setParade(page, { near: -6, speed: 2.2 });
    await page.waitForTimeout(300);              // let the equation tags settle in

    // the page's own compositor frames, as they are drawn (smoother than screenshots)
    const cdp = await page.context().newCDPSession(page);
    const frames = [];
    let stage = "parade";
    let start = null;
    let poster = null;
    cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
      await cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
      start ??= metadata.timestamp;
      const at = Math.round((metadata.timestamp - start) * 1000);
      const file = `frame-${String(frames.length).padStart(4, "0")}.jpg`;
      frames.push({ file, at, stage });
      await fs.writeFile(path.join(output, file), Buffer.from(data, "base64"));
    });
    await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 1280, maxHeight: 800 });

    await page.waitForTimeout(1800);            // 1. the parade walks in
    stage = "write";
    await writeSeven(page);                      // 2. handwrite the answer; the AI reads it
    await waitForCast(page);
    stage = "banish";                            // 3. one talisman, every yokai with that answer
    await page.waitForTimeout(450);
    poster = frames.length - 1;                  // the talismans mid-flight make the still image
    await page.waitForTimeout(1900);

    await cdp.send("Page.stopScreencast");
    await page.waitForTimeout(200);
    if (errors.length) throw new Error(`game errors: ${errors.join("; ")}`);
    const duration = frames.at(-1).at + 100;
    await fs.writeFile(
      path.join(output, "frames.json"),
      JSON.stringify({ frames, duration, posterFile: frames[poster].file }, null, 2),
    );
    console.log(`Recorded ${frames.length} frames over ${(duration / 1000).toFixed(1)} s to artifacts/readme-demo/.`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
