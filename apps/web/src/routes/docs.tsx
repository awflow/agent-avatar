import { createFileRoute } from '@tanstack/react-router'
import { DocsLayout } from '@/components/docs-page'

export const Route = createFileRoute('/docs')({
  component: DocsLayout,
})
