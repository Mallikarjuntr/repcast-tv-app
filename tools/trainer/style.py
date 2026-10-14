"""Shared look for Spotter's 3D trainer: a mannequin drawn in ink on paper, like the app."""
import math

import bpy

PAPER_DEEP = (0.894, 0.855, 0.776)   # #E4DAC6 — the demo panel's background
FILL_LIGHT = (0.984, 0.973, 0.945)   # #FBF8F1 — lit side of the body
FILL_SHADE = (0.937, 0.910, 0.855)   # #EFE8DA — shaded side
INK = (0.114, 0.106, 0.090)          # #1D1B17


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

    world = bpy.data.worlds.new('Paper')
    world.use_nodes = True
    bg = world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (*srgb_to_linear(PAPER_DEEP), 1)
    bg.inputs['Strength'].default_value = 1.0
    scene.world = world

    body = toon_material('Trainer Body', FILL_LIGHT, FILL_SHADE)
    joints = toon_material('Trainer Joints', (0.36, 0.34, 0.30), (0.23, 0.22, 0.19))
    for obj in scene.objects:
        if obj.type != 'MESH':
            continue
        obj.data.materials.clear()
        obj.data.materials.append(joints if 'Joint' in obj.name else body)

    # A key light only shapes the toon split; the fill is emission so the paper tones stay exact.
    sun = bpy.data.lights.new('Key', 'SUN')
    sun.energy = 3.0
    sun_obj = bpy.data.objects.new('Key', sun)
    sun_obj.rotation_euler = (math.radians(50), math.radians(10), math.radians(-35))
    scene.collection.objects.link(sun_obj)

    # Ink outlines.
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
