/*
 * Framework adapters build on these react-free primitives: identity and
 * geometry, the rest pose, string rendering, and the live rig. A non-React
 * adapter imports only from here and never loads React. The main entry stays
 * a name-in, SVG-out surface.
 */

export { Live } from './animate'
export { draw, type Gaze, type Node, restPose } from './draw'
export { type AvatarOptions, serialize, settle, toSvg } from './svg'
