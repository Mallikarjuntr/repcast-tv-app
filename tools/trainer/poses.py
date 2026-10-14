"""Scripted moves for the trainer, for exercises Mixamo has no motion capture of.

Starts from Mixamo's relaxed standing pose (the first frame of "Idle") and builds a few key poses
per move by aiming bones in world space, with a two-bone leg solver that keeps the feet planted.
Blender eases between the keys. The character faces -Y; its left side is +X.
"""
import math

import bpy
from mathutils import Matrix, Vector

P = 'mixamorig:'
THIGH = 0.444
SHIN = 0.445
FORWARD = Vector((0, -1, 0))


def v(x, y, z):
    return Vector((x, y, z)).normalized()


class Rig:
    def __init__(self, arm):
        self.arm = arm
        self.world = arm.matrix_world
        bpy.context.view_layer.update()
        self.base = {pb.name: pb.matrix_basis.copy() for pb in arm.pose.bones}
        self.base_dirs = {pb.name: self.direction(pb.name) for pb in arm.pose.bones}
        self.base_heads = {pb.name: self.head(pb.name) for pb in arm.pose.bones}

    def reset(self):
        for pb in self.arm.pose.bones:
            pb.matrix_basis = self.base[pb.name]
        bpy.context.view_layer.update()

    def head(self, name):
        return self.world @ self.arm.pose.bones[P + name if not name.startswith(P) else name].head

    def tail(self, name):
        return self.world @ self.arm.pose.bones[P + name if not name.startswith(P) else name].tail

    def direction(self, name):
        return (self.tail(name) - self.head(name)).normalized()

    def _set_world(self, pb, world_matrix):
        pb.matrix = self.world.inverted() @ world_matrix
        bpy.context.view_layer.update()

    def aim(self, name, direction):
        """Rotate a bone about its head so it points along `direction` (world space)."""
        pb = self.arm.pose.bones[P + name]
        current = self.direction(name)
        turn = current.rotation_difference(direction.normalized())
        wm = self.world @ pb.matrix
        head = wm.to_translation()
        self._set_world(pb, Matrix.Translation(head) @ turn.to_matrix().to_4x4() @ Matrix.Translation(-head) @ wm)

    def restore(self, name):
        """Point a bone the way it pointed in the base pose (e.g. keep a foot flat)."""
        self.aim(name, self.base_dirs[P + name])

    def move_hips(self, offset):
        pb = self.arm.pose.bones[P + 'Hips']
        self._set_world(pb, Matrix.Translation(offset) @ (self.world @ pb.matrix))

    def leg(self, side, ankle, knee_dir=FORWARD, foot=None):
        """Place a leg so its ankle reaches `ankle`, bending the knee toward `knee_dir`."""
        hip = self.head(side + 'UpLeg')
        to_ankle = ankle - hip
        d = min(to_ankle.length, THIGH + SHIN - 1e-4)
        u = to_ankle.normalized()
        a = (THIGH ** 2 - SHIN ** 2 + d ** 2) / (2 * d)
        h = math.sqrt(max(THIGH ** 2 - a ** 2, 0))
        bend = (knee_dir - u * knee_dir.dot(u)).normalized()
        knee = hip + u * a + bend * h
        self.aim(side + 'UpLeg', knee - hip)
        self.aim(side + 'Leg', hip + u * d - knee)
        if foot is None:
            self.restore(side + 'Foot')
        else:
            self.aim(side + 'Foot', foot)
        self.restore(side + 'ToeBase')

    def arm_dirs(self, side, upper, lower):
        self.aim(side + 'Arm', upper)
        self.aim(side + 'ForeArm', lower)

    def key(self, frame):
        for pb in self.arm.pose.bones:
            pb.keyframe_insert('rotation_quaternion', frame=frame)
            pb.keyframe_insert('location', frame=frame)


def ankle(rig, side):
    return rig.base_heads[P + side + 'Foot'].copy()


# --- Moves. Each takes the rig and returns the number of frames in one loop. -----------------------

def march(rig):
    """Knees up in turn with opposite arms swinging: one loop = left, both down, right, both down."""
    def knee_up(lift, swing):
        rig.reset()
        rig.aim(lift + 'UpLeg', v(0, -0.88, -0.48))
        rig.aim(lift + 'Leg', v(0, 0.08, -1))
        rig.restore(lift + 'Foot')
        rig.restore(lift + 'ToeBase')
        out = 0.12 if swing == 'Left' else -0.12
        rig.arm_dirs(swing, v(out, -0.55, -0.83), v(out, -0.95, -0.3))
        back = 'Left' if swing == 'Right' else 'Right'
        rig.arm_dirs(back, v(0, 0.35, -0.94), v(0, 0.15, -0.99))

    knee_up('Left', 'Right'); rig.key(1)
    rig.reset(); rig.key(10)
    knee_up('Right', 'Left'); rig.key(19)
    rig.reset(); rig.key(28)
    knee_up('Left', 'Right'); rig.key(37)
    return 36


