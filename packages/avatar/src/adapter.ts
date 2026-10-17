/*
 * Framework adapters build on these react-free primitives: identity and
 * geometry, the rest pose, string rendering, and the live rig. A non-React
 * adapter imports only from here and never loads React. The main entry stays
 * a name-in, SVG-out surface.
 */

export type { Activity, FxKind } from './activity'
export { ACTIVITIES, activityLoop, blend } from './activity'
export { Live } from './animate'
export {
  type DrawOptions,
  draw,
  type Gaze,
  type Node,
  type Pose,
  restPose,
} from './draw'
export { type AvatarOptions, serialize, settle, toSvg } from './svg'
export {
  deepOf,
  defineTheme,
  type Ink,
  parseHex,
  THEMES,
  type Theme,
  themeOf,
} from './themes'
