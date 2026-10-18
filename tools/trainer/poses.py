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

    def rotate_about(self, name, pivot, axis, degrees):
        """Turn a bone (and everything below it) about a world-space pivot, e.g. the whole body about the toes."""
        pb = self.arm.pose.bones[P + name]
        turn = Matrix.Translation(pivot) @ Matrix.Rotation(math.radians(degrees), 4, axis) @ Matrix.Translation(-pivot)
        self._set_world(pb, turn @ (self.world @ pb.matrix))

    def arm_to(self, side, hand, elbow_dir):
        """Place an arm so the hand reaches `hand` (e.g. stays on the floor), bending the elbow toward `elbow_dir`."""
        shoulder = self.head(side + 'Arm')
        upper = (self.base_heads[P + side + 'ForeArm'] - self.base_heads[P + side + 'Arm']).length
        fore = (self.base_heads[P + side + 'Hand'] - self.base_heads[P + side + 'ForeArm']).length
        to_hand = hand - shoulder
        d = min(to_hand.length, upper + fore - 1e-4)
        u = to_hand.normalized()
        a = (upper ** 2 - fore ** 2 + d ** 2) / (2 * d)
        h = math.sqrt(max(upper ** 2 - a ** 2, 0))
        bend = (elbow_dir - u * elbow_dir.dot(u)).normalized()
        elbow = shoulder + u * a + bend * h
        self.aim(side + 'Arm', elbow - shoulder)
        self.aim(side + 'ForeArm', shoulder + u * d - elbow)

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


def split_squat(rig, frames):
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


def arm_circles(rig):
    """Arms straight out to the sides, drawing circles forward: one circle every 1.5 s."""
    keys = 8
    for k in range(keys + 1):
        a = 2 * math.pi * k / keys
        rig.reset()
        for side, sign in (('Left', 1), ('Right', -1)):
            out = v(sign, -0.28 * math.sin(a), 0.28 * math.cos(a))
            rig.arm_dirs(side, out, out)
        rig.key(1 + round(45 * k / keys))
    return 45


def hands_on_hips(rig):
    rig.arm_dirs('Left', v(0.62, 0.15, -0.77), v(-0.55, -0.1, 0.2))
    rig.arm_dirs('Right', v(-0.62, 0.15, -0.77), v(0.55, -0.1, 0.2))


def hip_circles(rig):
    """Hands on hips, the hips drawing slow circles over planted feet: one circle every 3 s."""
    keys = 8
    for k in range(keys + 1):
        a = 2 * math.pi * k / keys
        rig.reset()
        rig.move_hips(Vector((0.06 * math.cos(a), 0.05 * math.sin(a), -0.02)))
        rig.leg('Left', ankle(rig, 'Left'))
        rig.leg('Right', ankle(rig, 'Right'))
        hands_on_hips(rig)
        rig.key(1 + round(90 * k / keys))
    return 90


def torso_twist(rig):
    """Hands at the chest, the upper body turning left and right while the hips face forward."""
    def turn(degrees):
        rig.reset()
        rig.arm_dirs('Left', v(0.75, -0.35, -0.55), v(-0.7, -0.65, 0.1))
        rig.arm_dirs('Right', v(-0.75, -0.35, -0.55), v(0.7, -0.65, 0.1))
        for bone, share in (('Spine', 0.3), ('Spine1', 0.35), ('Spine2', 0.35)):
            rig.rotate_about(bone, rig.head(bone), Vector((0, 0, 1)), degrees * share)

    turn(0); rig.key(1)
    turn(45); rig.key(16)
    turn(0); rig.key(31)
    turn(-45); rig.key(46)
    turn(0); rig.key(61)
    return 60


def butt_kicks(rig):
    """Quick feet: one heel at a time kicks up behind towards the seat, arms pumping."""
    def kick(side):
        rig.reset()
        rig.aim(side + 'UpLeg', v(0, 0.2, -0.98))
        rig.aim(side + 'Leg', v(0, 0.8, 0.6))
        rig.restore(side + 'Foot')
        other = 'Right' if side == 'Left' else 'Left'
        rig.arm_dirs(other, v(0, -0.45, -0.89), v(0, -0.6, 0.8))
        rig.arm_dirs(side, v(0, 0.45, -0.89), v(0, -0.2, 0.98))

    def down():
        rig.reset()
        rig.arm_dirs('Left', v(0.05, 0, -1), v(0.05, -0.7, 0.71))
        rig.arm_dirs('Right', v(-0.05, 0, -1), v(-0.05, -0.7, 0.71))

    kick('Left'); rig.key(1)
    down(); rig.key(7)
    kick('Right'); rig.key(13)
    down(); rig.key(19)
    kick('Left'); rig.key(25)
    return 24


