import puppeteer from "puppeteer";
import fs from "fs";

(async () => {
  console.log("Launching browser...");
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // Set viewport to simulate a desktop app window
  await page.setViewport({ width: 1024, height: 768, deviceScaleFactor: 2 });
  
  // We need to inject a script to make the background color match the electron window
  // since the electron window handles the base color.
  console.log("Navigating to http://localhost:5173...");
  await page.goto("http://localhost:5173", { waitUntil: "networkidle0" });
  
  // Add a dark background to the body since it relies on the electron window
  await page.evaluate(() => {
    document.body.style.backgroundColor = "#1E1E1E";
    // Also simulate being the active window (no rounded corners needed for raw screenshot)
  });

  // Make sure docs dir exists
  if (!fs.existsSync("docs")) fs.mkdirSync("docs");

  console.log("Capturing home.png...");
  await page.screenshot({ path: "docs/screenshot-home.png" });

  console.log("Scrolling to rules...");
  await page.evaluate(() => {
    document.querySelector("main")?.scrollBy(0, 300);
  });
  // Wait a bit for scroll animation
  await new Promise(r => setTimeout(r, 500));
  console.log("Capturing rules.png...");
  await page.screenshot({ path: "docs/screenshot-rules.png" });

  console.log("Closing browser...");
  await browser.close();
  console.log("Done!");
})();
