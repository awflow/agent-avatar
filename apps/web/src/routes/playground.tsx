import { createFileRoute } from '@tanstack/react-router'
import { PlaygroundPage } from '@/components/playground-page'
import { SITE } from '@/lib/docs'

const TITLE = 'Playground · @awflow/avatar'
const DESCRIPTION =
  'Type a name, meet its face. Every theme, shape, expression, activity, wardrobe item and reaction, live, with the code for each framework.'

export const Route = createFileRoute('/playground')({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      { property: 'og:title', content: TITLE },
      { property: 'og:description', content: DESCRIPTION },
      { property: 'og:url', content: `${SITE}/playground` },
      { name: 'twitter:title', content: TITLE },
      { name: 'twitter:description', content: DESCRIPTION },
    ],
    links: [{ rel: 'canonical', href: `${SITE}/playground` }],
  }),
  component: PlaygroundPage,
})
