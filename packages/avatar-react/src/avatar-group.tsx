/*
 * <AvatarGroup speaker="Ada">: the avatars inside look at whoever is
 * speaking; the speaker looks ahead. No wrapper element is rendered.
 */
import {
  createElement,
  type ReactElement,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react'
import { createGroup, GroupContext } from './group'

export type AvatarGroupProps = {
  /** The name of the avatar speaking now; none looks everyone ahead. */
  speaker?: string
  children?: ReactNode
}

const useIsoLayoutEffect =
  typeof document === 'undefined' ? useEffect : useLayoutEffect

export function AvatarGroup({
  speaker,
  children,
}: AvatarGroupProps): ReactElement {
  const [group] = useState(createGroup)
  useIsoLayoutEffect(() => {
    group.setSpeaker(speaker)
  }, [group, speaker])
  return createElement(GroupContext.Provider, { value: group }, children)
}
