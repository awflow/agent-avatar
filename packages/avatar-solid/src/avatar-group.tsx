/*
 * <AvatarGroup speaker="Ada">: the avatars inside look at whoever is
 * speaking; the speaker looks ahead. No wrapper element is rendered.
 */
import { createRenderEffect, type JSX } from 'solid-js'
import { createGroup, GroupContext } from './group'

export type AvatarGroupProps = {
  /** The name of the avatar speaking now; none looks everyone ahead. */
  speaker?: string
  children?: JSX.Element
}

export function AvatarGroup(props: AvatarGroupProps): JSX.Element {
  const group = createGroup()
  createRenderEffect(() => group.setSpeaker(props.speaker))
  return (
    <GroupContext.Provider value={group}>
      {props.children}
    </GroupContext.Provider>
  )
}
