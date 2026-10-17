/*
 * /playground, per the approved "05 · Playground" board: a live stage whose
 * eyes follow the pointer, reactions, the face at four sizes, and every
 * prop as a row of pills, with the code for each framework underneath.
 * "auto" leaves a prop out, so the name decides it.
 */
import {
  ACTIVITIES,
  EXPRESSIONS,
  FACES,
  LISTS,
  PROPS,
  REACTIONS,
  type Reaction,
  THEMES,
} from '@awflow/avatar'
import { Avatar, type AvatarProps, type AvatarRef } from '@awflow/avatar-react'
import { useMemo, useRef, useState } from 'react'
import { Shell } from '@/components/chrome'
import { FrameworkTabs } from '@/components/framework-tabs'
import type { Look } from '@/lib/frameworks'

const AUTO = 'auto'
const auto = (list: readonly string[]) => [AUTO, ...list]

const CONTROLS = {
  theme: Object.keys(THEMES),
  framing: ['peek', 'full'],
  frame: [AUTO, 'circle', 'square', 'none'],
  shape: auto(Object.keys(FACES)),
  expression: Object.keys(EXPRESSIONS),
  activity: Object.keys(ACTIVITIES),
  headwear: auto(LISTS.headwear),
  eyewear: auto(LISTS.eyewear),
  neckwear: auto(LISTS.neckwear),
  decor: auto(LISTS.decor),
  prop: [...PROPS],
  motif: auto(LISTS.motif),
  dress: ['off', 'on'],
} as const

type Key = keyof typeof CONTROLS
type State = Record<Key, string>

const START: State = {
  theme: 'soft',
  framing: 'peek',
  frame: AUTO,
  shape: AUTO,
  expression: 'normal',
  activity: 'idle',
  headwear: AUTO,
  eyewear: AUTO,
  neckwear: AUTO,
  decor: AUTO,
  prop: 'none',
  motif: AUTO,
  dress: 'off',
}

// the value each prop takes when it is left out
const DEFAULT: Partial<State> = {
  theme: 'soft',
  framing: 'peek',
  expression: 'normal',
  activity: 'idle',
  prop: 'none',
  dress: 'off',
}

/** The props the controls set, defaults and "auto" left out. */
function lookOf(s: State): Look {
  const out: Look = {}
  for (const k of Object.keys(CONTROLS) as Key[]) {
    const v = s[k]
    if (v === AUTO || DEFAULT[k] === v) continue
    if (k === 'frame') {
      if (v === 'circle') out.square = false
      else if (v === 'square') out.square = true
      else out.frame = 'none'
    } else if (k === 'dress') out.dress = true
    else out[k] = v
  }
  return out
}

const pick = <T,>(list: readonly T[]) =>
  list[Math.floor(Math.random() * list.length)]!

function shuffle(s: State): State {
  const next = { ...s }
  for (const k of [
    'shape',
    'expression',
    'activity',
    'headwear',
    'eyewear',
    'neckwear',
    'decor',
    'prop',
    'motif',
  ] as const)
    next[k] = pick(CONTROLS[k].filter((v) => v !== AUTO))
  return next
}

const LEGEND: Partial<Record<Key, string>> = { decor: 'Face' }

/* one single-choice group: native radios dressed as pills, so arrows,
 * roving focus and the group name come from the browser */
function Row({
  label,
  k,
  state,
  set,
}: {
  label: string
  k: Key
  state: State
  set: (k: Key, v: string) => void
}) {
  return (
    <fieldset className='ctl-set'>
      <legend className='sr-only'>{LEGEND[k] ?? label}</legend>
      <div className='ctl'>
        <span className='lbl' aria-hidden='true'>
          {label}
        </span>
        <div className='pills'>
          {CONTROLS[k].map((v) => (
            <label key={v} className='pill-radio'>
              <input
                type='radio'
                className='sr-only'
                name={`pg-${k}`}
                value={v}
                checked={state[k] === v}
                onChange={() => set(k, v)}
              />
              <span className='pill'>{v}</span>
            </label>
          ))}
        </div>
      </div>
    </fieldset>
  )
}

const SIZES = [24, 44, 72, 112]

export function PlaygroundPage() {
  const [name, setName] = useState('Linh')
  const [state, setState] = useState<State>(START)
  const ref = useRef<AvatarRef>(null)
  const look = useMemo(() => lookOf(state), [state])
  const props = look as Omit<AvatarProps, 'name'>
  const set = (k: Key, v: string) => setState((s) => ({ ...s, [k]: v }))
  const who = name || ' '
  return (
    <Shell>
      <main className='wrap pg'>
        <div className='pg-left'>
          <div className='pg-title'>
            <h1>Playground</h1>
            <span className='lbl'>Eyes follow your pointer</span>
          </div>
          <div className='stage' data-frame={state.frame}>
            <Avatar
              ref={ref}
              name={who}
              {...props}
              size={360}
              animate
              gaze='pointer'
            />
          </div>
          <span className='lbl'>Reactions · react(name)</span>
          <div className='reactions'>
            {(Object.keys(REACTIONS) as Reaction[]).map((r) => (
              <button
                key={r}
                type='button'
                className='rbtn'
                onClick={() => ref.current?.react(r)}
              >
                {r}
              </button>
            ))}
          </div>
          <div className='sizes'>
            <span className='lbl'>Sizes</span>
            {SIZES.map((px) => (
              <Avatar
                key={px}
                name={who}
                {...props}
                square={false}
                size={px}
                title={`${px} px`}
              />
            ))}
          </div>
        </div>
        <div className='pg-right'>
          <label className='lbl' htmlFor='pg-name'>
            Name
          </label>
          <div className='pg-name'>
            <input
              id='pg-name'
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='Type a name'
              spellCheck={false}
              maxLength={40}
            />
            <button
              type='button'
              className='btn btn-dark'
              onClick={() => setState(shuffle)}
            >
              Shuffle overrides
            </button>
            <button
              type='button'
              className='btn btn-ghost'
              onClick={() => setState(START)}
            >
              Back to the name
            </button>
          </div>
          <Row label='Theme' k='theme' state={state} set={set} />
          <Row label='Framing' k='framing' state={state} set={set} />
          <Row label='Frame' k='frame' state={state} set={set} />
          <Row label='Shape' k='shape' state={state} set={set} />
          <Row label='Expression' k='expression' state={state} set={set} />
          <Row label='Activity' k='activity' state={state} set={set} />
          <p className='hint'>
            Wardrobe: <strong>auto</strong> lets the name pick, so it only
            differs from <strong>none</strong> when Dress is on.
          </p>
          <Row label='Headwear' k='headwear' state={state} set={set} />
          <Row label='Eyewear' k='eyewear' state={state} set={set} />
          <Row label='Neck · face' k='neckwear' state={state} set={set} />
          <Row label='' k='decor' state={state} set={set} />
          <Row label='Prop' k='prop' state={state} set={set} />
          <Row label='Motif' k='motif' state={state} set={set} />
          <Row label='Dress' k='dress' state={state} set={set} />
          <div className='pg-code'>
            <FrameworkTabs
              name={who.trim() ? name : 'Linh'}
              look={{ ...look, animate: true, gaze: 'pointer' }}
              install={false}
              dark
            />
          </div>
        </div>
      </main>
    </Shell>
  )
}
