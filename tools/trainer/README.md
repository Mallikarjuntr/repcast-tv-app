# The 3D trainer

In Follow along (no camera), a 3D trainer performs each move on the TV in time with the coach's counting. The trainer is drawn in the app's Studio style — a pale mannequin with dark outlines on the panel's own dark colour — so it sits seamlessly in the demo panel.

The clips are pre-rendered, not generated live: a Fire TV Stick has about 900 MB of RAM, and playing a short H.264 loop uses the stick's hardware video decoder. On a Fire TV Stick 3rd gen, the follow-along screen drops from ~55% slow frames (drawn figure) to under 2% with the trainer video.

## How the clips are made

1. **Character and motion capture** come from [Mixamo](https://www.mixamo.com): the *X Bot* mannequin and the *Air Squat*, *Jumping Jacks*, *Plank* and *Idle* animations, downloaded as FBX (with skin, 30 fps).
2. **Moves Mixamo doesn't have** — march, high knees, step touch, sumo squat, lunge, step jack, knee plank, reach, side bend — are posed on the same character by `poses.py`: bones are aimed in world space, a two-bone solver keeps the feet planted, and Blender eases between a few key poses.
3. **`render.py`** retimes each move to the app's beat (e.g. a squat is 2 s down, 1.5 s up), frames a fixed orthographic camera, applies the Studio look from `style.py` (two-tone toon fill + Freestyle outlines), and writes one looping MP4 per move to `apps/tv/assets/trainer/`.

```bash
Blender --background --factory-startup --python tools/trainer/render.py -- <mixamo-dir> apps/tv/assets/trainer [clip ...]
```

Tested with Blender 5.2.2 LTS.

## Licensing

Mixamo's terms allow its characters and animations to be used in apps, royalty-free, but not redistributed as raw files. So the Mixamo FBX files are **not** in this repository — only the rendered videos are. To re-render, download the files above from Mixamo with your own Adobe account into `<mixamo-dir>`.

## In the app

`apps/tv/src/trainerClips.ts` maps each move to its clip (reverse lunges and split squats share the lunge clip). `TrainerVideo` plays the loop muted, holds it at the first frame while the coach introduces the set, and nudges it back on the beat if it drifts more than 0.15 s. A move without a clip falls back to the drawn figure.
