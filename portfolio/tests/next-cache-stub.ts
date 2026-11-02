// Outside the Next.js runtime there is no incremental cache: run cached functions directly.
export const unstable_cache = <T extends (...args: never[]) => unknown>(fn: T) => fn;
export const revalidateTag = () => {};
export const revalidatePath = () => {};