def calf_raise(rig, frames):
    """Up onto the toes and slowly back down: up on the first half of the beat."""
    def pose(rise):
        rig.reset()
        rig.move_hips(Vector((0, 0, rise)))
        for side in ('Left', 'Right'):
            rig.leg(side, ankle(rig, side) + Vector((0, 0.04 * rise / 0.07, rise)), foot=v(0, -0.45 * rise / 0.07 - 0.1, -1) if rise else None)

    pose(0); rig.key(1)
    pose(0.07); rig.key(1 + frames // 2)
    pose(0); rig.key(1 + frames)
    return frames


def wall_sit(rig):
    """Back flat against an (unseen) wall, thighs level, knees over the ankles: a still hold."""
    def pose():
        rig.reset()
        rig.move_hips(Vector((0, 0.38, -0.4)))
        for side in ('Left', 'Right'):
            rig.leg(side, ankle(rig, side))
        rig.arm_dirs('Left', v(0.15, -0.6, -0.78), v(0.05, -0.95, -0.3))
        rig.arm_dirs('Right', v(-0.15, -0.6, -0.78), v(-0.05, -0.95, -0.3))

    pose(); rig.key(1)
    pose(); rig.key(91)
    return 90


def step_lunge(rig, frames, moving, to, hips, back_foot, hands=False):
    """
    From standing, one foot steps to `to`, the body lowers and rises, and the foot steps home: a
    forward lunge, a reverse lunge or a curtsy, depending on where the foot goes. `hips` is how far
    the hips travel with the step; `back_foot` points the back foot (heel up, on the toes).
    """
    still = 'Right' if moving == 'Left' else 'Left'
    home_m = ankle(rig, moving)
    home_s = ankle(rig, still)
    forward_step = (to - home_m).dot(FORWARD) > 0

    def arms():
        if hands:
            hands_on_hips(rig)

    def lifted(frac):
        rig.reset()
        rig.move_hips(hips * (frac * 0.5))
        rig.leg(still, home_s)
        rig.leg(moving, home_m.lerp(to, frac) + Vector((0, 0, 0.13)))
        arms()

    def planted(drop):
        rig.reset()
        rig.move_hips(hips + Vector((0, 0, -drop)))
        if forward_step:
            rig.leg(moving, to)
            rig.leg(still, home_s, foot=back_foot)
        else:
            rig.leg(still, home_s)
            rig.leg(moving, to, foot=back_foot)
        arms()

    def standing():
        rig.reset()
        arms()

    at = lambda frac: 1 + round(frames * frac)
    standing(); rig.key(1)
    lifted(0.5); rig.key(at(0.12))
    planted(0.06); rig.key(at(0.26))
    planted(0.42); rig.key(at(0.57))
    planted(0.06); rig.key(at(0.8))
    lifted(0.5); rig.key(at(0.91))
    standing(); rig.key(1 + frames)
    return frames


def forward_lunge(rig, frames):
    """Step forward into the lunge and push back to standing; the back heel lifts."""
    return step_lunge(rig, frames, 'Left', ankle(rig, 'Left') + Vector((0, -0.62, 0)), Vector((0, -0.28, 0)), v(0, -0.55, -0.83))


def reverse_lunge(rig, frames):
    """Step back into the lunge, onto the toes, and return."""
    return step_lunge(rig, frames, 'Right', ankle(rig, 'Right') + Vector((0, 0.62, 0.03)), Vector((0, 0.24, 0)), v(0, -0.55, -0.83))


def curtsy_lunge(rig, frames):
    """The back foot steps behind and across the front one, like a curtsy, then lowers."""
    return step_lunge(rig, frames, 'Right', ankle(rig, 'Right') + Vector((0.32, 0.4, 0.03)), Vector((0.08, 0.14, 0)), v(0.2, -0.55, -0.81), hands=True)


X_AXIS = Vector((1, 0, 0))


def midpoint(a, b):
    return (a + b) / 2


def lower_about(rig, pivot, degrees):
    """Tilt the whole body about `pivot` (toes or knees) so the shoulders go down by `degrees`."""
    before = rig.head('LeftArm').z
    rig.rotate_about('Hips', pivot, X_AXIS, degrees)
    if rig.head('LeftArm').z > before:  # turned the wrong way: undo and go the other way
        rig.rotate_about('Hips', pivot, X_AXIS, -2 * degrees)


def push_up(rig, frames, from_knees=False):
    """From the plank, elbows bend back at about 45° and the straight body lowers about the toes (or knees)."""
    hands = {side: rig.base_heads[P + side + 'Hand'].copy() for side in ('Left', 'Right')}

    def pose(degrees):
        rig.reset()
        if from_knees:
            knees_down(rig)
            pivot = midpoint(rig.head('LeftLeg'), rig.head('RightLeg'))
        else:
            pivot = midpoint(rig.head('LeftToeBase'), rig.head('RightToeBase'))
        if degrees:
            lower_about(rig, pivot, degrees)
        for side, sign in (('Left', 1), ('Right', -1)):
            rig.arm_to(side, hands[side], v(0.55 * sign, 0.35, 0.75))

    down = frames // 2
    pose(0); rig.key(1)
    pose(16 if from_knees else 11); rig.key(1 + down)
    pose(0); rig.key(1 + frames)
    return frames


def knees_down(rig):
    """Knees on the floor, shins up, one line from shoulders to knees (the knee plank)."""
    for side in ('Left', 'Right'):
        hip = rig.head(side + 'UpLeg')
        toward_feet = rig.base_heads[P + side + 'Foot'] - hip
        flat = Vector((toward_feet.x, toward_feet.y, 0)).normalized()
        reach = math.sqrt(max(THIGH ** 2 - (hip.z - 0.06) ** 2, 0.01))
        knee = Vector((hip.x + flat.x * reach, hip.y + flat.y * reach, 0.06))
        rig.aim(side + 'UpLeg', knee - hip)
        rig.aim(side + 'Leg', flat * 0.85 + Vector((0, 0, 0.53)))


def forearm_plank(rig):
    """From the high plank, down onto the forearms: elbows under the shoulders, one straight line."""
    def pose():
        rig.reset()
        toes = midpoint(rig.head('LeftToeBase'), rig.head('RightToeBase'))
        upper = (rig.base_heads[P + 'LeftForeArm'] - rig.base_heads[P + 'LeftArm']).length
        # Lower until the shoulders sit one upper-arm length above the floor.
        for _ in range(3):
            drop = rig.head('LeftArm').z - (upper + 0.05)
            reach = (rig.head('LeftArm') - toes).length
            if abs(drop) < 0.01:
                break
            lower_about(rig, toes, math.degrees(math.asin(max(-0.9, min(0.9, drop / reach)))))
        forward = (midpoint(rig.head('LeftArm'), rig.head('RightArm')) - midpoint(rig.head('LeftUpLeg'), rig.head('RightUpLeg')))
        forward = Vector((forward.x, forward.y, 0)).normalized()
        for side in ('Left', 'Right'):
            rig.arm_dirs(side, v(0, 0, -1), forward)

    pose(); rig.key(1)
    pose(); rig.key(91)
    return 90


def glute_bridge(rig, frames):
    """Lying on the back, knees bent and feet flat: the hips lift into one line from shoulders to knees."""
    def lie_down():
        rig.reset()
        hips = rig.head('Hips')
        rig.rotate_about('Hips', hips, X_AXIS, -90)
        if rig.head('Head').y < hips.y:  # head should end up along +Y, face up
            rig.rotate_about('Hips', hips, X_AXIS, 180)
        # Rest the back on the floor.
        rig.move_hips(Vector((0, 0, 0.1 - min(rig.head('Spine').z, rig.head('Hips').z))))

    def place_limbs():
        hips = rig.head('Hips')
        for side, sign in (('Left', 1), ('Right', -1)):
            foot = Vector((hips.x + 0.1 * sign, hips.y - 0.5, 0.08))
            rig.leg(side, foot, knee_dir=Vector((0, 0, 1)), foot=v(0, -1, -0.15))
            rig.arm_dirs(side, v(0.12 * sign, -1, -0.15), v(0.05 * sign, -1, -0.05))

    def pose(lift):
        lie_down()
        feet = {side: None for side in ('Left', 'Right')}
        if lift:
            shoulders = midpoint(rig.head('LeftArm'), rig.head('RightArm'))
            before = rig.head('Hips').z
            turn = lift
            rig.rotate_about('Hips', shoulders, X_AXIS, turn)
            if rig.head('Hips').z < before:
                turn = -lift
                rig.rotate_about('Hips', shoulders, X_AXIS, -2 * lift)
            # Tilting about the shoulders swings the head into the floor; keep it resting where it was.
            rig.rotate_about('Neck', rig.head('Neck'), X_AXIS, -turn)
        place_limbs()

    up = frames // 2
    pose(0); rig.key(1)
    pose(34); rig.key(1 + up)
    pose(0); rig.key(1 + frames)
    return frames


MOVES = {
    'march': lambda rig: march(rig),
    'lunge': lambda rig: forward_lunge(rig, 105),
    'reverse-lunge': lambda rig: reverse_lunge(rig, 105),
    'split-squat': lambda rig: split_squat(rig, 105),
    'reach': lambda rig: reach(rig),
    'sumo-squat': lambda rig: sumo_squat(rig, 105),
    'step-touch': lambda rig: step_touch(rig),
    'high-knees': lambda rig: high_knees(rig),
    'side-bend': lambda rig: side_bend(rig),
    'step-jack': lambda rig: step_jack(rig, 48),
    'knee-plank': lambda rig: knee_plank(rig),
    'arm-circles': lambda rig: arm_circles(rig),
    'hip-circles': lambda rig: hip_circles(rig),
    'torso-twist': lambda rig: torso_twist(rig),
    'butt-kicks': lambda rig: butt_kicks(rig),
    'calf-raise': lambda rig: calf_raise(rig, 60),
    'wall-sit': lambda rig: wall_sit(rig),
    'curtsy-lunge': lambda rig: curtsy_lunge(rig, 105),
    'push-up': lambda rig: push_up(rig, 90),
    'knee-push-up': lambda rig: push_up(rig, 90, from_knees=True),
    'forearm-plank': lambda rig: forearm_plank(rig),
    'glute-bridge': lambda rig: glute_bridge(rig, 90),
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