def lunge(rig, frames):
    """Split stance, lowering straight down: front knee over the ankle, back knee toward the floor."""
    front = ankle(rig, 'Left') + Vector((0, -0.34, 0))
    back = ankle(rig, 'Right') + Vector((0, 0.36, 0.02))

    def pose(drop):
        rig.reset()
        rig.move_hips(Vector((0, 0.02, -drop)))
        rig.leg('Left', front)
        rig.leg('Right', back, foot=v(0, -0.55, -0.83))  # back heel up, on the toes

    down = round(frames * 2.0 / 3.5)
    pose(0.08); rig.key(1)
    pose(0.42); rig.key(1 + down)
    pose(0.08); rig.key(1 + frames)
    return frames


def reach(rig):
    """Arms float up overhead and back down over six slow seconds."""
    rig.reset(); rig.key(1)
    rig.reset()
    rig.arm_dirs('Left', v(0.2, 0, 1), v(0.05, 0, 1))
    rig.arm_dirs('Right', v(-0.2, 0, 1), v(-0.05, 0, 1))
    rig.key(91)
    rig.reset(); rig.key(181)
    return 180


def turned(direction, degrees):
    """`direction` turned about the vertical axis (positive turns toward the character's left)."""
    a = math.radians(degrees)
    return Vector((direction.x * math.cos(a) - direction.y * math.sin(a), direction.x * math.sin(a) + direction.y * math.cos(a), direction.z)).normalized()


def sumo_squat(rig, frames):
    """Wide stance, toes and knees turned out, hands together at the chest."""
    left = ankle(rig, 'Left') + Vector((0.17, 0, 0))
    right = ankle(rig, 'Right') + Vector((-0.17, 0, 0))

    def pose(drop):
        rig.reset()
        rig.move_hips(Vector((0, 0.05 * drop / 0.36, -drop)))
        rig.leg('Left', left, knee_dir=v(0.55, -0.83, 0), foot=turned(rig.base_dirs[P + 'LeftFoot'], 28))
        rig.leg('Right', right, knee_dir=v(-0.55, -0.83, 0), foot=turned(rig.base_dirs[P + 'RightFoot'], -28))
        rig.arm_dirs('Left', v(0.05, -0.55, -0.83), v(-0.75, -0.35, 0.56))
        rig.arm_dirs('Right', v(-0.05, -0.55, -0.83), v(0.75, -0.35, 0.56))

    down = round(frames * 2.0 / 3.5)
    pose(0.06); rig.key(1)
    pose(0.36); rig.key(1 + down)
    pose(0.06); rig.key(1 + frames)
    return frames


def step_touch(rig):
    """Step out to one side and tap the other foot in; arms open a little with each step."""
    def side(out, drop=0.03):
        rig.reset()
        rig.move_hips(Vector((0.05 if out == 'Left' else -0.05, 0, -drop)))
        stay = 'Right' if out == 'Left' else 'Left'
        rig.leg(stay, ankle(rig, stay))
        rig.leg(out, ankle(rig, out) + Vector((0.2 if out == 'Left' else -0.2, 0, 0.015)))
        rig.arm_dirs('Left', v(0.45, -0.1, -0.89), v(0.35, -0.5, -0.79))
        rig.arm_dirs('Right', v(-0.45, -0.1, -0.89), v(-0.35, -0.5, -0.79))

    def together():
        rig.reset()
        rig.move_hips(Vector((0, 0, -0.01)))
        rig.leg('Left', ankle(rig, 'Left'))
        rig.leg('Right', ankle(rig, 'Right'))

    side('Left'); rig.key(1)
    together(); rig.key(11)
    side('Right'); rig.key(22)
    together(); rig.key(32)
    side('Left'); rig.key(43)
    return 42


