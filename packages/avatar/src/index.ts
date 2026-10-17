export type { Activity, ActivitySpec } from './activity'
export { ACTIVITIES, activityLoop, blend } from './activity'
export type {
  DrawOptions,
  Frame,
  Framing,
  Gaze,
  Node,
  Pose,
  Ring,
} from './draw'
/** Low level: the drawing tree that toSvg and every adapter render. */
export { draw } from './draw'
export type { FxAnchor, FxKind, FxShape } from './fx'
export { FX_KINDS, fxShapes } from './fx'
export type { Axes, Identity, Persona } from './identity'
export { AXES, identify, LISTS, tidy } from './identity'
export type { AvatarHandle, MountOptions } from './mount'
/** A live or static avatar in any element, with an imperative handle. */
export { attach, isIdentityChange, mount } from './mount'
/** For plugin authors: build a drawing-tree node. */
export { el } from './node'
export type { SwingSpec } from './physics'
export type {
  AccessoryPlugin,
  FxPlugin,
  Plugin,
  PropPlugin,
  ShapePlugin,
  ThemePlugin,
} from './plugins'
export {
  defineAccessory,
  defineFx,
  defineProp,
  defineShape,
  plugins,
  registerPlugins,
} from './plugins'
export type { Reaction, ReactionSpec } from './reactions'
export { REACTIONS } from './reactions'
/** An animation as deterministic SVG strings, one per frame. */
export { FRAME_LIMITS, frames } from './rig'
export type { AvatarOptions } from './svg'
export { settle, toSvg } from './svg'
export type {
  AccessorySlot,
  Axis,
  Brows,
  Channel,
  Cheeks,
  Color,
  Decor,
  Expression,
  Eyes,
  Eyewear,
  Face,
  FaceGeom,
  Headwear,
  Motif,
  Mouth,
  Neckwear,
  Prop,
  Trait,
} from './tables'
export {
  ACCESSORIES,
  COLORS,
  EXPRESSIONS,
  FACES,
  GROUPS,
  LATEST,
  PARTS,
  PROPS,
  VERSIONS,
} from './tables'
export type { Ink, Theme } from './themes'
export { deepOf, defineTheme, parseHex, THEMES, themeOf } from './themes'
export type {
  SwingSlot,
  WearCtx,
  WearDraw,
  WearSlot,
} from './wardrobe/context'
/** For plugin authors: where a hat sits, and a slot's swing this frame. */
export { crownTop, swingOf } from './wardrobe/kit'
