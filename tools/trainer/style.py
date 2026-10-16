"""Shared look for Spotter's 3D trainer: a pale mannequin with dark outlines on the app's dark studio panel."""
import math

import bpy

STAGE = (0.133, 0.118, 0.102)        # #221E1A — the trainer panel's background (theme `surface`)
FILL_LIGHT = (0.957, 0.937, 0.910)   # #F4EFE8 — lit side of the body
FILL_SHADE = (0.812, 0.776, 0.729)   # #CFC6BA — shaded side
JOINT_LIGHT = (0.561, 0.525, 0.482)  # #8F867B — muted, so the accent stays for focus and the live skeleton
JOINT_SHADE = (0.431, 0.400, 0.361)  # #6E665C
INK = (0.082, 0.071, 0.059)          # #15120F — outlines
SHADOW = (0.180, 0.157, 0.137)       # #2E2823 — the floor oval


def srgb_to_linear(c):
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c)


def toon_material(name, light, shade):
    """Two flat tones split by the light direction, so the body still reads as 3D."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.clear()
    out = nodes.new('ShaderNodeOutputMaterial')
    diffuse = nodes.new('ShaderNodeBsdfDiffuse')
    to_rgb = nodes.new('ShaderNodeShaderToRGB')
    ramp = nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.interpolation = 'CONSTANT'
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = (*srgb_to_linear(shade), 1)
    ramp.color_ramp.elements[1].position = 0.35
    ramp.color_ramp.elements[1].color = (*srgb_to_linear(light), 1)
    emit = nodes.new('ShaderNodeEmission')
    links.new(diffuse.outputs['BSDF'], to_rgb.inputs['Shader'])
    links.new(to_rgb.outputs['Color'], ramp.inputs['Fac'])
    links.new(ramp.outputs['Color'], emit.inputs['Color'])
    links.new(emit.outputs['Emission'], out.inputs['Surface'])
    return mat


def apply(scene, width=960, height=768):
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.fps = 30
    scene.view_settings.view_transform = 'Standard'   # colours come out exactly as specified
    scene.view_settings.look = 'None'

    world = bpy.data.worlds.new('Stage')
    world.use_nodes = True
    bg = world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (*srgb_to_linear(STAGE), 1)
    bg.inputs['Strength'].default_value = 1.0
    scene.world = world

    body = toon_material('Trainer Body', FILL_LIGHT, FILL_SHADE)
    joints = toon_material('Trainer Joints', JOINT_LIGHT, JOINT_SHADE)
    for obj in scene.objects:
        if obj.type != 'MESH':
            continue
        obj.data.materials.clear()
        obj.data.materials.append(joints if 'Joint' in obj.name else body)

    # A key light only shapes the toon split; the fill is emission so the tones stay exact.
    sun = bpy.data.lights.new('Key', 'SUN')
    sun.energy = 3.0
    sun_obj = bpy.data.objects.new('Key', sun)
    sun_obj.rotation_euler = (math.radians(50), math.radians(10), math.radians(-35))
    scene.collection.objects.link(sun_obj)

    # Outlines.
    scene.render.use_freestyle = True
    scene.render.line_thickness_mode = 'ABSOLUTE'
    scene.render.line_thickness = 1.0
    view_layer = scene.view_layers[0]
    view_layer.use_freestyle = True
    settings = view_layer.freestyle_settings
    lineset = settings.linesets[0] if settings.linesets else settings.linesets.new('Ink')
    lineset.select_by_visibility = True
    lineset.select_by_edge_types = True
    lineset.select_silhouette = True
    lineset.select_border = True
    lineset.select_crease = True
    settings.crease_angle = math.radians(120)
    style = lineset.linestyle or bpy.data.linestyles.new('Ink')
    lineset.linestyle = style
    style.color = srgb_to_linear(INK)
    style.thickness = 3.2
    style.caps = 'ROUND'