def high_knees(rig):
    """Quick feet: thigh up to hip height, elbows bent and pumping."""
    def knee_up(lift):
        rig.reset()
        rig.aim(lift + 'UpLeg', v(0, -0.99, -0.1))
        rig.aim(lift + 'Leg', v(0, 0.1, -1))
        rig.restore(lift + 'Foot')
        rig.restore(lift + 'ToeBase')
        other = 'Right' if lift == 'Left' else 'Left'
        rig.arm_dirs(other, v(0, -0.45, -0.89), v(0, -0.6, 0.8))
        rig.arm_dirs(lift, v(0, 0.45, -0.89), v(0, -0.2, 0.98))

    def down():
        rig.reset()
        rig.arm_dirs('Left', v(0.05, 0, -1), v(0.05, -0.7, 0.71))
        rig.arm_dirs('Right', v(-0.05, 0, -1), v(-0.05, -0.7, 0.71))

    knee_up('Left'); rig.key(1)
    down(); rig.key(6)
    knee_up('Right'); rig.key(11)
    down(); rig.key(16)
    knee_up('Left'); rig.key(21)
    return 20


def side_bend(rig):
    """Arms overhead, leaning slowly to one side, through the middle, to the other side."""
    def lean(sign):
        rig.reset()
        rig.aim('Spine', v(0.22 * sign, 0, 0.97))
        rig.aim('Spine1', v(0.42 * sign, 0, 0.91))
        rig.aim('Spine2', v(0.6 * sign, 0, 0.8))
        rig.aim('Neck', v(0.62 * sign, 0, 0.78))
        rig.arm_dirs('Left', v(0.25 + 0.7 * sign, 0, 0.7), v(0.1 + 0.75 * sign, 0, 0.66))
        rig.arm_dirs('Right', v(-0.25 + 0.7 * sign, 0, 0.7), v(-0.1 + 0.75 * sign, 0, 0.66))

    def upright():
        rig.reset()
        rig.arm_dirs('Left', v(0.25, 0, 0.97), v(0.08, 0, 1))
        rig.arm_dirs('Right', v(-0.25, 0, 0.97), v(-0.08, 0, 1))

    upright(); rig.key(1)
    lean(1); rig.key(46)
    upright(); rig.key(91)
    lean(-1); rig.key(136)
    upright(); rig.key(181)
    return 180


def step_jack(rig, frames):
    """Jumping jack without the jump: step one foot out as the arms go up, then back in."""
    def open_():
        rig.reset()
        rig.move_hips(Vector((0.06, 0, -0.03)))
        rig.leg('Right', ankle(rig, 'Right'))
        rig.leg('Left', ankle(rig, 'Left') + Vector((0.3, 0, 0)))
        rig.arm_dirs('Left', v(0.35, 0, 0.94), v(0.15, 0, 0.99))
        rig.arm_dirs('Right', v(-0.35, 0, 0.94), v(-0.15, 0, 0.99))

    rig.reset(); rig.key(1)
    open_(); rig.key(1 + frames // 2)
    rig.reset(); rig.key(1 + frames)
    return frames


def knee_plank(rig):
    """From Mixamo's plank: knees down on the floor, shins up, one line from shoulders to knees."""
    def pose():
        rig.reset()
        for side in ('Left', 'Right'):
            hip = rig.head(side + 'UpLeg')
            toward_feet = rig.base_heads[P + side + 'Foot'] - hip
            flat = Vector((toward_feet.x, toward_feet.y, 0)).normalized()
            reach = math.sqrt(max(THIGH ** 2 - (hip.z - 0.06) ** 2, 0.01))
            knee = Vector((hip.x + flat.x * reach, hip.y + flat.y * reach, 0.06))
            rig.aim(side + 'UpLeg', knee - hip)
            rig.aim(side + 'Leg', flat * 0.85 + Vector((0, 0, 0.53)))

    pose(); rig.key(1)
    pose(); rig.key(91)
    return 90


MOVES = {
    'march': lambda rig: march(rig),
    'lunge': lambda rig: lunge(rig, 105),
    'reach': lambda rig: reach(rig),
    'sumo-squat': lambda rig: sumo_squat(rig, 105),
    'step-touch': lambda rig: step_touch(rig),
    'high-knees': lambda rig: high_knees(rig),
    'side-bend': lambda rig: side_bend(rig),
    'step-jack': lambda rig: step_jack(rig, 48),
    'knee-plank': lambda rig: knee_plank(rig),
}


def build(name, arm):
    """Replace the imported animation with the scripted move; returns its loop length in frames."""
    arm.animation_data.action = None
    rig = Rig(arm)
    frames = MOVES[name](rig)
    for fcurve in arm.animation_data.action.fcurves if hasattr(arm.animation_data.action, 'fcurves') else []:
        for point in fcurve.keyframe_points:
            point.interpolation = 'BEZIER'
            point.easing = 'EASE_IN_OUT'
    return frames
