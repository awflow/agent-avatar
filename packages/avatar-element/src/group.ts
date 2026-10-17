/*
 * The group's gaze logic, the same semantics as the framework adapters:
 * members register their handle under their name; when the speaker changes,
 * every other member looks at the speaker and the speaker looks ahead. With
 * no matching speaker, everyone looks ahead.
 */
import type { AvatarHandle } from '@awflow/avatar/adapter'

export type Group = {
  /** Adds a member; the returned function removes it again. */
  registerMember(name: string, handle: AvatarHandle): () => void
  setSpeaker(name: string | undefined): void
}

type Member = { name: string; handle: AvatarHandle }

export function createGroup(): Group {
  const members: Member[] = []
  let speaker: string | undefined

  const aim = () => {
    const at = members.find((m) => m.name === speaker)?.handle ?? null
    for (const m of members) m.handle.lookAt(m.handle === at ? null : at)
  }

  return {
    registerMember(name, handle) {
      const m = { name, handle }
      members.push(m)
      aim()
      return () => {
        const i = members.indexOf(m)
        if (i < 0) return
        members.splice(i, 1)
        if (m.name === speaker) aim()
      }
    },
    setSpeaker(name) {
      speaker = name
      aim()
    },
  }
}
