/*
 * The home page, per the approved "07 · Docs / npm landing" board: a dark
 * hero with a name to try and a live row across themes, then Get started,
 * why it is different, themes, props, plugins, and export and AI.
 */
import { REACTIONS, type Reaction } from '@awflow/avatar'
import { Avatar, type AvatarProps } from '@awflow/avatar-react'
import { Link } from '@tanstack/react-router'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { Shell } from '@/components/chrome'
import { CodeBlock, CopyIcon } from '@/components/code-block'
import { FrameworkTabs } from '@/components/framework-tabs'
import { Inline, plain, SiteLink } from '@/components/inline'
import { codeOf, rowsOf, WEAR_COUNT } from '@/lib/docs'

type Tile = Omit<AvatarProps, 'name'> & { label: string }

const ROW: Tile[] = [
  { theme: 'soft', activity: 'idle', label: 'soft · idle' },
  { theme: 'bold', activity: 'thinking', label: 'bold · thinking' },
  { theme: 'clay', activity: 'speaking', label: 'clay · speaking' },
  { theme: 'neon', activity: 'working', label: 'neon · working' },
  { theme: 'mono', activity: 'done', label: 'mono · done' },
]

const INSTALL = 'npm i @awflow/avatar'

function Hero() {
  const [name, setName] = useState('Ada')
  const [copied, setCopied] = useState(false)
  return (
    <section className='hero'>
      <div className='wrap'>
        <p className='eyebrow'>A string in, a face out · that looks back</p>
        <h1>Faces for your agents, users and anything with a name.</h1>
        <p className='lead'>
          Deterministic SVG avatars with expressions, agent activities, a
          wardrobe and a spring-driven rig. Zero runtime dependencies. Adapters
          for every framework you use.
        </p>
        <div className='hero-cta'>
          <button
            type='button'
            className='install'
            aria-label={`Copy ${INSTALL}`}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(INSTALL)
                setCopied(true)
                setTimeout(() => setCopied(false), 1600)
              } catch {
                // no clipboard: the command stays readable
              }
            }}
          >
            {copied ? 'Copied' : INSTALL}
            <CopyIcon />
          </button>
          <Link to='/docs' className='btn btn-accent'>
            Get started
          </Link>
        </div>
        <label className='hero-name'>
          <span>name =</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder='Type a name'
            spellCheck={false}
            aria-label='A name'
            maxLength={40}
          />
        </label>
        <div className='hero-row'>
          {ROW.map(({ label, ...look }) => (
            <div key={label} className='hero-tile'>
              <Avatar
                name={name || ' '}
                {...look}
                framing='full'
                size={100}
                animate
                gaze='pointer'
              />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

const REACT_LOOP: Reaction[] = ['hop', 'love', 'giggle']

/* the motion card's faces react in turn while the card is on screen */
function ReactingFaces() {
  const ref = useRef<HTMLDivElement>(null)
  const [turn, setTurn] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let t: ReturnType<typeof setInterval> | undefined
    const io = new IntersectionObserver(([e]) => {
      if (e?.isIntersecting)
        t ??= setInterval(() => setTurn((k) => k + 1), 1800)
      else if (t) {
        clearInterval(t)
        t = undefined
      }
    })
    io.observe(el)
    return () => {
      io.disconnect()
      if (t) clearInterval(t)
    }
  }, [])
  return (
    <div className='feat-faces' ref={ref}>
      {REACT_LOOP.map((reaction, i) => (
        <Avatar
          key={reaction}
          name='Juno'
          theme='clay'
          shape='diamond'
          size={50}
          square={false}
          frame='none'
          animate
          reaction={reaction}
          reactKey={turn % 3 === i ? turn : undefined}
        />
      ))}
    </div>
  )
}

type Feat = { title: string; text: string; faces: AvatarProps[] | 'motion' }

const FEATS: Feat[] = [
  {
    title: 'Same name, same face',
    text: "Hashed per axis and versioned. No storage, no network. Pin a version and today's faces never change.",
    faces: (['normal', 'happy', 'curious'] as const).map((expression) => ({
      name: 'Mika',
      theme: 'bold',
      shape: 'cloud',
      expression,
    })),
  },
  {
    title: 'Feels and works',
    text: 'Eleven expressions blend with ten agent activities: happy while working, worried while waiting for you.',
    faces: [
      { name: 'Tao', shape: 'triangle', activity: 'thinking' },
      {
        name: 'Tao',
        shape: 'triangle',
        activity: 'working',
        expression: 'happy',
      },
      {
        name: 'Tao',
        shape: 'triangle',
        activity: 'waiting',
        expression: 'sad',
      },
    ],
  },
  {
    title: 'Five themes, one identity',
    text: 'Soft, Bold, Mono, Neon, Clay. Swap the theme, keep the person. Register your own.',
    faces: (['mono', 'neon', 'clay'] as const).map((theme) => ({
      name: 'Pip',
      shape: 'cloud',
      theme,
    })),
  },
  {
    title: 'A real wardrobe',
    text: `${WEAR_COUNT} items across four slots, plus held props that follow the work and FX that belong to a state.`,
    faces: [
      { name: 'Vee', shape: 'gem', theme: 'bold', headwear: 'wizard' },
      { name: 'Vee', shape: 'gem', theme: 'bold', eyewear: 'visor' },
      {
        name: 'Vee',
        shape: 'gem',
        theme: 'bold',
        headwear: 'crown',
        neckwear: 'bowtie',
      },
    ],
  },
  {
    title: 'Motion that means something',
    text: `Springs, blinks, saccades, ${Object.keys(REACTIONS).length} reactions and accessory physics on one shared loop, paused off-screen, off under reduced motion.`,
    faces: 'motion',
  },
  {
    title: 'Pure SVG, zero deps',
    text: 'toSvg() is a string function that runs on servers and at the edge. Adapters add only the mount and the rig.',
    faces: [
      { name: 'Rho', shape: 'diamond', theme: 'soft', color: 'mint' },
      {
        name: 'Rho',
        shape: 'diamond',
        theme: 'clay',
        color: 'fog',
        frame: 'none',
      },
      { name: 'Rho', shape: 'diamond', theme: 'mono', frame: 'paper' },
    ],
  },
]

const THEME_TILES = ['soft', 'bold', 'mono', 'neon', 'clay'] as const

function Section({
  eyebrow,
  title,
  lead,
  children,
  id,
}: {
  eyebrow: string
  title: string
  lead?: string
  children: ReactNode
  id?: string
}) {
  return (
    <section className='sec' id={id}>
      <div className='wrap'>
        <div className='sec-head'>
          <p className='eyebrow'>{eyebrow}</p>
          <h2 className='h2'>{title}</h2>
          {lead ? <p className='lead'>{lead}</p> : null}
        </div>
        {children}
      </div>
    </section>
  )
}

export function HomePage() {
  const themeCode = codeOf('themes')
  const pluginCode = codeOf('plugins')
  const cliCode = codeOf('export', 3)
  const aiCode = codeOf('ai')
  const peekCode = codeOf('peek', 1)
  return (
    <Shell>
      <main>
        <Hero />
        <Section
          eyebrow='Get started'
          title='One core, seven ways in.'
          lead='The core renders strings and runs the rig. Each adapter is a thin component around it, so every framework gets the same faces, byte for byte.'
        >
          <FrameworkTabs
            name='Linh'
            look={{
              theme: 'bold',
              activity: 'working',
              animate: true,
              gaze: 'pointer',
            }}
          />
        </Section>
        <Section
          eyebrow='Why it is different'
          title='An avatar that is a character, not a picture.'
        >
          <div className='feats'>
            {FEATS.map((f) => (
              <article key={f.title} className='feat'>
                {f.faces === 'motion' ? (
                  <ReactingFaces />
                ) : (
                  <div className='feat-faces'>
                    {f.faces.map((p, i) => (
                      <Avatar
                        key={i}
                        frame='none'
                        {...p}
                        size={50}
                        square={false}
                      />
                    ))}
                  </div>
                )}
                <h3 className='ft'>{f.title}</h3>
                <p className='fd'>{f.text}</p>
              </article>
            ))}
          </div>
        </Section>
        <Section eyebrow='Themes' title='Five built in. Yours in ten lines.'>
          <div className='split'>
            <div className='theme-tiles'>
              {THEME_TILES.map((theme) => (
                <div key={theme} className='theme-tile'>
                  <Avatar name='Tri' shape='triangle' theme={theme} size={96} />
                  {theme}
                </div>
              ))}
            </div>
            <CodeBlock code={themeCode.code} lang={themeCode.lang} />
          </div>
          <p style={{ marginTop: 20 }}>
            <SiteLink to='/docs/themes'>All about themes</SiteLink>
          </p>
        </Section>
        <Section eyebrow='API' title='Props'>
          <div className='props-table'>
            {rowsOf('api').map(([k = '', t = '', d = '']) => (
              <div key={k} className='row'>
                <span className='k'>{plain(k)}</span>
                <span className='t'>{plain(t)}</span>
                <span className='d'>
                  <Inline text={d} />
                </span>
              </div>
            ))}
          </div>
          <p style={{ marginTop: 20 }}>
            <SiteLink to='/docs/api'>Methods and exports</SiteLink>
          </p>
        </Section>
        <Section
          eyebrow='Plugins'
          title='Draw a new hat once. It fits every face.'
          lead="Accessories and props receive the face's geometry (crown, eyes, head width, mouth line), the live pose and the theme, so a custom item blinks, bobs and wobbles with everything else."
        >
          <CodeBlock code={pluginCode.code} lang={pluginCode.lang} />
        </Section>
        <Section
          eyebrow='Export & AI'
          title='Out of the browser, into everything.'
        >
          <div className='cards3'>
            <article className='feat'>
              <h3 className='ft'>CLI and export</h3>
              <p className='fd'>
                PNG, animated GIF and APNG, and sprite sheets from{' '}
                <code className='inline-code'>@awflow/avatar-export</code>. Same
                name, same pixels, on any machine.
              </p>
              <CodeBlock code={cliCode.code} lang={cliCode.lang} />
              <SiteLink to='/docs/export'>Export & CLI</SiteLink>
            </article>
            <article className='feat'>
              <h3 className='ft'>Describe a look</h3>
              <p className='fd'>
                No model inside the package: a JSON schema of every axis plus a
                prompt helper. Your LLM returns overrides; the engine validates
                them.
              </p>
              <CodeBlock code={aiCode.code} lang={aiCode.lang} />
              <SiteLink to='/docs/ai'>AI looks</SiteLink>
            </article>
            <article className='feat'>
              <h3 className='ft'>Coming from Peek?</h3>
              <p className='fd'>
                Pin the Peek style and every stored face stays byte-identical.
                Opt into new parts with an explicit version bump when you are
                ready.
              </p>
              <CodeBlock code={peekCode.code} lang={peekCode.lang} />
              <SiteLink to='/docs/peek'>Coming from Peek</SiteLink>
            </article>
          </div>
        </Section>
      </main>
    </Shell>
  )
}
