import { describe, expect, test } from 'bun:test'
import { draw, type Node, restPose } from './draw'
import { LISTS } from './identity'
import { type AvatarOptions, settle, toSvg } from './svg'
import { EXPRESSIONS, type Expression, type Face } from './tables'

const faces = LISTS.face as Face[]
const expressions = Object.keys(EXPRESSIONS) as Expression[]
const bad = /NaN|undefined|Infinity/

const keys = (node: Node, out: string[] = []) => {
  out.push(node.key)
  for (const c of node.children) keys(c, out)
  return out
}
const tree = (o: AvatarOptions, live = false) => {
  const { who, pose, opts } = settle('Linh', o, live)
  return draw(who, pose, opts)
}

describe('new face parts', () => {
  const NEW: AvatarOptions[] = [
    { eyes: 'pill' },
    { eyes: 'dot' },
    { eyes: 'spark' },
    { mouth: 'cat' },
  ]

  test('new parts draw on every face and expression', () => {
    for (const part of NEW)
      for (const shape of faces)
        for (const expression of expressions) {
          const o = { ...part, shape, expression, size: 200 }
          expect(toSvg('Linh', o)).not.toMatch(bad)
          expect(JSON.stringify(tree(o, true))).not.toMatch(bad)
        }
  })

  test('each new part draws its own shape, not a fallback', () => {
    const svgs = new Set(
      (['oval', 'bead', 'ring', 'pill', 'dot', 'spark'] as const).map((eyes) =>
        toSvg('Linh', { eyes, id: 'p' }),
      ),
    )
    expect(svgs.size).toBe(6)
    const mouths = new Set(
      (['poly', 'round', 'line', 'box', 'cat'] as const).map((mouth) =>
        toSvg('Linh', { mouth, id: 'p' }),
      ),
    )
    expect(mouths.size).toBe(5)
  })

  test('none removes the part', () => {
    const has = (o: AvatarOptions, prefix: string) =>
      keys(tree(o, true)).some((k) => k === prefix || k.startsWith(prefix))
    for (const [part, prefix] of [
      ['brows', 'brow'],
      ['mouth', 'mouth'],
      ['cheeks', 'cheek'],
      ['trait', 'trait'],
    ] as const) {
      // the part is there by default, gone at none
      expect(has({ [part]: LISTS[part][0] }, prefix)).toBe(true)
      expect(has({ [part]: 'none' }, prefix)).toBe(false)
      expect(toSvg('Linh', { [part]: 'none' })).not.toMatch(bad)
    }
  })

  test('happy pill eyes turn into arcs, closed ones into a line', () => {
    const shown = (expression: Expression, key: string) =>
      keys(tree({ eyes: 'pill', expression })).includes(key)
    expect(shown('normal', 'eye0.solid')).toBe(true)
    expect(shown('normal', 'eye0.happy')).toBe(false)
    expect(shown('happy', 'eye0.happy')).toBe(true)
    expect(shown('happy', 'eye0.solid')).toBe(false)
    expect(shown('sleepy', 'eye0.closed')).toBe(true)
  })

  test('a live tree keeps its structure across poses for new parts', () => {
    for (const part of NEW)
      for (const shape of faces) {
        const { who, opts } = settle('Linh', { ...part, shape }, true)
        const at = (e: Expression) => keys(draw(who, restPose(who, e), opts))
        const ref = at('normal')
        for (const e of expressions) expect(at(e)).toEqual(ref)
        // a blink mid-way keeps the structure too
        expect(
          keys(draw(who, { ...restPose(who, 'happy'), blink: 0.5 }, opts)),
        ).toEqual(ref)
      }
  })
})
