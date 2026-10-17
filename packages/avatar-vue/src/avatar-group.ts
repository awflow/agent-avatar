/*
 * <AvatarGroup speaker="Ada">: the avatars inside look at whoever is
 * speaking; the speaker looks ahead. No wrapper element is rendered.
 */
import { defineComponent, type PropType, provide, watch } from 'vue'
import { createGroup, GroupKey } from './group'

export type AvatarGroupProps = {
  /** The name of the avatar speaking now; none looks everyone ahead. */
  speaker?: string
}

export const AvatarGroup = defineComponent({
  name: 'AvatarGroup',
  props: {
    speaker: { type: String as PropType<string>, default: undefined },
  },
  setup(props, { slots }) {
    const group = createGroup()
    provide(GroupKey, group)
    watch(
      () => props.speaker,
      (s) => group.setSpeaker(s),
      { immediate: true },
    )
    return () => slots.default?.()
  },
})
