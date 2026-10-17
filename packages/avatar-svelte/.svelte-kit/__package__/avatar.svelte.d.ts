import { type Gaze, type AvatarOptions } from '@awflow/avatar/adapter';
type Props = Omit<AvatarOptions, 'gaze' | 'id'> & {
    name: string;
    gaze?: Gaze | 'pointer';
    animate?: boolean;
    id?: string;
    class?: string;
    style?: string;
};
declare const Avatar: import("svelte").Component<Props, {}, "">;
type Avatar = ReturnType<typeof Avatar>;
export default Avatar;
