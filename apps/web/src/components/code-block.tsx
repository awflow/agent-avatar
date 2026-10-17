/*
 * The site's code block: a dark panel, a copy button and a hand-rolled
 * tokenizer (from Peek's site). Keywords, strings, tags, calls, numbers,
 * props, comments and punctuation are all the snippets use, and it keeps a
 * highlighter off the page. Copy always takes the plain text.
 */
import { Fragment, useState } from 'react'
import type { Lang } from '@/lib/docs'

type Kind =
  | 'key'
  | 'str'
  | 'num'
  | 'tag'
  | 'fn'
  | 'prop'
  | 'punct'
  | 'com'
  | 'plain'

const KEYWORDS = new Set([
  'const',
  'let',
  'if',
  'else',
  'return',
  'import',
  'from',
  'export',
  'function',
  'await',
  'async',
  'type',
  'new',
  'default',
  'true',
  'false',
  'null',
  'undefined',
  'as',
  'of',
  'for',
  'declare',
])
const SHELL = new Set(['npm', 'bun', 'pnpm', 'yarn', 'npx', 'bunx', 'printf'])

// comments and strings first, so their insides are never split; the last
// alternative catches anything else, or matchAll would drop it
const TOKEN =
  /(\/\/.*|#.*)|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)|(<\/?[A-Za-z][\w.-]*|\/?>)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$-]*)|([{}()[\],;:.=<>!&|+\-*/?]+)|(\s+)|[\s\S]/g

type Token = { kind: Kind; text: string }

const markup = (lang: Lang) =>
  lang === 'tsx' || lang === 'html' || lang === 'svelte' || lang === 'vue'

export function tokens(line: string, lang: Lang): Token[] {
  const out: Token[] = []
  for (const m of line.matchAll(TOKEN)) {
    const [text, com, str, tag, num, word, punct] = m
    const before = line.slice(0, m.index)
    const after = line.slice(m.index + text.length)
    let kind: Kind = 'plain'
    if (com && (lang === 'bash' ? com.startsWith('#') : com.startsWith('//')))
      kind = 'com'
    else if (str) kind = 'str'
    else if (tag && markup(lang)) kind = 'tag'
    else if (num) kind = 'num'
    else if (word) {
      if (lang === 'bash')
        kind = SHELL.has(word) && !before.trim() ? 'fn' : 'plain'
      else if (KEYWORDS.has(word)) kind = 'key'
      else if (after.startsWith('(')) kind = 'fn'
      else if (markup(lang) && after.startsWith('=') && /[\s:]$/.test(before))
        kind = 'prop'
      else if (/\.\s*$/.test(before) || /^\s*\??:/.test(after)) kind = 'prop'
    } else if (punct && lang !== 'bash') kind = 'punct'
    out.push({ kind, text })
  }
  return out
}

function Line({ code, lang }: { code: string; lang: Lang }) {
  if (lang === 'diff') {
    const sign = code[0]
    const cls = sign === '+' ? 't-add' : sign === '-' ? 't-del' : undefined
    return <span className={cls}>{code}</span>
  }
  let at = 0
  return (
    <>
      {tokens(code, lang).map((t) => {
        const key = at
        at += t.text.length
        return t.kind === 'plain' ? (
          <Fragment key={key}>{t.text}</Fragment>
        ) : (
          <span key={key} className={`t-${t.kind}`}>
            {t.text}
          </span>
        )
      })}
    </>
  )
}

export function CopyButton({
  text,
  label = 'Copy',
  className = 'code-copy',
}: {
  text: string
  label?: string
  className?: string
}) {
  const [done, setDone] = useState(false)
  return (
    <button
      type='button'
      className={className}
      data-done={done}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setDone(true)
          setTimeout(() => setDone(false), 1600)
        } catch {
          // a page without clipboard access keeps the label
        }
      }}
    >
      {done ? <Check /> : <CopyIcon />}
      <span aria-live='polite'>{done ? 'Copied' : label}</span>
    </button>
  )
}

export function CodeBlock({
  code,
  lang = 'tsx',
  title,
  copy = true,
}: {
  code: string
  lang?: Lang
  title?: string
  copy?: boolean
}) {
  const lines = code.split('\n')
  return (
    <div className='code'>
      {title ? <div className='code-title'>{title}</div> : null}
      <pre>
        <code>
          {lines.map((l, i) => (
            <Fragment key={i}>
              <Line code={l} lang={lang} />
              {i < lines.length - 1 ? '\n' : null}
            </Fragment>
          ))}
        </code>
      </pre>
      {copy ? <CopyButton text={code} /> : null}
    </div>
  )
}

const ICON = {
  width: 14,
  height: 14,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

export const CopyIcon = () => (
  <svg aria-hidden='true' {...ICON}>
    <rect x='9' y='9' width='12' height='12' rx='2' />
    <path d='M5 15V5a2 2 0 0 1 2-2h10' />
  </svg>
)
const Check = () => (
  <svg aria-hidden='true' {...ICON}>
    <path d='M20 6 9 17l-5-5' />
  </svg>
)
