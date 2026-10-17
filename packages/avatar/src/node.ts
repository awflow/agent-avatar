/*
 * The drawing tree's one node type and its two helpers, shared by the
 * drawing, the wardrobe and plugins. Transcribed unchanged from Peek's
 * private n() and prune().
 */

export type Node = {
  tag: string
  key: string
  attrs: Record<string, string>
  children: Node[]
}

export type Attrs = Record<string, string | number | false | undefined>

export function n(
  tag: string,
  key: string,
  attrs: Attrs,
  children: Node[] = [],
): Node {
  const out: Record<string, string> = {}
  for (const k in attrs) {
    const v = attrs[k]
    if (v !== undefined && v !== false) out[k] = String(v)
  }
  return { tag, key, attrs: out, children }
}

/** A drawing-tree node: undefined and false attributes are left out. */
export const el = n

/** Drops what cannot be seen: opacity 0, then groups left empty. */
export function prune(node: Node): Node | null {
  if (node.attrs.opacity === '0') return null
  const children = node.children.map(prune).filter((c) => c !== null)
  if (node.tag === 'g' && children.length === 0) return null
  return { ...node, children }
}
