import type { Actor } from "@/features/crm/store";

export type Bind<T> = {
  [K in keyof T]: T[K] extends (actor: Actor, ...rest: infer R) => infer O ? (...rest: R) => O : T[K];
};

/** Gắn người thực hiện (actor) vào mọi thao tác của store. */
export function bindActions<T extends Record<string, unknown>>(actions: T, actor: Actor): Bind<T> {
  return Object.fromEntries(
    Object.entries(actions).map(([name, fn]) => [name, (...args: unknown[]) => (fn as (...a: unknown[]) => unknown)(actor, ...args)]),
  ) as Bind<T>;
}
