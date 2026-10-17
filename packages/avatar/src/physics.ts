/*
 * Accessory physics: a damped pendulum driven by the body's own acceleration.
 * One angle per avatar, in degrees; accessories rotate by it (or a share of
 * it) about their attachment point.
 */

export type Swing = { angle: number; vel: number }
/** stiffness is omega, damping is zeta, maxSwing is in degrees */
export type SwingSpec = {
  stiffness: number
  damping: number
  maxSwing: number
}

export const DEFAULT_SWING: SwingSpec = {
  stiffness: 10,
  damping: 0.18,
  maxSwing: 28,
}

/**
 * Advance the swing by dt seconds (clamped to 0.05). `accel` is the body's
 * acceleration: x and y in frame units per second squared, rot in degrees per
 * second squared.
 */
export function stepSwing(
  s: Swing,
  accel: { x: number; y: number; rot: number },
  dt: number,
  spec: SwingSpec = DEFAULT_SWING,
): Swing {
  const d = Math.min(0.05, Math.max(0, dt))
  const drive = -(0.35 * accel.x + 0.25 * accel.y + 0.12 * accel.rot)
  const { stiffness: om, damping: ze, maxSwing: max } = spec
  let angle = s.angle
  let vel = s.vel
  const h = d / 2
  for (let i = 0; i < 2; i++) {
    vel += (drive - om * om * angle - 2 * ze * om * vel) * h
    angle += vel * h
    if (angle > max) {
      angle = max
      if (vel > 0) vel = 0
    } else if (angle < -max) {
      angle = -max
      if (vel < 0) vel = 0
    }
  }
  return { angle, vel }
}
