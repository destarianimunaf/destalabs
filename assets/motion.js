// A continuous camera path in page pixels. No frame-dependent position keys.
export const DURATION = 14.5;
export const PAGE_HEIGHT = 6000;
export const FOCAL_LENGTH = 1880;
const SPEED = [[0, 0], [.6, .5], [1.25, .5], [1.6, 1], [7.3, 1], [8.3, .12]];
export const clamp = (v, low = 0, high = 1) => Math.min(high, Math.max(low, v));
export const mix = (a, b, p) => a + (b - a) * p;
export const smooth = v => { const p = clamp(v); return p * p * (3 - 2 * p); };
const smoother = v => { const p = clamp(v); return p ** 3 * (p * (p * 6 - 15) + 10); };
const quadratic = p => p < .5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
const logMix = (a, b, p) => Math.exp(mix(Math.log(a), Math.log(b), p));

export function speedIntegral(time) {
  let total = 0;
  for (let i = 1; i < SPEED.length; i++) {
    const [start, a] = SPEED[i - 1];
    const [end, b] = SPEED[i];
    const u = clamp((time - start) / (end - start));
    total += (end - start) * (a * u + (b - a) * (u ** 3 - .5 * u ** 4));
  }
  return total;
}

export function cameraAt(time, width, height) {
  const t = clamp(time, 0, DURATION);
  const cruise = (5650 - 560) / speedIntegral(8.3);
  let focus = 560 + cruise * speedIntegral(Math.min(t, 8.3));
  let tilt = 56;
  // Keep the full page width inside the frustum, including its nearer edge.
  // Tall mobile frames need more distance than the wide desktop studio.
  const framingDistance = 1200 / width * (FOCAL_LENGTH + height / 2 * Math.tan(tilt * Math.PI / 180));
  let distance = mix(2000, 2400, smooth(t / 8.2)) + Math.max(0, framingDistance - 2000);
  const overviewScale = Math.max(.05, (height - 100) / PAGE_HEIGHT);
  const overviewDistance = FOCAL_LENGTH / overviewScale;
  const bottom = height / 2 - 42;
  if (t >= 7.75) {
    distance = logMix(distance, overviewDistance, smoother((t - 7.75) / 1.5));
    tilt *= 1 - smooth((t - 8.15) / .8);
    const angle = tilt * Math.PI / 180;
    const pinnedFocus = PAGE_HEIGHT - bottom * distance /
      (FOCAL_LENGTH * Math.cos(angle) + bottom * Math.sin(angle));
    focus = mix(focus, pinnedFocus, smooth((t - 7.75) / .55));
  }
  if (t >= 9.25) {
    distance = overviewDistance / (1 + .035 * smooth((t - 9.25) / .22));
    tilt = 0;
    focus = PAGE_HEIGHT - bottom * distance / FOCAL_LENGTH;
  }
  const cardTop = Math.max(265, height * .3);
  const cardScale = Math.min(width * .76 / 1200, (height - cardTop - 32) / 900);
  if (t >= 9.47) {
    const p = quadratic(clamp((t - 9.47) / .5));
    distance = logMix(overviewDistance / 1.035, FOCAL_LENGTH / cardScale, p);
    const startTop = height - 42 - PAGE_HEIGHT * overviewScale * 1.035;
    let top = mix(startTop, 0, smooth((t - 9.47) / .10));
    top = mix(top, cardTop, smooth((t - 9.70) / .27));
    focus = (height / 2 - top) * distance / FOCAL_LENGTH;
  }
  if (t >= 9.97) {
    distance = FOCAL_LENGTH / (cardScale * (1 + .02 * smooth((t - 9.97) / 4.53)));
    focus = (height / 2 - cardTop) * distance / FOCAL_LENGTH;
  }
  return { focus, distance, tilt, z: FOCAL_LENGTH - distance, cardTop };
}

export function layerAt(time, center, camera) {
  const angle = camera.tilt * Math.PI / 180;
  const passed = smooth((camera.focus + 700 - center) / 700);
  const end = 1 - smooth((time - 8.15) / 1.1);
  const lift = passed * end * (center < 900 ? smooth((time - .1) / 1.5) : 1);
  const z = lift * 110;
  const depth = camera.distance - Math.sin(angle) * (center - camera.focus) - Math.cos(angle) * z;
  const delta = camera.distance - depth;
  const blur = clamp((delta > 0 ? 75 : -6) * delta / Math.max(300, depth), 0, 18) * end;
  return { z, rotation: -46 * lift, blur, opacity: smooth((depth - 120) / 280) };
}
