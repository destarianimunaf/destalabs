// Run the static server first, then: node tools/render-flyover.mjs
// Requires Chrome's CDP endpoint (CDP_URL), ffmpeg, Python and NumPy.
// Public pages only use the resulting MP4s, not the live CSS 3D scene.
import { spawn, spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const scratch = root + ".film-render/";
await mkdir(scratch, { recursive: true });
const sound = spawnSync("python", [root + "tools/make-sound.py", scratch + "sound.wav"], { stdio: "inherit" });
if (sound.status !== 0) throw new Error("Sound generation failed");
const endpoint = process.env.CDP_URL || "http://localhost:29229";
const { webSocketDebuggerUrl } = await (await fetch(endpoint + "/json/version")).json();
const socket = new WebSocket(webSocketDebuggerUrl);
await once(socket, "open");
let sequence = 0;
const pending = new Map();
socket.addEventListener("message", ({ data }) => {
  const result = JSON.parse(data);
  const waiter = pending.get(result.id);
  if (!waiter) return;
  pending.delete(result.id);
  if (result.error) waiter.reject(new Error(JSON.stringify(result.error)));
  else waiter.resolve(result.result);
});
function cdp(method, params = {}, sessionId) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}

try {
  for (const variant of [
    { name: "desktop", width: 1440, height: 920, ratio: 1 },
    { name: "mobile", width: 450, height: 566, ratio: 2 }
  ]) {
    const { targetId } = await cdp("Target.createTarget", { url: "about:blank", background: true });
    const { sessionId } = await cdp("Target.attachToTarget", { targetId, flatten: true });
    const call = (method, params) => cdp(method, params, sessionId);
    const evaluate = async expression => {
      const result = await call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    await call("Page.enable");
    await call("Page.bringToFront");
    await call("Emulation.setDeviceMetricsOverride", {
      width: variant.width, height: variant.height, deviceScaleFactor: variant.ratio, mobile: false
    });
    await call("Page.navigate", { url: (process.env.SCENE_URL || "http://localhost:4173") + "/tools/film-scene.html" });
    await evaluate(`new Promise((resolve, reject) => {
      const deadline = Date.now() + 30000;
      function ready() {
        if (window.renderFilmFrame && window.renderFilmFrame(0)) resolve(true);
        else if (Date.now() > deadline) reject(new Error('Scene did not load'));
        else setTimeout(ready, 50);
      }
      ready();
    })`);
    await evaluate(`document.querySelector('.studio').style.cssText = 'width:${variant.width}px;height:${variant.height}px;border:0;border-radius:0';window.renderFilmFrame(0)`);
    const output = root + "assets/flyover-" + variant.name + ".mp4";
    const encoder = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y",
      "-f", "image2pipe", "-vcodec", "mjpeg", "-framerate", "30", "-i", "pipe:0",
      "-i", scratch + "sound.wav", "-c:v", "libx264", "-preset", "slow", "-crf", "23",
      "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-t", "14.5",
      "-movflags", "+faststart", output], { stdio: ["pipe", "inherit", "inherit"] });
    const completed = once(encoder, "close");
    for (let n = 0; n < 435; n++) {
      await evaluate(`window.renderFilmFrame(${n / 30});new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
      const { data } = await call("Page.captureScreenshot", { format: "jpeg", quality: 93 });
      if (n === 0) await writeFile(scratch + variant.name + "-poster.jpg", Buffer.from(data, "base64"));
      if (!encoder.stdin.write(Buffer.from(data, "base64"))) await once(encoder.stdin, "drain");
      if (n % 90 === 0) console.log(variant.name + ": frame " + n + "/435");
    }
    encoder.stdin.end();
    const [code] = await completed;
    if (code !== 0) throw new Error("ffmpeg failed: " + code);
    await cdp("Target.closeTarget", { targetId });
    const poster = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i",
      scratch + variant.name + "-poster.jpg", "-frames:v", "1", "-quality", "88",
      root + "assets/flyover-" + variant.name + "-poster.webp"], { stdio: "inherit" });
    if (poster.status !== 0) throw new Error("Poster generation failed");
    console.log("Rendered " + output);
  }
} finally {
  socket.close();
}
