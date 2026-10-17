"""Renders test videos for the movement engine: each judged move, one loop, from several camera angles.

    Blender --background --factory-startup --python tools/trainer/views.py -- <mixamo-dir> <out-dir> [yaw ...] [-- clip ...]

The app's trainer clips are filmed from one flattering angle. People put their phone wherever it
fits, so the rep counter is checked on the same moves seen from the front (0°), at the recommended
45°, and side-on (90°). Clips are portrait like a phone video, and skip the outline pass (fast).
Writes <out-dir>/<clip>@<yaw>.mp4 (tools/trainer/views-out is git-ignored for this); replay them on
the camera app's replay bench with `&repeat=N`.
"""
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render  # noqa: E402

# Moves the camera judges, by their trainer clip (lunge stands in for reverse lunge and split squat).
JUDGED = ['squat', 'half-squat', 'sumo-squat', 'lunge', 'curtsy-lunge', 'jumping-jack', 'step-jack', 'push-up', 'knee-push-up', 'glute-bridge']
YAWS = [0, 45, 90]


def render_view(name, yaw, mixamo_dir, out_dir):
    spec = dict(render.CLIPS[name])
    spec['yaw'] = yaw
    # render_clip sets everything up and renders; patch the look and the output first.
    original_apply = render.style.apply

    def plain(scene, width=450, height=800):
        original_apply(scene, width, height)
        scene.render.use_freestyle = False
        scene.eevee.taa_render_samples = 4

    render.style.apply = plain
    try:
        render.render_clip(f'{name}@{yaw}', spec, mixamo_dir, out_dir)
    finally:
        render.style.apply = original_apply


def main():
    args = sys.argv[sys.argv.index('--') + 1:]
    mixamo_dir, out_dir, rest = args[0], args[1], args[2:]
    yaws = [int(a) for a in rest if a.lstrip('-').isdigit()] or YAWS
    clips = [a for a in rest if not a.lstrip('-').isdigit()] or JUDGED
    os.makedirs(out_dir, exist_ok=True)
    for name in clips:
        for yaw in yaws:
            render_view(name, yaw, mixamo_dir, out_dir)


if __name__ == '__main__':
    main()
