import { describe, expect, test } from 'bun:test'
import { depth, ringWalk, seat } from './draw'
import { LISTS } from './identity'
import { FACES, type Face, type FaceGeom } from './tables'

const faces = LISTS.face as Face[]

/** Every number in a face's geometry, path strings aside. */
function numbers(v: unknown, out: number[] = []): number[] {
  if (typeof v === 'number') out.push(v)
  else if (Array.isArray(v)) for (const x of v) numbers(x, out)
  else if (v && typeof v === 'object')
    for (const x of Object.values(v)) numbers(x, out)
  return out
}

// shapes whose outline dips between bumps or tails: the crown hull is not
// the body there, so the eyes are tested against the bounding box instead
const BUMPY = new Set<Face>(['cloud', 'flower', 'ghost'])

describe('shapes', () => {
  test('the list holds 15 shapes, Peek first', () => {
    expect(faces).toEqual([
      'diamond',
      'semicircle',
      'circle',
      'triangle',
      'cube',
      'drop',
      'gem',
      'cloud',
      'ghost',
      'peak',
      'blob',
      'capsule',
      'bean',
      'arch',
      'flower',
    ])
  })

  test('every shape has finite anchors', () => {
    for (const face of faces) {
      const sh: FaceGeom = FACES[face]
      for (const k of ['hw', 'side', 'neck', 'bottom', 'sink'] as const)
        expect(Number.isFinite(sh[k])).toBe(true)
      for (const v of numbers(sh)) expect(Number.isFinite(v)).toBe(true)
      expect(sh.crown.poly.length).toBeGreaterThanOrEqual(1)
      const s = seat(sh.crown, 0, 0)
      for (const v of [s.x, s.y, s.a]) expect(Number.isFinite(v)).toBe(true)
      const w = ringWalk(sh)
      expect(Number.isFinite(w.rest)).toBe(true)
      expect(Number.isNaN(w.min)).toBe(false)
    }
  })

  test("Peek's four keep their geometry and gain the new anchors", () => {
    const want = {
      circle: [88, 150],
      semicircle: [102, 160],
      diamond: [30, 133],
      triangle: [20, 95],
    } as const
    for (const [face, [hw, side]] of Object.entries(want)) {
      const sh: FaceGeom = FACES[face as Face]
      expect(sh.hw).toBe(hw)
      expect(sh.side).toBe(side)
      expect(sh.neck).toBe(sh.mouth.y + 25)
    }
  })

  test('the new shapes have their own geometry', () => {
    const bodies = new Set(faces.map((f) => JSON.stringify(FACES[f].body)))
    expect(bodies.size).toBe(15)
    for (const face of faces.slice(4)) {
      const sh: FaceGeom = FACES[face]
      expect(sh.neck).toBeCloseTo(sh.mouth.y + 25, 6)
      expect(sh.eyes[0][0] + sh.eyes[1][0]).toBeCloseTo(340, 6)
      expect(sh.cheeks[0][0] + sh.cheeks[1][0]).toBeCloseTo(340, 6)
    }
  })

  test('eyes sit inside the body', () => {
    for (const face of faces) {
      const sh: FaceGeom = FACES[face]
      for (const [x, y] of sh.eyes) {
        if (BUMPY.has(face)) {
          const top = seat(sh.crown, 0, 0).y
          expect(y).toBeGreaterThan(top)
          expect(y).toBeLessThan(sh.bottom)
          expect(Math.abs(x - 170)).toBeLessThan(sh.side)
        } else {
          expect(depth(sh.crown, x, y)).toBeLessThan(0)
        }
      }
    }
  })

  test('mouth and cheeks sit below the eyes and above the bottom', () => {
    for (const face of faces) {
      const sh: FaceGeom = FACES[face]
      const ey = sh.eyes[0][1]
      expect(sh.brow.y).toBeLessThan(ey)
      expect(sh.mouth.y).toBeGreaterThan(ey)
      expect(sh.mouth.y).toBeLessThan(sh.bottom)
      for (const [, cy] of sh.cheeks) expect(cy).toBeGreaterThan(ey)
    }
  })
})
