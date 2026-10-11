// Drives the real game in headless Microsoft Edge for the README media: open it,
// start a run, set up a parade of yokai, and write a digit on the talisman with
// the mouse — the model then reads that handwriting like any player's.
const { chromium } = require("@playwright/test");

const GAME_URL = process.env.MATHRUN_URL || "http://localhost:8000/";

// headless Edge on the real GPU (WebGL), so frames look like the actual game
const launch = () =>
  chromium.launch({
    channel: "msedge",
    headless: true,
    args: ["--enable-gpu", "--use-angle=d3d11", "--ignore-gpu-blocklist"],
  });

async function openGame(browser, viewport = { width: 1280, height: 800 }) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // English UI and a believable best score; nothing else is stored
  await page.addInitScript(() => {
    localStorage.setItem("mathrun.lang", '"en"');
    localStorage.setItem("mathrun.best", "2480");
  });
  // ?debug exposes window.__mathrun, used below to place the yokai
  await page.goto(new URL("?debug", GAME_URL).href);
  await page.waitForFunction(() => !document.getElementById("btn-start").disabled, null, { timeout: 90000 });
  return { page, errors };
}

// Start from the title, skip the tutorial and wait for the real run
async function startRun(page) {
  await page.click("#btn-start");
  await page.waitForFunction(() => window.__mathrun.S.tut?.step === "yokai");
  await page.click("#tut-skip");
  await page.waitForFunction(() => window.__mathrun.S.mode === "playing" && !window.__mathrun.S.tut, null, { timeout: 15000 });
}

// Four yokai walking in: two share the answer 7, so one talisman banishes both
async function setParade(page, { near = 0, speed = 1.2 } = {}) {
  await page.evaluate(async ({ near, speed }) => {
    const { S, spawn } = window.__mathrun;
    const { removeEnemy } = await import(new URL("js/game/enemies.js", location.href).href);
    for (const e of [...S.enemies]) removeEnemy(e);
    S.spawnTimer = 1e9;                      // no other yokai for now
    const walk = (type, lane, text, answer, z) => {
      const e = spawn(false, { type, lane, text, answer, z: z + near, speed });
      e.age = 2;                             // already fully grown
    };
    walk("onibi", 0, "28 ÷ 4", 7, -16);
    walk("kasa", 2, "3² − 2", 7, -22);
    walk("chochin", 1, "(9 + 6) ÷ 5", 3, -30);
    walk("onibi", 2, "√36 + 2", 8, -40);
  }, { near, speed });
}

// A handwritten 7: across the top, then down to the left (with small pauses, like a hand)
async function writeSeven(page) {
  const box = await page.locator("#pad").boundingBox();
  const at = (x, y) => [box.x + x * box.width, box.y + y * box.height];
  await page.mouse.move(...at(0.25, 0.23));
  await page.mouse.down();
  await page.mouse.move(...at(0.75, 0.21), { steps: 14 });
  await page.waitForTimeout(60);
  await page.mouse.move(...at(0.43, 0.84), { steps: 20 });
  await page.mouse.up();
}

// resolves when the talisman has been read and the cast has begun
const waitForCast = (page) => page.waitForFunction(() => window.__mathrun.S.combo > 0, null, { timeout: 10000 });

module.exports = { launch, openGame, startRun, setParade, writeSeven, waitForCast };
