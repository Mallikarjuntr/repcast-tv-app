"""Renders Spotter's 3D trainer clips: one looping MP4 per move, timed to the app's beat.

    Blender --background --factory-startup --python tools/trainer/render.py -- <mixamo-dir> <out-dir> [clip ...]

<mixamo-dir> holds the Mixamo FBX files (X Bot, with skin, 30 fps). They stay out of this repo: Mixamo's
terms allow using them in the app but not redistributing the raw files. Only the rendered MP4s are committed.
"""
import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import poses  # noqa: E402
import style  # noqa: E402

FPS = 30
# One camera size for every clip, so the trainer is the same size whatever the move.
ORTHO_SCALE = 2.45
# Moves with the arms overhead need a taller frame.
TALL_SCALE = 2.8
FRONT_YAW = 25  # degrees: a front three-quarter view shows depth on squats and lunges
SIDE_YAW = 90   # a plank reads best from the side


def seconds(s):
    return round(s * FPS)


# Each clip: the Mixamo file, its segments (source frames → output length), and the camera.
# Segments are played in order; together they make exactly one beat (or one hold loop).
CLIPS = {
    # A squat from the app's beat: 2 s down, 1.5 s up (source: down 1→25, up 25→49).
    'squat': {'fbx': 'Air Squat', 'segments': [(1, 25, seconds(2.0)), (25, 49, seconds(1.5))], 'yaw': FRONT_YAW},
    # Half squats stop halfway down (hip height halfway between standing and the bottom ≈ frame 15).
    'half-squat': {'fbx': 'Air Squat', 'segments': [(1, 15, seconds(1.5)), (15, 1, seconds(1.5))], 'yaw': FRONT_YAW},
    # Jumping jacks start closed (frame 16), open by frame 31, close again 1→16: 0.5 s each way.
    'jumping-jack': {'fbx': 'Jumping Jacks', 'segments': [(16, 31, seconds(0.5)), (1, 16, seconds(0.5))], 'yaw': FRONT_YAW, 'scale': TALL_SCALE, 'target_z': 1.0},
    # Holds: the source's own breathing loop at its natural speed.
    'plank': {'fbx': 'Plank', 'segments': [(1, 91, 90)], 'yaw': SIDE_YAW, 'target_z': 0.6, 'shadow': (1.15, 0.22)},
    # Scripted moves (tools/trainer/poses.py), posed from Mixamo's standing idle.
    'march': {'fbx': 'Idle', 'pose': 'march', 'yaw': 50},
    'high-knees': {'fbx': 'Idle', 'pose': 'high-knees', 'yaw': 50},
    'step-touch': {'fbx': 'Idle', 'pose': 'step-touch', 'yaw': FRONT_YAW},
    'sumo-squat': {'fbx': 'Idle', 'pose': 'sumo-squat', 'yaw': FRONT_YAW},
    'lunge': {'fbx': 'Idle', 'pose': 'lunge', 'yaw': 55},
    'step-jack': {'fbx': 'Idle', 'pose': 'step-jack', 'yaw': FRONT_YAW, 'scale': TALL_SCALE, 'target_z': 1.0},
    'knee-plank': {'fbx': 'Plank', 'pose': 'knee-plank', 'yaw': SIDE_YAW, 'target_z': 0.6, 'shadow': (1.0, 0.22)},
    'reach': {'fbx': 'Idle', 'pose': 'reach', 'yaw': FRONT_YAW, 'scale': TALL_SCALE, 'target_z': 1.0},
    'side-bend': {'fbx': 'Idle', 'pose': 'side-bend', 'yaw': 0, 'scale': TALL_SCALE, 'target_z': 1.0},
    # Shown during rests: the trainer stands at ease, breathing (Mixamo's idle loop, whole and at its own speed).
    'rest': {'fbx': 'Idle', 'segments': 'whole', 'yaw': FRONT_YAW},
}


