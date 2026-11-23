import test from "node:test";
import assert from "node:assert/strict";
import { cameraAt, speedIntegral, layerAt, FOCAL_LENGTH } from "../assets/motion.js";

test("the flight never reverses or zooms inward", () => {
  let previous = cameraAt(0, 1440, 800);
  for (let t = 1 / 120; t <= 7.75; t += 1 / 120) {
    const pose = cameraAt(t, 1440, 800);
    assert.ok(pose.focus >= previous.focus);
    assert.ok(pose.distance >= previous.distance);
    previous = pose;
  }
});

test("integrated cruise is constant, not a set of position keys", () => {
  for (let t = 1.7; t < 7.1; t += .1) {
    assert.ok(Math.abs(speedIntegral(t + .1) - speedIntegral(t) - .1) < 1e-10);
  }
});

for (const [width, height] of [[1440, 800], [1440, 1100], [900, 680], [900, 1130], [900, 1415]]) {
  test("the flying page fits horizontally at " + width + " by " + height, () => {
    for (let t = 0; t <= 7.75; t += 1 / 30) {
      const pose = cameraAt(t, width, height);
      const angle = pose.tilt * Math.PI / 180;
      for (let y = 0; y <= 6000; y += 25) {
        const delta = y - pose.focus;
        const depth = pose.distance - Math.sin(angle) * delta;
        if (depth <= 0) continue;
        const scale = FOCAL_LENGTH / depth;
        const screenY = height / 2 + Math.cos(angle) * delta * scale;
        if (screenY < 0 || screenY > height) continue;
        assert.ok(1200 * scale <= width + .001, "page edge clipped at " + t + "s, y=" + y);
      }
    }
  });
  test("camera joins are continuous at " + width + " by " + height, () => {
    for (const t of [7.75, 8.15, 8.3, 8.95, 9.25, 9.47, 9.7, 9.97]) {
      const before = cameraAt(t - .00001, width, height);
      const after = cameraAt(t + .00001, width, height);
      for (const key of ["focus", "distance", "tilt"]) assert.ok(Math.abs(before[key] - after[key]) < 5, key + " at " + t);
    }
  });
  test("the final hero fits the viewport at " + width + " by " + height, () => {
    const pose = cameraAt(14.5, width, height);
    const scale = FOCAL_LENGTH / pose.distance;
    const top = height / 2 - pose.focus * scale;
    assert.ok(top >= 265);
    assert.ok(top + 900 * scale <= height);
    assert.ok(1200 * scale <= width);
  });
  test("all layer and camera values stay finite at " + width + " by " + height, () => {
    for (let t = 0; t <= 14.5; t += 1 / 60) {
      const pose = cameraAt(t, width, height);
      assert.ok(Object.values(pose).every(Number.isFinite));
      for (const y of [560, 1530, 2780, 4030]) {
        const layer = layerAt(t, y, pose);
        assert.ok(Object.values(layer).every(Number.isFinite));
        assert.ok(layer.opacity >= 0 && layer.opacity <= 1);
        assert.ok(layer.blur >= 0 && layer.blur <= 18);
      }
    }
  });
}
