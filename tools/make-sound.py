"""Create an original, quiet 14.5-second ambient cue. No samples or downloads."""
import sys
import wave
import numpy as np

rate = 44100
duration = 14.5
t = np.arange(int(duration * rate)) / rate
audio = np.zeros_like(t)
# A restrained suspended chord, with a soft attack and a long tail.
for frequency, level in [(130.81, .045), (196.0, .032), (261.63, .024), (293.66, .016)]:
    audio += level * np.sin(2 * np.pi * frequency * t) * (1 + .1 * np.sin(2 * np.pi * .2 * t))
rng = np.random.default_rng(24)
noise = rng.normal(0, 1, len(t))
noise = np.convolve(noise, np.ones(100) / 100, mode="same")
for center, spread in [(1.4, .7), (4.8, .85), (8.7, .65), (9.7, .22)]:
    audio += .2 * noise * np.exp(-.5 * ((t - center) / spread) ** 2)
for start, frequency in [(10.1, 523.25), (10.42, 783.99)]:
    age = np.maximum(0, t - start)
    audio += .045 * np.sin(2 * np.pi * frequency * age) * np.exp(-age * 2) * np.minimum(age / .04, 1) * (t >= start)
audio *= np.minimum(t / 1.3, 1) * np.clip((duration - t) / 1.6, 0, 1)
with wave.open(sys.argv[1], "wb") as output:
    output.setnchannels(1)
    output.setsampwidth(2)
    output.setframerate(rate)
    output.writeframes((np.clip(audio, -1, 1) * 32767).astype("<i2").tobytes())