def add_shadow(scene, size):
    """A soft oval on the floor so the trainer stands on something. Not outlined."""
    bpy.ops.mesh.primitive_circle_add(vertices=48, radius=1.0, fill_type='NGON', location=(0, 0, 0.002))
    disc = bpy.context.active_object
    disc.scale = (size[0], size[1], 1)
    mat = bpy.data.materials.new('Shadow')
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    nodes.clear()
    emit = nodes.new('ShaderNodeEmission')
    emit.inputs['Color'].default_value = (*style.srgb_to_linear((0.827, 0.776, 0.671)), 1)  # #D3C6AB
    out = nodes.new('ShaderNodeOutputMaterial')
    mat.node_tree.links.new(emit.outputs['Emission'], out.inputs['Surface'])
    disc.data.materials.append(mat)
    no_ink = bpy.data.collections.new('NoInk')
    scene.collection.children.link(no_ink)
    for c in disc.users_collection:
        c.objects.unlink(disc)
    no_ink.objects.link(disc)
    lineset = scene.view_layers[0].freestyle_settings.linesets[0]
    lineset.select_by_collection = True
    lineset.collection = no_ink
    lineset.collection_negation = 'EXCLUSIVE'


def add_camera(scene, yaw_deg, target_z, scale):
    data = bpy.data.cameras.new('Cam')
    data.type = 'ORTHO'
    data.ortho_scale = scale
    cam = bpy.data.objects.new('Cam', data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    yaw = math.radians(yaw_deg)
    cam.location = Vector((-math.sin(yaw) * 8, -math.cos(yaw) * 8, target_z))
    cam.rotation_euler = (math.radians(90), 0, -yaw)


def retime(arm, segments):
    """Lay the clip out as NLA strips, each stretched to its output length; returns the frame count."""
    action = arm.animation_data.action
    arm.animation_data.action = None
    track = arm.animation_data.nla_tracks.new()
    frame = 1
    for i, (start, end, length) in enumerate(segments):
        strip = track.strips.new(f'seg{i}', frame, action)
        strip.action_frame_start = min(start, end)
        strip.action_frame_end = max(start, end)
        strip.use_reverse = end < start
        strip.scale = length / abs(end - start)
        strip.extrapolation = 'NOTHING'
        strip.blend_type = 'REPLACE'
        frame += length
    return frame - 1


def render_clip(name, spec, mixamo_dir, out_dir):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=os.path.join(mixamo_dir, spec['fbx'] + '.fbx'))
    scene = bpy.context.scene
    arm = next(o for o in scene.objects if o.type == 'ARMATURE')
    if 'pose' in spec:
        scene.frame_set(1)
        frames = poses.build(spec['pose'], arm)
    elif spec['segments'] == 'whole':
        start, end = (round(f) for f in arm.animation_data.action.frame_range)
        frames = retime(arm, [(start, end, end - start)])
    else:
        frames = retime(arm, spec['segments'])
    style.apply(scene)
    add_shadow(scene, spec.get('shadow', (0.42, 0.26)))
    add_camera(scene, spec['yaw'], spec.get('target_z', 0.92), spec.get('scale', ORTHO_SCALE))
    scene.frame_start, scene.frame_end = 1, frames
    scene.render.image_settings.media_type = 'VIDEO'  # Blender 5: video output sits behind media_type
    scene.render.image_settings.file_format = 'FFMPEG'
    scene.render.ffmpeg.format = 'MPEG4'
    scene.render.ffmpeg.codec = 'H264'
    scene.render.ffmpeg.constant_rate_factor = 'MEDIUM'
    scene.render.ffmpeg.gopsize = FPS
    scene.render.ffmpeg.audio_codec = 'NONE'
    scene.render.filepath = os.path.join(out_dir, f'{name}.mp4')
    bpy.ops.render.render(animation=True)
    print(f'RENDERED {name}: {frames} frames = {frames / FPS:.2f} s')


def main():
    args = sys.argv[sys.argv.index('--') + 1:]
    mixamo_dir, out_dir, only = args[0], args[1], args[2:]
    os.makedirs(out_dir, exist_ok=True)
    for name, spec in CLIPS.items():
        if not only or name in only:
            render_clip(name, spec, mixamo_dir, out_dir)


if __name__ == '__main__':
    main()
