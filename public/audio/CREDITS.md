# Audio credits

Every file in this folder, where it came from, and its licence. Total: 194 files, 5.34 MB.

All of it is public-domain dedicated (CC0 1.0). Nothing here requires attribution; the credit
below is given because the libraries' author asks for it and because it is the right thing to do.

## Sources

| Library | Author | Licence | Where the licence is stated |
| --- | --- | --- | --- |
| [Versilian Community Sample Library (VCSL)](https://github.com/sgossner/VCSL) | Versilian Studios LLC (Sam Gossner) and contributors | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [`LICENSE`](https://github.com/sgossner/VCSL/blob/master/LICENSE) in the repository; the README adds "no royalties, no credit, no special terms" |
| [VSCO-2 Community Edition](https://github.com/sgossner/VSCO-2-CE) ([homepage](http://vis.versilstudios.net/vsco-community.html)) | Versilian Studios LLC: recorded by Sam Gossner and Simon Dalzell (Ivy Audio), cut by Elan Hickler | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [`LICENSE`](https://github.com/sgossner/VSCO-2-CE/blob/master/LICENSE) in the repository. Its `Readme.txt` permits use "for ANY purpose" and asks, without requiring it, for credit to Versilian Studios / Sam Gossner and Ivy Audio / Simon Dalzell with a link to the homepage, and that the samples themselves not be sold |
| ["IR Estonia Nordea Hall.wav"](https://freesound.org/people/johnnyguitar01/sounds/423803/) | johnnyguitar01 on Freesound | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | The sound's Freesound page |

Licences were read from those pages on 2026-10-09.

## What was done to the files

The instrument samples were cut from the libraries' WAV files with ffmpeg: leading silence trimmed,
the tail shortened and faded, level normalised per file, then encoded to MP3 (LAME VBR, `-q:a 2`,
44.1 kHz). Blown and bowed notes that swell in slowly (the two lowest flute notes, the bowed vibraphone)
start a little way into the recording. Nothing was pitch-shifted on disk; the pitch each melodic file sounds at was
measured and is listed in `src/fx/music/samples.ts`, which repitches at playback.

`hall_ir.mp3` is Freesound's own high-quality MP3 preview of the impulse response, byte for byte
(the original WAV needs a Freesound login to download). The reverb trims it when it loads.

## Files

### Koto: đàn tranh (Vietnamese plucked zither), two dynamics

| File | Size | Source file | Licence |
| --- | ---: | --- | --- |
| `koto/B2_f.mp3` | 16.6 KB | VCSL: [`Chordophones/Zithers/Dan Tranh/Normal/B1_f_1.wav`](https://github.com/sgossner/VCSL/blob/master/Chordophones/Zithers/Dan%20Tranh/Normal/B1_f_1.wav) | CC0 1.0 |
| `koto/B2_mf.mp3` | 16.8 KB | VCSL: [`Chordophones/Zithers/Dan Tranh/Normal/B1_mf_1.wav`](https://github.com/sgossner/VCSL/blob/master/Chordophones/Zithers/Dan%20Tranh/Normal/B1_mf_1.wav) | CC0 1.0 |
| `koto/Cs3_f.mp3` | 17.4 KB | VCSL: [`Chordophones/Zithers/Dan Tranh/Normal/C#2_f_1.wav`](https://github.com/sgossner/VCSL/blob/master/Chordophones/Zithers/Dan%20Tranh/Normal/C%232_f_1.wav) | CC0 1.0 |
| `koto/Cs3_mf.mp3` | 16.2 KB | VCSL: [`Chordophones/Zithers/Dan Tranh/Normal/C#2_mf_1.wav`](https://github.com/sgossner/VCSL/blob/master/Chordophones/Zithers/Dan%20Tranh/Normal/C%232_mf_1.wav) | CC0 1.0 |
| `koto/Ds3_f.mp3` | 17.9 KB | VCSL: [`Chordophones/Zithers/Dan Tranh/Normal/D#2_f_1.wav`](https://github.com/sgossner/VCSL/blob/master/Chordophones/Zithers/Dan%20Tranh/Normal/D%232_f_1.wav) | CC0 1.0 |
| `koto/Ds3_mf.mp3` | 16.6 KB | VCSL: [`Chordophones/Zithers/Dan Tranh/Normal/D#2_mf_1.wav`](https://github.com/sgossner/VCSL/blob/master/Chordophones/Zithers/Dan%20Tranh/Normal/D%232_mf_1.wav) | CC0 1.0 |
| `koto/Fs3_f.mp3` | 16.8 KB | VCSL: [`Chordophones/Zithers/Dan Tranh/Normal/F#2_f_1.wav`](https://github.com/sgossner/VCSL/blob/master/Chordophones/Zithers/Dan%20Tranh/Normal/F%232_f_1.wav) | CC0 1.0 |
| `koto/Fs3_mf.mp3` | 16.7 KB | VCSL: [`Chordophones/Zithers/Dan Tranh/Normal/F#2_mf_1.wav`](https://github.com/sgossner/VCSL/blob/master/Chordophones/Zithers/Dan%20Tranh/Normal/F%232_mf_1.wav) | CC0 1.0 |
| `koto/Gs3_f.mp3` | 17.0 KB | VCSL: [`Chordophones/Zithers/Dan Tranh/Normal/G#2_f_1.wav`](https://github.com/sgossner/VCSL/blob/master/Chordophones/Zithers/Dan%20Tranh/Normal/G%232_f_1.wav) | CC0 1.0 |
| `koto/Gs3_mf.mp3` | 16.2 KB | VCSL: [`Chordophones/Zithers/Dan Tranh/Normal/G#2_mf_1.wav`](https://github.com/sgossner/VCSL/blob/master/Chordophones/Zithers/Dan%20Tranh/Normal/G%232_mf_1.wav) | CC0 1.0 |
| `koto/B3_f.mp3` | 16.5 KB | VCSL: [`Chordophones/Zithers/Dan Tranh/Normal/B2_f_1.wav`](https://github.com/sgossner/VCSL/blob/master/Chordophones/Zithers/Dan%20Tranh/Normal/B2_f_1.wav) | CC0 1.0 |
| `koto/B3_mf.mp3` | 15.9 KB | VCSL: [`Chordophones/Zithers/Dan Tranh/Normal/B2_mf_1.wav`](https://github.com/sgossner/VCSL/blob/master/Chordophones/Zithers/Dan%20Tranh/Normal/B2_mf_1.wav) | CC0 1.0 |
| `koto/Cs4_f.mp3` | 16.5 KB | VCSL: [`Chordophones/Zithers/Dan Tranh/Normal/C#3_f_1.wav`](https://github.com/sgossner/VCSL/blob/master/Chordophones/Zithers/Dan%20Tranh/Normal/C%233_f_1.wav) | CC0 1.0 |
| `koto/Cs4_mf.mp3` | 15.6 KB | VCSL: [`Chordophones/Zithers/Dan Tranh/Normal/C#3_mf_1.wav`](https://github.com/sgossner/VCSL/blob/master/Chordophones/Zithers/Dan%20Tranh/Normal/C%233_mf_1.wav) | CC0 1.0 |
| `koto/Ds4_f.mp3` | 17.0 KB | VCSL: [`Chordophones/Zithers/Dan Tranh/Normal/D#3_f_1.wav`](https://github.com/sgossner/VCSL/blob/master/Chordophones/Zithers/Dan%20Tranh/Normal/D%233_f_1.wav) | CC0 1.0 |
| `koto/Ds4_mf.mp3` | 17.9 KB | VCSL: [`Chordophones/Zithers/Dan Tranh/Normal/D#3_mf_1.wav`](https://github.com/sgossner/VCSL/blob/master/Chordophones/Zithers/Dan%20Tranh/Normal/D%233_mf_1.wav) | CC0 1.0 |
| `koto/Fs4_f.mp3` | 17.1 KB | VCSL: [`Chordophones/Zithers/Dan Tranh/Normal/F#3_f_1.wav`](https://github.com/sgossner/VCSL/blob/master/Chordophones/Zithers/Dan%20Tranh/Normal/F%233_f_1.wav) | CC0 1.0 |
| `koto/Fs4_mf.mp3` | 15.4 KB | VCSL: [`Chordophones/Zithers/Dan Tranh/Normal/F#3_mf_1.wav`](https://github.com/sgossner/VCSL/blob/master/Chordophones/Zithers/Dan%20Tranh/Normal/F%233_mf_1.wav) | CC0 1.0 |
| `koto/Gs4_f.mp3` | 16.5 KB | VCSL: [`Chordophones/Zithers/Dan Tranh/Normal/G#3_f_1.wav`](https://github.com/sgossner/VCSL/blob/master/Chordophones/Zithers/Dan%20Tranh/Normal/G%233_f_1.wav) | CC0 1.0 |
| `koto/Gs4_mf.mp3` | 15.5 KB | VCSL: [`Chordophones/Zithers/Dan Tranh/Normal/G#3_mf_1.wav`](https://github.com/sgossner/VCSL/blob/master/Chordophones/Zithers/Dan%20Tranh/Normal/G%233_mf_1.wav) | CC0 1.0 |
| `koto/B4_f.mp3` | 17.8 KB | VCSL: [`Chordophones/Zithers/Dan Tranh/Normal/B3_f_1.wav`](https://github.com/sgossner/VCSL/blob/master/Chordophones/Zithers/Dan%20Tranh/Normal/B3_f_1.wav) | CC0 1.0 |
| `koto/B4_mf.mp3` | 15.9 KB | VCSL: [`Chordophones/Zithers/Dan Tranh/Normal/B3_mf_1.wav`](https://github.com/sgossner/VCSL/blob/master/Chordophones/Zithers/Dan%20Tranh/Normal/B3_mf_1.wav) | CC0 1.0 |
| `koto/Cs5_f.mp3` | 16.9 KB | VCSL: [`Chordophones/Zithers/Dan Tranh/Normal/C#4_f_1.wav`](https://github.com/sgossner/VCSL/blob/master/Chordophones/Zithers/Dan%20Tranh/Normal/C%234_f_1.wav) | CC0 1.0 |
| `koto/Cs5_mf.mp3` | 15.3 KB | VCSL: [`Chordophones/Zithers/Dan Tranh/Normal/C#4_mf_1.wav`](https://github.com/sgossner/VCSL/blob/master/Chordophones/Zithers/Dan%20Tranh/Normal/C%234_mf_1.wav) | CC0 1.0 |
| `koto/Ds5_f.mp3` | 17.5 KB | VCSL: [`Chordophones/Zithers/Dan Tranh/Normal/D#4_f_1.wav`](https://github.com/sgossner/VCSL/blob/master/Chordophones/Zithers/Dan%20Tranh/Normal/D%234_f_1.wav) | CC0 1.0 |
| `koto/Ds5_mf.mp3` | 16.7 KB | VCSL: [`Chordophones/Zithers/Dan Tranh/Normal/D#4_mf_1.wav`](https://github.com/sgossner/VCSL/blob/master/Chordophones/Zithers/Dan%20Tranh/Normal/D%234_mf_1.wav) | CC0 1.0 |
| `koto/Fs5_f.mp3` | 17.7 KB | VCSL: [`Chordophones/Zithers/Dan Tranh/Normal/F#4_f_1.wav`](https://github.com/sgossner/VCSL/blob/master/Chordophones/Zithers/Dan%20Tranh/Normal/F%234_f_1.wav) | CC0 1.0 |
| `koto/Fs5_mf.mp3` | 16.2 KB | VCSL: [`Chordophones/Zithers/Dan Tranh/Normal/F#4_mf_1.wav`](https://github.com/sgossner/VCSL/blob/master/Chordophones/Zithers/Dan%20Tranh/Normal/F%234_mf_1.wav) | CC0 1.0 |
| `koto/Gs5_f.mp3` | 17.0 KB | VCSL: [`Chordophones/Zithers/Dan Tranh/Normal/G#4_f_1.wav`](https://github.com/sgossner/VCSL/blob/master/Chordophones/Zithers/Dan%20Tranh/Normal/G%234_f_1.wav) | CC0 1.0 |
| `koto/Gs5_mf.mp3` | 16.0 KB | VCSL: [`Chordophones/Zithers/Dan Tranh/Normal/G#4_mf_1.wav`](https://github.com/sgossner/VCSL/blob/master/Chordophones/Zithers/Dan%20Tranh/Normal/G%234_mf_1.wav) | CC0 1.0 |
| `koto/B5_f.mp3` | 13.9 KB | VCSL: [`Chordophones/Zithers/Dan Tranh/Normal/B4_f_1.wav`](https://github.com/sgossner/VCSL/blob/master/Chordophones/Zithers/Dan%20Tranh/Normal/B4_f_1.wav) | CC0 1.0 |
| `koto/B5_mf.mp3` | 13.0 KB | VCSL: [`Chordophones/Zithers/Dan Tranh/Normal/B4_mf_1.wav`](https://github.com/sgossner/VCSL/blob/master/Chordophones/Zithers/Dan%20Tranh/Normal/B4_mf_1.wav) | CC0 1.0 |

### Harp: concert harp

| File | Size | Source file | Licence |
| --- | ---: | --- | --- |
| `harp/F2.mp3` | 27.9 KB | VSCO-2 CE: [`Strings/Harp/KSHarp_F2_mf.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Strings/Harp/KSHarp_F2_mf.wav) | CC0 1.0 |
| `harp/A2.mp3` | 27.6 KB | VSCO-2 CE: [`Strings/Harp/KSHarp_A2_mf.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Strings/Harp/KSHarp_A2_mf.wav) | CC0 1.0 |
| `harp/C3.mp3` | 27.7 KB | VSCO-2 CE: [`Strings/Harp/KSHarp_C3_mf.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Strings/Harp/KSHarp_C3_mf.wav) | CC0 1.0 |
| `harp/E3.mp3` | 27.9 KB | VSCO-2 CE: [`Strings/Harp/KSHarp_E3_mf.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Strings/Harp/KSHarp_E3_mf.wav) | CC0 1.0 |
| `harp/G3.mp3` | 25.6 KB | VSCO-2 CE: [`Strings/Harp/KSHarp_G3_mf.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Strings/Harp/KSHarp_G3_mf.wav) | CC0 1.0 |
| `harp/B3.mp3` | 25.5 KB | VSCO-2 CE: [`Strings/Harp/KSHarp_B3_mf.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Strings/Harp/KSHarp_B3_mf.wav) | CC0 1.0 |
| `harp/D4.mp3` | 26.5 KB | VSCO-2 CE: [`Strings/Harp/KSHarp_D4_mf.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Strings/Harp/KSHarp_D4_mf.wav) | CC0 1.0 |
| `harp/F4.mp3` | 22.7 KB | VSCO-2 CE: [`Strings/Harp/KSHarp_F4_mf.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Strings/Harp/KSHarp_F4_mf.wav) | CC0 1.0 |
| `harp/A4.mp3` | 26.4 KB | VSCO-2 CE: [`Strings/Harp/KSHarp_A4_mf.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Strings/Harp/KSHarp_A4_mf.wav) | CC0 1.0 |
| `harp/C5.mp3` | 26.5 KB | VSCO-2 CE: [`Strings/Harp/KSHarp_C5_mf.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Strings/Harp/KSHarp_C5_mf.wav) | CC0 1.0 |
| `harp/E5.mp3` | 24.5 KB | VSCO-2 CE: [`Strings/Harp/KSHarp_E5_mf.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Strings/Harp/KSHarp_E5_mf.wav) | CC0 1.0 |
| `harp/G5.mp3` | 28.6 KB | VSCO-2 CE: [`Strings/Harp/KSHarp_G5_mf.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Strings/Harp/KSHarp_G5_mf.wav) | CC0 1.0 |

### Grand piano, dampers down (the Tyler and Kash themes)

| File | Size | Source file | Licence |
| --- | ---: | --- | --- |
| `piano/E2.mp3` | 21.5 KB | VCSL: [`Chordophones/Zithers/Grand Piano, Steinway B/NoSus/JHPiano_NoSus_Close_E2_vl3_rr1.wav`](https://github.com/sgossner/VCSL/blob/master/Chordophones/Zithers/Grand%20Piano,%20Steinway%20B/NoSus/JHPiano_NoSus_Close_E2_vl3_rr1.wav) | CC0 1.0 |
| `piano/Gs2.mp3` | 22.0 KB | VCSL: [`Chordophones/Zithers/Grand Piano, Steinway B/NoSus/JHPiano_NoSus_Close_G#2_vl3_rr1.wav`](https://github.com/sgossner/VCSL/blob/master/Chordophones/Zithers/Grand%20Piano,%20Steinway%20B/NoSus/JHPiano_NoSus_Close_G%232_vl3_rr1.wav) | CC0 1.0 |
| `piano/C3.mp3` | 21.4 KB | VCSL: [`Chordophones/Zithers/Grand Piano, Steinway B/NoSus/JHPiano_NoSus_Close_C3_vl3_rr1.wav`](https://github.com/sgossner/VCSL/blob/master/Chordophones/Zithers/Grand%20Piano,%20Steinway%20B/NoSus/JHPiano_NoSus_Close_C3_vl3_rr1.wav) | CC0 1.0 |
| `piano/E3.mp3` | 24.1 KB | VCSL: [`Chordophones/Zithers/Grand Piano, Steinway B/NoSus/JHPiano_NoSus_Close_E3_vl3_rr1.wav`](https://github.com/sgossner/VCSL/blob/master/Chordophones/Zithers/Grand%20Piano,%20Steinway%20B/NoSus/JHPiano_NoSus_Close_E3_vl3_rr1.wav) | CC0 1.0 |
| `piano/Gs3.mp3` | 22.8 KB | VCSL: [`Chordophones/Zithers/Grand Piano, Steinway B/NoSus/JHPiano_NoSus_Close_G#3_vl3_rr1.wav`](https://github.com/sgossner/VCSL/blob/master/Chordophones/Zithers/Grand%20Piano,%20Steinway%20B/NoSus/JHPiano_NoSus_Close_G%233_vl3_rr1.wav) | CC0 1.0 |
| `piano/C4.mp3` | 24.4 KB | VCSL: [`Chordophones/Zithers/Grand Piano, Steinway B/NoSus/JHPiano_NoSus_Close_C4_vl3_rr1.wav`](https://github.com/sgossner/VCSL/blob/master/Chordophones/Zithers/Grand%20Piano,%20Steinway%20B/NoSus/JHPiano_NoSus_Close_C4_vl3_rr1.wav) | CC0 1.0 |
| `piano/E4.mp3` | 20.9 KB | VCSL: [`Chordophones/Zithers/Grand Piano, Steinway B/NoSus/JHPiano_NoSus_Close_E4_vl3_rr1.wav`](https://github.com/sgossner/VCSL/blob/master/Chordophones/Zithers/Grand%20Piano,%20Steinway%20B/NoSus/JHPiano_NoSus_Close_E4_vl3_rr1.wav) | CC0 1.0 |
| `piano/Gs4.mp3` | 25.0 KB | VCSL: [`Chordophones/Zithers/Grand Piano, Steinway B/NoSus/JHPiano_NoSus_Close_G#4_vl3_rr1.wav`](https://github.com/sgossner/VCSL/blob/master/Chordophones/Zithers/Grand%20Piano,%20Steinway%20B/NoSus/JHPiano_NoSus_Close_G%234_vl3_rr1.wav) | CC0 1.0 |
| `piano/C5.mp3` | 26.4 KB | VCSL: [`Chordophones/Zithers/Grand Piano, Steinway B/NoSus/JHPiano_NoSus_Close_C5_vl3_rr1.wav`](https://github.com/sgossner/VCSL/blob/master/Chordophones/Zithers/Grand%20Piano,%20Steinway%20B/NoSus/JHPiano_NoSus_Close_C5_vl3_rr1.wav) | CC0 1.0 |
| `piano/E5.mp3` | 24.8 KB | VCSL: [`Chordophones/Zithers/Grand Piano, Steinway B/NoSus/JHPiano_NoSus_Close_E5_vl3_rr1.wav`](https://github.com/sgossner/VCSL/blob/master/Chordophones/Zithers/Grand%20Piano,%20Steinway%20B/NoSus/JHPiano_NoSus_Close_E5_vl3_rr1.wav) | CC0 1.0 |
| `piano/Gs5.mp3` | 22.8 KB | VCSL: [`Chordophones/Zithers/Grand Piano, Steinway B/NoSus/JHPiano_NoSus_Close_G#5_vl3_rr1.wav`](https://github.com/sgossner/VCSL/blob/master/Chordophones/Zithers/Grand%20Piano,%20Steinway%20B/NoSus/JHPiano_NoSus_Close_G%235_vl3_rr1.wav) | CC0 1.0 |

### Flute: concert flute, sustained with vibrato (title and battle lead; the water theme)

| File | Size | Source file | Licence |
| --- | ---: | --- | --- |
| `flute/C4.mp3` | 36.7 KB | VSCO-2 CE: [`Woodwinds/Flute/susvib/LDFlute_susvib_C3_v1_1.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Woodwinds/Flute/susvib/LDFlute_susvib_C3_v1_1.wav) | CC0 1.0 |
| `flute/E4.mp3` | 36.9 KB | VSCO-2 CE: [`Woodwinds/Flute/susvib/LDFlute_susvib_E3_v1_1.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Woodwinds/Flute/susvib/LDFlute_susvib_E3_v1_1.wav) | CC0 1.0 |
| `flute/A4.mp3` | 37.9 KB | VSCO-2 CE: [`Woodwinds/Flute/susvib/LDFlute_susvib_A3_v1_1.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Woodwinds/Flute/susvib/LDFlute_susvib_A3_v1_1.wav) | CC0 1.0 |
| `flute/C5.mp3` | 40.4 KB | VSCO-2 CE: [`Woodwinds/Flute/susvib/LDFlute_susvib_C4_v1_1.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Woodwinds/Flute/susvib/LDFlute_susvib_C4_v1_1.wav) | CC0 1.0 |
| `flute/E5.mp3` | 39.5 KB | VSCO-2 CE: [`Woodwinds/Flute/susvib/LDFlute_susvib_E4_v1_1.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Woodwinds/Flute/susvib/LDFlute_susvib_E4_v1_1.wav) | CC0 1.0 |
| `flute/A5.mp3` | 41.8 KB | VSCO-2 CE: [`Woodwinds/Flute/susvib/LDFlute_susvib_A4_v1_1.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Woodwinds/Flute/susvib/LDFlute_susvib_A4_v1_1.wav) | CC0 1.0 |
| `flute/C6.mp3` | 41.2 KB | VSCO-2 CE: [`Woodwinds/Flute/susvib/LDFlute_susvib_C5_v1_1.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Woodwinds/Flute/susvib/LDFlute_susvib_C5_v1_1.wav) | CC0 1.0 |

### Oboe, with vibrato (the fire theme)

| File | Size | Source file | Licence |
| --- | ---: | --- | --- |
| `oboe/As3.mp3` | 35.2 KB | VSCO-2 CE: [`Woodwinds/Oboe/Vib/Oboe_Vib_A#2_v3_Main.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Woodwinds/Oboe/Vib/Oboe_Vib_A%232_v3_Main.wav) | CC0 1.0 |
| `oboe/D4.mp3` | 34.6 KB | VSCO-2 CE: [`Woodwinds/Oboe/Vib/Oboe_Vib_D3_v3_Main.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Woodwinds/Oboe/Vib/Oboe_Vib_D3_v3_Main.wav) | CC0 1.0 |
| `oboe/F4.mp3` | 32.4 KB | VSCO-2 CE: [`Woodwinds/Oboe/Vib/Oboe_Vib_F3_v3_Main.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Woodwinds/Oboe/Vib/Oboe_Vib_F3_v3_Main.wav) | CC0 1.0 |
| `oboe/As4.mp3` | 37.0 KB | VSCO-2 CE: [`Woodwinds/Oboe/Vib/Oboe_Vib_A#3_v3_Main.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Woodwinds/Oboe/Vib/Oboe_Vib_A%233_v3_Main.wav) | CC0 1.0 |
| `oboe/D5.mp3` | 35.0 KB | VSCO-2 CE: [`Woodwinds/Oboe/Vib/Oboe_Vib_D4_v3_Main.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Woodwinds/Oboe/Vib/Oboe_Vib_D4_v3_Main.wav) | CC0 1.0 |
| `oboe/F5.mp3` | 34.3 KB | VSCO-2 CE: [`Woodwinds/Oboe/Vib/Oboe_Vib_F4_v3_Main.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Woodwinds/Oboe/Vib/Oboe_Vib_F4_v3_Main.wav) | CC0 1.0 |
| `oboe/As5.mp3` | 37.6 KB | VSCO-2 CE: [`Woodwinds/Oboe/Vib/Oboe_Vib_A#4_v3_Main.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Woodwinds/Oboe/Vib/Oboe_Vib_A%234_v3_Main.wav) | CC0 1.0 |
| `oboe/D6.mp3` | 36.5 KB | VSCO-2 CE: [`Woodwinds/Oboe/Vib/Oboe_Vib_D5_v3_Main.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Woodwinds/Oboe/Vib/Oboe_Vib_D5_v3_Main.wav) | CC0 1.0 |

### French horn, sustained (the earth theme)

| File | Size | Source file | Licence |
| --- | ---: | --- | --- |
| `horn/G2.mp3` | 29.7 KB | VSCO-2 CE: [`Brass/F Horn/sus/MOHorn_sus_G1_v2_1.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Brass/F%20Horn/sus/MOHorn_sus_G1_v2_1.wav) | CC0 1.0 |
| `horn/As2.mp3` | 32.8 KB | VSCO-2 CE: [`Brass/F Horn/sus/MOHorn_sus_A#1_v2_1.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Brass/F%20Horn/sus/MOHorn_sus_A%231_v2_1.wav) | CC0 1.0 |
| `horn/D3.mp3` | 31.0 KB | VSCO-2 CE: [`Brass/F Horn/sus/MOHorn_sus_D2_v2_1.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Brass/F%20Horn/sus/MOHorn_sus_D2_v2_1.wav) | CC0 1.0 |
| `horn/F3.mp3` | 31.6 KB | VSCO-2 CE: [`Brass/F Horn/sus/MOHorn_sus_F2_v2_1.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Brass/F%20Horn/sus/MOHorn_sus_F2_v2_1.wav) | CC0 1.0 |
| `horn/A3.mp3` | 25.0 KB | VSCO-2 CE: [`Brass/F Horn/sus/MOHorn_sus_A2_v2_1.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Brass/F%20Horn/sus/MOHorn_sus_A2_v2_1.wav) | CC0 1.0 |
| `horn/C4.mp3` | 25.0 KB | VSCO-2 CE: [`Brass/F Horn/sus/MOHorn_sus_C3_v2_1.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Brass/F%20Horn/sus/MOHorn_sus_C3_v2_1.wav) | CC0 1.0 |

### Ocarina, with vibrato (the air theme)

| File | Size | Source file | Licence |
| --- | ---: | --- | --- |
| `ocarina/A4.mp3` | 24.2 KB | VCSL: [`Aerophones/Edge-blown Aerophones/Ocarina, Typical/Sustains/SusVib/StdOcarina_SusVib_A3.wav`](https://github.com/sgossner/VCSL/blob/master/Aerophones/Edge-blown%20Aerophones/Ocarina,%20Typical/Sustains/SusVib/StdOcarina_SusVib_A3.wav) | CC0 1.0 |
| `ocarina/C5.mp3` | 25.7 KB | VCSL: [`Aerophones/Edge-blown Aerophones/Ocarina, Typical/Sustains/SusVib/StdOcarina_SusVib_C4.wav`](https://github.com/sgossner/VCSL/blob/master/Aerophones/Edge-blown%20Aerophones/Ocarina,%20Typical/Sustains/SusVib/StdOcarina_SusVib_C4.wav) | CC0 1.0 |
| `ocarina/Ds5.mp3` | 28.1 KB | VCSL: [`Aerophones/Edge-blown Aerophones/Ocarina, Typical/Sustains/SusVib/StdOcarina_SusVib_D#4.wav`](https://github.com/sgossner/VCSL/blob/master/Aerophones/Edge-blown%20Aerophones/Ocarina,%20Typical/Sustains/SusVib/StdOcarina_SusVib_D%234.wav) | CC0 1.0 |
| `ocarina/Fs5.mp3` | 30.8 KB | VCSL: [`Aerophones/Edge-blown Aerophones/Ocarina, Typical/Sustains/SusVib/StdOcarina_SusVib_F#4.wav`](https://github.com/sgossner/VCSL/blob/master/Aerophones/Edge-blown%20Aerophones/Ocarina,%20Typical/Sustains/SusVib/StdOcarina_SusVib_F%234.wav) | CC0 1.0 |
| `ocarina/A5.mp3` | 34.0 KB | VCSL: [`Aerophones/Edge-blown Aerophones/Ocarina, Typical/Sustains/SusVib/StdOcarina_SusVib_A4.wav`](https://github.com/sgossner/VCSL/blob/master/Aerophones/Edge-blown%20Aerophones/Ocarina,%20Typical/Sustains/SusVib/StdOcarina_SusVib_A4.wav) | CC0 1.0 |
| `ocarina/C6.mp3` | 36.0 KB | VCSL: [`Aerophones/Edge-blown Aerophones/Ocarina, Typical/Sustains/SusVib/StdOcarina_SusVib_C5.wav`](https://github.com/sgossner/VCSL/blob/master/Aerophones/Edge-blown%20Aerophones/Ocarina,%20Typical/Sustains/SusVib/StdOcarina_SusVib_C5.wav) | CC0 1.0 |

### Xylophone (the lightning theme)

| File | Size | Source file | Licence |
| --- | ---: | --- | --- |
| `xylo/G4.mp3` | 8.8 KB | VSCO-2 CE: [`Percussion/Xylo/Xylo_Medium_G3_ff_01_far.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Percussion/Xylo/Xylo_Medium_G3_ff_01_far.wav) | CC0 1.0 |
| `xylo/C5.mp3` | 8.3 KB | VSCO-2 CE: [`Percussion/Xylo/Xylo_Medium_C4_ff_01_far.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Percussion/Xylo/Xylo_Medium_C4_ff_01_far.wav) | CC0 1.0 |
| `xylo/G5.mp3` | 8.5 KB | VSCO-2 CE: [`Percussion/Xylo/Xylo_Medium_G4_ff_01_far.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Percussion/Xylo/Xylo_Medium_G4_ff_01_far.wav) | CC0 1.0 |
| `xylo/C6.mp3` | 7.9 KB | VSCO-2 CE: [`Percussion/Xylo/Xylo_Medium_C5_ff_01_far.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Percussion/Xylo/Xylo_Medium_C5_ff_01_far.wav) | CC0 1.0 |
| `xylo/G6.mp3` | 7.6 KB | VSCO-2 CE: [`Percussion/Xylo/Xylo_Medium_G5_ff_01_far.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Percussion/Xylo/Xylo_Medium_G5_ff_01_far.wav) | CC0 1.0 |
| `xylo/C7.mp3` | 7.5 KB | VSCO-2 CE: [`Percussion/Xylo/Xylo_Medium_C6_ff_01_far.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Percussion/Xylo/Xylo_Medium_C6_ff_01_far.wav) | CC0 1.0 |

### Tubular bells (the metal theme)

| File | Size | Source file | Licence |
| --- | ---: | --- | --- |
| `bells/C4.mp3` | 33.9 KB | VCSL: [`Idiophones/Struck Idiophones/Tubular Bells 1/chimes_C3_f_rr1.wav`](https://github.com/sgossner/VCSL/blob/master/Idiophones/Struck%20Idiophones/Tubular%20Bells%201/chimes_C3_f_rr1.wav) | CC0 1.0 |
| `bells/D4.mp3` | 31.2 KB | VCSL: [`Idiophones/Struck Idiophones/Tubular Bells 1/chimes_D3_ff_rr1.wav`](https://github.com/sgossner/VCSL/blob/master/Idiophones/Struck%20Idiophones/Tubular%20Bells%201/chimes_D3_ff_rr1.wav) | CC0 1.0 |
| `bells/E4.mp3` | 32.1 KB | VCSL: [`Idiophones/Struck Idiophones/Tubular Bells 1/chimes_E3_ff_rr2.wav`](https://github.com/sgossner/VCSL/blob/master/Idiophones/Struck%20Idiophones/Tubular%20Bells%201/chimes_E3_ff_rr2.wav) | CC0 1.0 |
| `bells/Fs4.mp3` | 28.8 KB | VCSL: [`Idiophones/Struck Idiophones/Tubular Bells 1/chimes_F#3_fff_rr1.wav`](https://github.com/sgossner/VCSL/blob/master/Idiophones/Struck%20Idiophones/Tubular%20Bells%201/chimes_F%233_fff_rr1.wav) | CC0 1.0 |
| `bells/Gs4.mp3` | 29.7 KB | VCSL: [`Idiophones/Struck Idiophones/Tubular Bells 1/chimes_G#3_ff_rr1.wav`](https://github.com/sgossner/VCSL/blob/master/Idiophones/Struck%20Idiophones/Tubular%20Bells%201/chimes_G%233_ff_rr1.wav) | CC0 1.0 |
| `bells/As4.mp3` | 30.6 KB | VCSL: [`Idiophones/Struck Idiophones/Tubular Bells 1/chimes_A#3_ff_rr1.wav`](https://github.com/sgossner/VCSL/blob/master/Idiophones/Struck%20Idiophones/Tubular%20Bells%201/chimes_A%233_ff_rr1.wav) | CC0 1.0 |
| `bells/C5.mp3` | 29.7 KB | VCSL: [`Idiophones/Struck Idiophones/Tubular Bells 1/chimes_C4_ff_rr2.wav`](https://github.com/sgossner/VCSL/blob/master/Idiophones/Struck%20Idiophones/Tubular%20Bells%201/chimes_C4_ff_rr2.wav) | CC0 1.0 |
| `bells/D5.mp3` | 31.9 KB | VCSL: [`Idiophones/Struck Idiophones/Tubular Bells 1/chimes_D4_ff_rr2.wav`](https://github.com/sgossner/VCSL/blob/master/Idiophones/Struck%20Idiophones/Tubular%20Bells%201/chimes_D4_ff_rr2.wav) | CC0 1.0 |
| `bells/E5.mp3` | 31.4 KB | VCSL: [`Idiophones/Struck Idiophones/Tubular Bells 1/chimes_E4_ff_rr2.wav`](https://github.com/sgossner/VCSL/blob/master/Idiophones/Struck%20Idiophones/Tubular%20Bells%201/chimes_E4_ff_rr2.wav) | CC0 1.0 |

### Bowed vibraphone (the shadow theme)

| File | Size | Source file | Licence |
| --- | ---: | --- | --- |
| `glass/E4.mp3` | 40.9 KB | VCSL: [`Idiophones/Struck Idiophones/Vibraphone/Bowed/Vibes_bowed_E3_rr1_Main.wav`](https://github.com/sgossner/VCSL/blob/master/Idiophones/Struck%20Idiophones/Vibraphone/Bowed/Vibes_bowed_E3_rr1_Main.wav) | CC0 1.0 |
| `glass/G4.mp3` | 44.2 KB | VCSL: [`Idiophones/Struck Idiophones/Vibraphone/Bowed/Vibes_bowed_G3_rr1_Main.wav`](https://github.com/sgossner/VCSL/blob/master/Idiophones/Struck%20Idiophones/Vibraphone/Bowed/Vibes_bowed_G3_rr1_Main.wav) | CC0 1.0 |
| `glass/D5.mp3` | 40.2 KB | VCSL: [`Idiophones/Struck Idiophones/Vibraphone/Bowed/Vibes_bowed_D4_rr1_Main.wav`](https://github.com/sgossner/VCSL/blob/master/Idiophones/Struck%20Idiophones/Vibraphone/Bowed/Vibes_bowed_D4_rr1_Main.wav) | CC0 1.0 |
| `glass/A5.mp3` | 40.2 KB | VCSL: [`Idiophones/Struck Idiophones/Vibraphone/Bowed/Vibes_bowed_A4_rr1_Main.wav`](https://github.com/sgossner/VCSL/blob/master/Idiophones/Struck%20Idiophones/Vibraphone/Bowed/Vibes_bowed_A4_rr1_Main.wav) | CC0 1.0 |
| `glass/E6.mp3` | 44.6 KB | VCSL: [`Idiophones/Struck Idiophones/Vibraphone/Bowed/Vibes_bowed_E5_rr1_Main.wav`](https://github.com/sgossner/VCSL/blob/master/Idiophones/Struck%20Idiophones/Vibraphone/Bowed/Vibes_bowed_E5_rr1_Main.wav) | CC0 1.0 |

### Vibraphone, hard mallets (the void theme)

| File | Size | Source file | Licence |
| --- | ---: | --- | --- |
| `vibes/C4.mp3` | 17.7 KB | VCSL: [`Idiophones/Struck Idiophones/Vibraphone/Hard Mallets/Vibes_hard_C3_v3_rr1_Main.wav`](https://github.com/sgossner/VCSL/blob/master/Idiophones/Struck%20Idiophones/Vibraphone/Hard%20Mallets/Vibes_hard_C3_v3_rr1_Main.wav) | CC0 1.0 |
| `vibes/E4.mp3` | 21.7 KB | VCSL: [`Idiophones/Struck Idiophones/Vibraphone/Hard Mallets/Vibes_hard_E3_v3_rr1_Main.wav`](https://github.com/sgossner/VCSL/blob/master/Idiophones/Struck%20Idiophones/Vibraphone/Hard%20Mallets/Vibes_hard_E3_v3_rr1_Main.wav) | CC0 1.0 |
| `vibes/G4.mp3` | 22.0 KB | VCSL: [`Idiophones/Struck Idiophones/Vibraphone/Hard Mallets/Vibes_hard_G3_v3_rr1_Main.wav`](https://github.com/sgossner/VCSL/blob/master/Idiophones/Struck%20Idiophones/Vibraphone/Hard%20Mallets/Vibes_hard_G3_v3_rr1_Main.wav) | CC0 1.0 |
| `vibes/B4.mp3` | 19.6 KB | VCSL: [`Idiophones/Struck Idiophones/Vibraphone/Hard Mallets/Vibes_hard_B3_v3_rr1_Main.wav`](https://github.com/sgossner/VCSL/blob/master/Idiophones/Struck%20Idiophones/Vibraphone/Hard%20Mallets/Vibes_hard_B3_v3_rr1_Main.wav) | CC0 1.0 |
| `vibes/D5.mp3` | 18.4 KB | VCSL: [`Idiophones/Struck Idiophones/Vibraphone/Hard Mallets/Vibes_hard_D4_v3_rr1_Main.wav`](https://github.com/sgossner/VCSL/blob/master/Idiophones/Struck%20Idiophones/Vibraphone/Hard%20Mallets/Vibes_hard_D4_v3_rr1_Main.wav) | CC0 1.0 |
| `vibes/F5.mp3` | 18.9 KB | VCSL: [`Idiophones/Struck Idiophones/Vibraphone/Hard Mallets/Vibes_hard_F4_v3_rr1_Main.wav`](https://github.com/sgossner/VCSL/blob/master/Idiophones/Struck%20Idiophones/Vibraphone/Hard%20Mallets/Vibes_hard_F4_v3_rr1_Main.wav) | CC0 1.0 |
| `vibes/A5.mp3` | 18.3 KB | VCSL: [`Idiophones/Struck Idiophones/Vibraphone/Hard Mallets/Vibes_hard_A4_v3_rr1_Main.wav`](https://github.com/sgossner/VCSL/blob/master/Idiophones/Struck%20Idiophones/Vibraphone/Hard%20Mallets/Vibes_hard_A4_v3_rr1_Main.wav) | CC0 1.0 |
| `vibes/C6.mp3` | 17.5 KB | VCSL: [`Idiophones/Struck Idiophones/Vibraphone/Hard Mallets/Vibes_hard_C5_v3_rr1_Main.wav`](https://github.com/sgossner/VCSL/blob/master/Idiophones/Struck%20Idiophones/Vibraphone/Hard%20Mallets/Vibes_hard_C5_v3_rr1_Main.wav) | CC0 1.0 |
| `vibes/E6.mp3` | 17.9 KB | VCSL: [`Idiophones/Struck Idiophones/Vibraphone/Hard Mallets/Vibes_hard_E5_v3_rr1_Main.wav`](https://github.com/sgossner/VCSL/blob/master/Idiophones/Struck%20Idiophones/Vibraphone/Hard%20Mallets/Vibes_hard_E5_v3_rr1_Main.wav) | CC0 1.0 |

### Soprano recorder, sustained (the Tyler theme)

| File | Size | Source file | Licence |
| --- | ---: | --- | --- |
| `recorder/C5.mp3` | 38.4 KB | VCSL: [`Aerophones/Edge-blown Aerophones/Baroque Soprano Recorder/Sustain/SopRecorder_Sus_C4_rr1_Main.wav`](https://github.com/sgossner/VCSL/blob/master/Aerophones/Edge-blown%20Aerophones/Baroque%20Soprano%20Recorder/Sustain/SopRecorder_Sus_C4_rr1_Main.wav) | CC0 1.0 |
| `recorder/E5.mp3` | 38.0 KB | VCSL: [`Aerophones/Edge-blown Aerophones/Baroque Soprano Recorder/Sustain/SopRecorder_Sus_E4_rr1_Main.wav`](https://github.com/sgossner/VCSL/blob/master/Aerophones/Edge-blown%20Aerophones/Baroque%20Soprano%20Recorder/Sustain/SopRecorder_Sus_E4_rr1_Main.wav) | CC0 1.0 |
| `recorder/Gs5.mp3` | 38.0 KB | VCSL: [`Aerophones/Edge-blown Aerophones/Baroque Soprano Recorder/Sustain/SopRecorder_Sus_G#4_rr1_Main.wav`](https://github.com/sgossner/VCSL/blob/master/Aerophones/Edge-blown%20Aerophones/Baroque%20Soprano%20Recorder/Sustain/SopRecorder_Sus_G%234_rr1_Main.wav) | CC0 1.0 |
| `recorder/C6.mp3` | 38.3 KB | VCSL: [`Aerophones/Edge-blown Aerophones/Baroque Soprano Recorder/Sustain/SopRecorder_Sus_C5_rr1_Main.wav`](https://github.com/sgossner/VCSL/blob/master/Aerophones/Edge-blown%20Aerophones/Baroque%20Soprano%20Recorder/Sustain/SopRecorder_Sus_C5_rr1_Main.wav) | CC0 1.0 |
| `recorder/E6.mp3` | 43.9 KB | VCSL: [`Aerophones/Edge-blown Aerophones/Baroque Soprano Recorder/Sustain/SopRecorder_Sus_E5_rr1_Main.wav`](https://github.com/sgossner/VCSL/blob/master/Aerophones/Edge-blown%20Aerophones/Baroque%20Soprano%20Recorder/Sustain/SopRecorder_Sus_E5_rr1_Main.wav) | CC0 1.0 |
| `recorder/G6.mp3` | 37.6 KB | VCSL: [`Aerophones/Edge-blown Aerophones/Baroque Soprano Recorder/Sustain/SopRecorder_Sus_G5_rr1_Main.wav`](https://github.com/sgossner/VCSL/blob/master/Aerophones/Edge-blown%20Aerophones/Baroque%20Soprano%20Recorder/Sustain/SopRecorder_Sus_G5_rr1_Main.wav) | CC0 1.0 |

### Tenor saxophone, no vibrato (the Kash theme)

| File | Size | Source file | Licence |
| --- | ---: | --- | --- |
| `sax/Gs3.mp3` | 29.9 KB | VCSL: [`Aerophones/Reed Aerophones/Tenor Saxophone/Non-Vibrato/BrettTenor_NV_Main_G#2_vl3_rr1.wav`](https://github.com/sgossner/VCSL/blob/master/Aerophones/Reed%20Aerophones/Tenor%20Saxophone/Non-Vibrato/BrettTenor_NV_Main_G%232_vl3_rr1.wav) | CC0 1.0 |
| `sax/C4.mp3` | 35.1 KB | VCSL: [`Aerophones/Reed Aerophones/Tenor Saxophone/Non-Vibrato/BrettTenor_NV_Main_C3_vl3_rr1.wav`](https://github.com/sgossner/VCSL/blob/master/Aerophones/Reed%20Aerophones/Tenor%20Saxophone/Non-Vibrato/BrettTenor_NV_Main_C3_vl3_rr1.wav) | CC0 1.0 |
| `sax/E4.mp3` | 32.8 KB | VCSL: [`Aerophones/Reed Aerophones/Tenor Saxophone/Non-Vibrato/BrettTenor_NV_Main_E3_vl3_rr1.wav`](https://github.com/sgossner/VCSL/blob/master/Aerophones/Reed%20Aerophones/Tenor%20Saxophone/Non-Vibrato/BrettTenor_NV_Main_E3_vl3_rr1.wav) | CC0 1.0 |
| `sax/Gs4.mp3` | 29.2 KB | VCSL: [`Aerophones/Reed Aerophones/Tenor Saxophone/Non-Vibrato/BrettTenor_NV_Main_G#3_vl3_rr1.wav`](https://github.com/sgossner/VCSL/blob/master/Aerophones/Reed%20Aerophones/Tenor%20Saxophone/Non-Vibrato/BrettTenor_NV_Main_G%233_vl3_rr1.wav) | CC0 1.0 |
| `sax/C5.mp3` | 29.1 KB | VCSL: [`Aerophones/Reed Aerophones/Tenor Saxophone/Non-Vibrato/BrettTenor_NV_Main_C4_vl3_rr1.wav`](https://github.com/sgossner/VCSL/blob/master/Aerophones/Reed%20Aerophones/Tenor%20Saxophone/Non-Vibrato/BrettTenor_NV_Main_C4_vl3_rr1.wav) | CC0 1.0 |
| `sax/E5.mp3` | 34.6 KB | VCSL: [`Aerophones/Reed Aerophones/Tenor Saxophone/Non-Vibrato/BrettTenor_NV_Main_E4_vl3_rr1.wav`](https://github.com/sgossner/VCSL/blob/master/Aerophones/Reed%20Aerophones/Tenor%20Saxophone/Non-Vibrato/BrettTenor_NV_Main_E4_vl3_rr1.wav) | CC0 1.0 |

### String pad: cello and violin sections, sustained with vibrato

| File | Size | Source file | Licence |
| --- | ---: | --- | --- |
| `strings/cello_G2.mp3` | 83.6 KB | VSCO-2 CE: [`Strings/Cello Section/susvib/susvib_G1_v1_1.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Strings/Cello%20Section/susvib/susvib_G1_v1_1.wav) | CC0 1.0 |
| `strings/cello_B2.mp3` | 82.8 KB | VSCO-2 CE: [`Strings/Cello Section/susvib/susvib_B1_v1_1.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Strings/Cello%20Section/susvib/susvib_B1_v1_1.wav) | CC0 1.0 |
| `strings/cello_D3.mp3` | 84.9 KB | VSCO-2 CE: [`Strings/Cello Section/susvib/susvib_D2_v1_1.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Strings/Cello%20Section/susvib/susvib_D2_v1_1.wav) | CC0 1.0 |
| `strings/cello_F3.mp3` | 88.2 KB | VSCO-2 CE: [`Strings/Cello Section/susvib/susvib_F2_v1_1.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Strings/Cello%20Section/susvib/susvib_F2_v1_1.wav) | CC0 1.0 |
| `strings/cello_A3.mp3` | 88.8 KB | VSCO-2 CE: [`Strings/Cello Section/susvib/susvib_A2_v1_1.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Strings/Cello%20Section/susvib/susvib_A2_v1_1.wav) | CC0 1.0 |
| `strings/cello_C4.mp3` | 91.9 KB | VSCO-2 CE: [`Strings/Cello Section/susvib/susvib_C3_v1_1.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Strings/Cello%20Section/susvib/susvib_C3_v1_1.wav) | CC0 1.0 |
| `strings/violin_B3.mp3` | 107.0 KB | VSCO-2 CE: [`Strings/Violin Section/susVib/VlnEns_susVib_B2_v2.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Strings/Violin%20Section/susVib/VlnEns_susVib_B2_v2.wav) | CC0 1.0 |
| `strings/violin_D4.mp3` | 107.2 KB | VSCO-2 CE: [`Strings/Violin Section/susVib/VlnEns_susVib_D3_v2.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Strings/Violin%20Section/susVib/VlnEns_susVib_D3_v2.wav) | CC0 1.0 |
| `strings/violin_Fs4.mp3` | 108.4 KB | VSCO-2 CE: [`Strings/Violin Section/susVib/VlnEns_susVib_F#3_v2.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Strings/Violin%20Section/susVib/VlnEns_susVib_F%233_v2.wav) | CC0 1.0 |
| `strings/violin_A4.mp3` | 107.2 KB | VSCO-2 CE: [`Strings/Violin Section/susVib/VlnEns_susVib_A3_v2.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Strings/Violin%20Section/susVib/VlnEns_susVib_A3_v2.wav) | CC0 1.0 |
| `strings/violin_C5.mp3` | 104.5 KB | VSCO-2 CE: [`Strings/Violin Section/susVib/VlnEns_susVib_C4_v2.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Strings/Violin%20Section/susVib/VlnEns_susVib_C4_v2.wav) | CC0 1.0 |

### Bass: solo double bass, pizzicato

| File | Size | Source file | Licence |
| --- | ---: | --- | --- |
| `bass/E1_1.mp3` | 21.4 KB | VSCO-2 CE: [`Strings/Solo Contrabass/Pizz/BKCtbss_Pizz_E0_v3_rr1.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Strings/Solo%20Contrabass/Pizz/BKCtbss_Pizz_E0_v3_rr1.wav) | CC0 1.0 |
| `bass/E1_2.mp3` | 22.6 KB | VSCO-2 CE: [`Strings/Solo Contrabass/Pizz/BKCtbss_Pizz_E0_v3_rr2.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Strings/Solo%20Contrabass/Pizz/BKCtbss_Pizz_E0_v3_rr2.wav) | CC0 1.0 |
| `bass/G1_1.mp3` | 24.0 KB | VSCO-2 CE: [`Strings/Solo Contrabass/Pizz/BKCtbss_Pizz_G0_v3_rr1.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Strings/Solo%20Contrabass/Pizz/BKCtbss_Pizz_G0_v3_rr1.wav) | CC0 1.0 |
| `bass/G1_2.mp3` | 24.0 KB | VSCO-2 CE: [`Strings/Solo Contrabass/Pizz/BKCtbss_Pizz_G0_v3_rr2.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Strings/Solo%20Contrabass/Pizz/BKCtbss_Pizz_G0_v3_rr2.wav) | CC0 1.0 |
| `bass/As1_1.mp3` | 17.8 KB | VSCO-2 CE: [`Strings/Solo Contrabass/Pizz/BKCtbss_Pizz_A#0_v3_rr1.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Strings/Solo%20Contrabass/Pizz/BKCtbss_Pizz_A%230_v3_rr1.wav) | CC0 1.0 |
| `bass/As1_2.mp3` | 20.8 KB | VSCO-2 CE: [`Strings/Solo Contrabass/Pizz/BKCtbss_Pizz_A#0_v3_rr2.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Strings/Solo%20Contrabass/Pizz/BKCtbss_Pizz_A%230_v3_rr2.wav) | CC0 1.0 |
| `bass/C2_1.mp3` | 20.2 KB | VSCO-2 CE: [`Strings/Solo Contrabass/Pizz/BKCtbss_Pizz_C1_v3_rr1.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Strings/Solo%20Contrabass/Pizz/BKCtbss_Pizz_C1_v3_rr1.wav) | CC0 1.0 |
| `bass/C2_2.mp3` | 19.9 KB | VSCO-2 CE: [`Strings/Solo Contrabass/Pizz/BKCtbss_Pizz_C1_v3_rr2.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Strings/Solo%20Contrabass/Pizz/BKCtbss_Pizz_C1_v3_rr2.wav) | CC0 1.0 |
| `bass/E2_1.mp3` | 22.4 KB | VSCO-2 CE: [`Strings/Solo Contrabass/Pizz/BKCtbss_Pizz_E1_v3_rr1.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Strings/Solo%20Contrabass/Pizz/BKCtbss_Pizz_E1_v3_rr1.wav) | CC0 1.0 |
| `bass/E2_2.mp3` | 21.6 KB | VSCO-2 CE: [`Strings/Solo Contrabass/Pizz/BKCtbss_Pizz_E1_v3_rr2.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Strings/Solo%20Contrabass/Pizz/BKCtbss_Pizz_E1_v3_rr2.wav) | CC0 1.0 |
| `bass/Gs2_1.mp3` | 17.5 KB | VSCO-2 CE: [`Strings/Solo Contrabass/Pizz/BKCtbss_Pizz_G#1_v1_rr1.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Strings/Solo%20Contrabass/Pizz/BKCtbss_Pizz_G%231_v1_rr1.wav) | CC0 1.0 |
| `bass/Gs2_2.mp3` | 19.2 KB | VSCO-2 CE: [`Strings/Solo Contrabass/Pizz/BKCtbss_Pizz_G#1_v1_rr2.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Strings/Solo%20Contrabass/Pizz/BKCtbss_Pizz_G%231_v1_rr2.wav) | CC0 1.0 |
| `bass/A2_1.mp3` | 17.3 KB | VSCO-2 CE: [`Strings/Solo Contrabass/Pizz/BKCtbss_Pizz_A1_v1_rr1.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Strings/Solo%20Contrabass/Pizz/BKCtbss_Pizz_A1_v1_rr1.wav) | CC0 1.0 |
| `bass/Cs3_1.mp3` | 19.0 KB | VSCO-2 CE: [`Strings/Solo Contrabass/Pizz/BKCtbss_Pizz_C#2_v1_rr1.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Strings/Solo%20Contrabass/Pizz/BKCtbss_Pizz_C%232_v1_rr1.wav) | CC0 1.0 |
| `bass/E3_1.mp3` | 17.2 KB | VSCO-2 CE: [`Strings/Solo Contrabass/Pizz/BKCtbss_Pizz_E2_v1_rr1.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Strings/Solo%20Contrabass/Pizz/BKCtbss_Pizz_E2_v1_rr1.wav) | CC0 1.0 |
| `bass/Gs3_1.mp3` | 16.2 KB | VSCO-2 CE: [`Strings/Solo Contrabass/Pizz/BKCtbss_Pizz_G#2_v1_rr1.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Strings/Solo%20Contrabass/Pizz/BKCtbss_Pizz_G%232_v1_rr1.wav) | CC0 1.0 |

### Tuba, staccato (the Tyler theme's bass)

| File | Size | Source file | Licence |
| --- | ---: | --- | --- |
| `tuba/As1_1.mp3` | 9.4 KB | VSCO-2 CE: [`Brass/Tuba/stac/Tuba3_stac_A#0_v2_rr1_Sum.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Brass/Tuba/stac/Tuba3_stac_A%230_v2_rr1_Sum.wav) | CC0 1.0 |
| `tuba/As1_2.mp3` | 8.3 KB | VSCO-2 CE: [`Brass/Tuba/stac/Tuba3_stac_A#0_v2_rr2_Sum.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Brass/Tuba/stac/Tuba3_stac_A%230_v2_rr2_Sum.wav) | CC0 1.0 |
| `tuba/Ds2_1.mp3` | 12.4 KB | VSCO-2 CE: [`Brass/Tuba/stac/Tuba3_stac_D#1_v2_rr1_Sum.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Brass/Tuba/stac/Tuba3_stac_D%231_v2_rr1_Sum.wav) | CC0 1.0 |
| `tuba/Ds2_2.mp3` | 9.7 KB | VSCO-2 CE: [`Brass/Tuba/stac/Tuba3_stac_D#1_v2_rr2_Sum.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Brass/Tuba/stac/Tuba3_stac_D%231_v2_rr2_Sum.wav) | CC0 1.0 |
| `tuba/F2_1.mp3` | 10.3 KB | VSCO-2 CE: [`Brass/Tuba/stac/Tuba3_stac_F1_v2_rr1_Sum.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Brass/Tuba/stac/Tuba3_stac_F1_v2_rr1_Sum.wav) | CC0 1.0 |
| `tuba/F2_2.mp3` | 9.1 KB | VSCO-2 CE: [`Brass/Tuba/stac/Tuba3_stac_F1_v2_rr2_Sum.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Brass/Tuba/stac/Tuba3_stac_F1_v2_rr2_Sum.wav) | CC0 1.0 |
| `tuba/As2_1.mp3` | 9.0 KB | VSCO-2 CE: [`Brass/Tuba/stac/Tuba3_stac_A#1_v2_rr1_Sum.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Brass/Tuba/stac/Tuba3_stac_A%231_v2_rr1_Sum.wav) | CC0 1.0 |
| `tuba/As2_2.mp3` | 10.0 KB | VSCO-2 CE: [`Brass/Tuba/stac/Tuba3_stac_A#1_v2_rr2_Sum.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Brass/Tuba/stac/Tuba3_stac_A%231_v2_rr2_Sum.wav) | CC0 1.0 |
| `tuba/D3_1.mp3` | 7.4 KB | VSCO-2 CE: [`Brass/Tuba/stac/Tuba3_stac_D2_v2_rr1_Sum.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Brass/Tuba/stac/Tuba3_stac_D2_v2_rr1_Sum.wav) | CC0 1.0 |
| `tuba/D3_2.mp3` | 7.7 KB | VSCO-2 CE: [`Brass/Tuba/stac/Tuba3_stac_D2_v2_rr2_Sum.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Brass/Tuba/stac/Tuba3_stac_D2_v2_rr2_Sum.wav) | CC0 1.0 |
| `tuba/F3_1.mp3` | 8.9 KB | VSCO-2 CE: [`Brass/Tuba/stac/Tuba3_stac_F2_v2_rr1_Sum.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Brass/Tuba/stac/Tuba3_stac_F2_v2_rr1_Sum.wav) | CC0 1.0 |
| `tuba/F3_2.mp3` | 7.9 KB | VSCO-2 CE: [`Brass/Tuba/stac/Tuba3_stac_F2_v2_rr2_Sum.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/Brass/Tuba/stac/Tuba3_stac_F2_v2_rr2_Sum.wav) | CC0 1.0 |

### Taiko: large drum (sticks and mallets) and concert bass drum

| File | Size | Source file | Licence |
| --- | ---: | --- | --- |
| `taiko/stick_0_1.mp3` | 22.8 KB | VSCO-2 CE: [`VSCO 1 Percussion/drums/other/ethnic/giant/sticks/EthnicLargeSticks_hit_p_1.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/VSCO%201%20Percussion/drums/other/ethnic/giant/sticks/EthnicLargeSticks_hit_p_1.wav) | CC0 1.0 |
| `taiko/stick_0_2.mp3` | 22.3 KB | VSCO-2 CE: [`VSCO 1 Percussion/drums/other/ethnic/giant/sticks/EthnicLargeSticks_hit_mp_1.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/VSCO%201%20Percussion/drums/other/ethnic/giant/sticks/EthnicLargeSticks_hit_mp_1.wav) | CC0 1.0 |
| `taiko/stick_1_1.mp3` | 15.4 KB | VSCO-2 CE: [`VSCO 1 Percussion/drums/other/ethnic/giant/sticks/EthnicLargeSticks_hit_mf_1.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/VSCO%201%20Percussion/drums/other/ethnic/giant/sticks/EthnicLargeSticks_hit_mf_1.wav) | CC0 1.0 |
| `taiko/stick_1_2.mp3` | 14.6 KB | VSCO-2 CE: [`VSCO 1 Percussion/drums/other/ethnic/giant/sticks/EthnicLargeSticks_hit_mf_2.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/VSCO%201%20Percussion/drums/other/ethnic/giant/sticks/EthnicLargeSticks_hit_mf_2.wav) | CC0 1.0 |
| `taiko/stick_2_1.mp3` | 15.1 KB | VSCO-2 CE: [`VSCO 1 Percussion/drums/other/ethnic/giant/sticks/EthnicLargeSticks_hit_f_1.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/VSCO%201%20Percussion/drums/other/ethnic/giant/sticks/EthnicLargeSticks_hit_f_1.wav) | CC0 1.0 |
| `taiko/stick_2_2.mp3` | 14.5 KB | VSCO-2 CE: [`VSCO 1 Percussion/drums/other/ethnic/giant/sticks/EthnicLargeSticks_hit_f_2.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/VSCO%201%20Percussion/drums/other/ethnic/giant/sticks/EthnicLargeSticks_hit_f_2.wav) | CC0 1.0 |
| `taiko/stick_2_3.mp3` | 16.1 KB | VSCO-2 CE: [`VSCO 1 Percussion/drums/other/ethnic/giant/sticks/EthnicLargeSticks_hit_fff_1.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/VSCO%201%20Percussion/drums/other/ethnic/giant/sticks/EthnicLargeSticks_hit_fff_1.wav) | CC0 1.0 |
| `taiko/mallet_0_1.mp3` | 16.6 KB | VSCO-2 CE: [`VSCO 1 Percussion/drums/other/ethnic/giant/mallet/EthnicLargeMallet_hit_mf_1.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/VSCO%201%20Percussion/drums/other/ethnic/giant/mallet/EthnicLargeMallet_hit_mf_1.wav) | CC0 1.0 |
| `taiko/mallet_1_1.mp3` | 14.0 KB | VSCO-2 CE: [`VSCO 1 Percussion/drums/other/ethnic/giant/mallet/EthnicLargeMallet_hit_f_1.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/VSCO%201%20Percussion/drums/other/ethnic/giant/mallet/EthnicLargeMallet_hit_f_1.wav) | CC0 1.0 |
| `taiko/boom_0_1.mp3` | 28.4 KB | VCSL: [`Membranophones/Struck Membranophones/Bass Drum 1/BDrumNew_hit_v3_rr1_Sum.wav`](https://github.com/sgossner/VCSL/blob/master/Membranophones/Struck%20Membranophones/Bass%20Drum%201/BDrumNew_hit_v3_rr1_Sum.wav) | CC0 1.0 |
| `taiko/boom_0_2.mp3` | 28.9 KB | VCSL: [`Membranophones/Struck Membranophones/Bass Drum 1/BDrumNew_hit_v3_rr2_Sum.wav`](https://github.com/sgossner/VCSL/blob/master/Membranophones/Struck%20Membranophones/Bass%20Drum%201/BDrumNew_hit_v3_rr2_Sum.wav) | CC0 1.0 |
| `taiko/boom_1_1.mp3` | 23.6 KB | VCSL: [`Membranophones/Struck Membranophones/Bass Drum 1/BDrumNew_hit_v5_rr1_Sum.wav`](https://github.com/sgossner/VCSL/blob/master/Membranophones/Struck%20Membranophones/Bass%20Drum%201/BDrumNew_hit_v5_rr1_Sum.wav) | CC0 1.0 |
| `taiko/boom_1_2.mp3` | 24.8 KB | VCSL: [`Membranophones/Struck Membranophones/Bass Drum 1/BDrumNew_hit_v5_rr2_Sum.wav`](https://github.com/sgossner/VCSL/blob/master/Membranophones/Struck%20Membranophones/Bass%20Drum%201/BDrumNew_hit_v5_rr2_Sum.wav) | CC0 1.0 |

### Rim clicks, anvil, vibraslap, shaker, gong

| File | Size | Source file | Licence |
| --- | ---: | --- | --- |
| `perc/ka_1.mp3` | 5.5 KB | VSCO-2 CE: [`VSCO 1 Percussion/drums/other/ethnic/giant/EthnicLargeStick_rimshot_1.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/VSCO%201%20Percussion/drums/other/ethnic/giant/EthnicLargeStick_rimshot_1.wav) | CC0 1.0 |
| `perc/ka_2.mp3` | 5.5 KB | VSCO-2 CE: [`VSCO 1 Percussion/drums/other/ethnic/giant/EthnicLargeStick_rimshot_2.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/VSCO%201%20Percussion/drums/other/ethnic/giant/EthnicLargeStick_rimshot_2.wav) | CC0 1.0 |
| `perc/ka_3.mp3` | 5.3 KB | VSCO-2 CE: [`VSCO 1 Percussion/drums/other/ethnic/giant/EthnicLargeStick_rimshot_3.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/VSCO%201%20Percussion/drums/other/ethnic/giant/EthnicLargeStick_rimshot_3.wav) | CC0 1.0 |
| `perc/shaker_1.mp3` | 3.6 KB | VSCO-2 CE: [`VSCO 1 Percussion/varWood/Camo's Shaker/shake1.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/VSCO%201%20Percussion/varWood/Camo's%20Shaker/shake1.wav) | CC0 1.0 |
| `perc/shaker_2.mp3` | 4.4 KB | VSCO-2 CE: [`VSCO 1 Percussion/varWood/Camo's Shaker/shake2.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/VSCO%201%20Percussion/varWood/Camo's%20Shaker/shake2.wav) | CC0 1.0 |
| `perc/shaker_3.mp3` | 4.3 KB | VSCO-2 CE: [`VSCO 1 Percussion/varWood/Camo's Shaker/shake4.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/VSCO%201%20Percussion/varWood/Camo's%20Shaker/shake4.wav) | CC0 1.0 |
| `perc/shaker_4.mp3` | 3.8 KB | VSCO-2 CE: [`VSCO 1 Percussion/varWood/Camo's Shaker/shake5.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/VSCO%201%20Percussion/varWood/Camo's%20Shaker/shake5.wav) | CC0 1.0 |
| `perc/shaker_5.mp3` | 5.0 KB | VSCO-2 CE: [`VSCO 1 Percussion/varWood/Camo's Shaker/shake7.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/VSCO%201%20Percussion/varWood/Camo's%20Shaker/shake7.wav) | CC0 1.0 |
| `perc/shaker_6.mp3` | 5.3 KB | VSCO-2 CE: [`VSCO 1 Percussion/varWood/Camo's Shaker/shake3.wav`](https://github.com/sgossner/VSCO-2-CE/blob/master/VSCO%201%20Percussion/varWood/Camo's%20Shaker/shake3.wav) | CC0 1.0 |
| `perc/gong.mp3` | 120.4 KB | VCSL: [`Idiophones/Struck Idiophones/Gong 1/gong_f.wav`](https://github.com/sgossner/VCSL/blob/master/Idiophones/Struck%20Idiophones/Gong%201/gong_f.wav) | CC0 1.0 |
| `perc/anvil_0_1.mp3` | 10.8 KB | VCSL: [`Idiophones/Struck Idiophones/Anvil/Anvil_Hit1_v2_rr1_Mid.wav`](https://github.com/sgossner/VCSL/blob/master/Idiophones/Struck%20Idiophones/Anvil/Anvil_Hit1_v2_rr1_Mid.wav) | CC0 1.0 |
| `perc/anvil_0_2.mp3` | 10.4 KB | VCSL: [`Idiophones/Struck Idiophones/Anvil/Anvil_Hit2_v2_rr1_Mid.wav`](https://github.com/sgossner/VCSL/blob/master/Idiophones/Struck%20Idiophones/Anvil/Anvil_Hit2_v2_rr1_Mid.wav) | CC0 1.0 |
| `perc/anvil_0_3.mp3` | 9.2 KB | VCSL: [`Idiophones/Struck Idiophones/Anvil/Anvil_Hit3_v2_rr1_Mid.wav`](https://github.com/sgossner/VCSL/blob/master/Idiophones/Struck%20Idiophones/Anvil/Anvil_Hit3_v2_rr1_Mid.wav) | CC0 1.0 |
| `perc/anvil_1_1.mp3` | 10.6 KB | VCSL: [`Idiophones/Struck Idiophones/Anvil/Anvil_Hit1_v3_rr1_Mid.wav`](https://github.com/sgossner/VCSL/blob/master/Idiophones/Struck%20Idiophones/Anvil/Anvil_Hit1_v3_rr1_Mid.wav) | CC0 1.0 |
| `perc/anvil_1_2.mp3` | 9.9 KB | VCSL: [`Idiophones/Struck Idiophones/Anvil/Anvil_Hit2_v3_rr1_Mid.wav`](https://github.com/sgossner/VCSL/blob/master/Idiophones/Struck%20Idiophones/Anvil/Anvil_Hit2_v3_rr1_Mid.wav) | CC0 1.0 |
| `perc/anvil_1_3.mp3` | 8.8 KB | VCSL: [`Idiophones/Struck Idiophones/Anvil/Anvil_Hit3_v3_rr1_Mid.wav`](https://github.com/sgossner/VCSL/blob/master/Idiophones/Struck%20Idiophones/Anvil/Anvil_Hit3_v3_rr1_Mid.wav) | CC0 1.0 |
| `perc/vibraslap_1.mp3` | 28.3 KB | VCSL: [`Idiophones/Struck Idiophones/Vibraslap/Legacy/vibraslap_rr1.wav`](https://github.com/sgossner/VCSL/blob/master/Idiophones/Struck%20Idiophones/Vibraslap/Legacy/vibraslap_rr1.wav) | CC0 1.0 |
| `perc/vibraslap_2.mp3` | 29.9 KB | VCSL: [`Idiophones/Struck Idiophones/Vibraslap/Legacy/vibraslap_rr2.wav`](https://github.com/sgossner/VCSL/blob/master/Idiophones/Struck%20Idiophones/Vibraslap/Legacy/vibraslap_rr2.wav) | CC0 1.0 |

### Reverb

| File | Size | Source file | Licence |
| --- | ---: | --- | --- |
| `hall_ir.mp3` | 44.2 KB | Freesound: ["IR Estonia Nordea Hall.wav" by johnnyguitar01](https://freesound.org/people/johnnyguitar01/sounds/423803/), [HQ MP3 preview](https://cdn.freesound.org/previews/423/423803_4844309-hq.mp3) | CC0 1.0 |
