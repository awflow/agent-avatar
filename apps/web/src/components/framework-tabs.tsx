/*
 * One avatar, seven ways in: a tab per framework over the same props.
 * The home page, Get started and the playground all render through it.
 */
import { useId, useState } from 'react'
import { CodeBlock } from '@/components/code-block'
import {
  FRAMEWORKS,
  type Framework,
  INSTALL,
  LANG,
  type Look,
  snippet,
} from '@/lib/frameworks'

const slug = (f: string) => f.replace(/\W/g, '')

export function FrameworkTabs({
  name,
  look,
  install = true,
  dark = false,
}: {
  name: string
  look: Look
  /** Print the install line above the code. */
  install?: boolean
  /** Tabs for a dark panel (the playground's code box). */
  dark?: boolean
}) {
  const [fw, setFw] = useState<Framework>('Svelte')
  const id = useId()
  const code = snippet(fw, name, look)
  return (
    <div className='fw'>
      <div className='tabs' role='tablist' aria-label='Framework'>
        {FRAMEWORKS.map((f) => (
          <button
            key={f}
            type='button'
            role='tab'
            id={`${id}-${slug(f)}`}
            aria-selected={f === fw}
            aria-controls={`${id}-panel`}
            className={dark ? 'tab tab-dark' : 'tab'}
            onClick={() => setFw(f)}
          >
            {f}
          </button>
        ))}
      </div>
      <div
        role='tabpanel'
        id={`${id}-panel`}
        aria-labelledby={`${id}-${slug(fw)}`}
      >
        <CodeBlock
          code={install ? `${INSTALL[fw]}\n\n${code}` : code}
          lang={LANG[fw]}
        />
      </div>
    </div>
  )
}
