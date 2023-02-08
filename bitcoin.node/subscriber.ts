export type SubscribeEvent<T extends Function> = (cb: T) => () => void;

export function buildSubscriber<T extends Function>(
  listeners: T[]
): SubscribeEvent<T> {
  return (cb) => {
    listeners.push(cb);
    return () => {
      const idx = listeners.indexOf(cb);
      if (idx < 0) {
        throw new Error(`Unable to unsubscribe`);
      }
      listeners.splice(idx, 1);
    };
  };
}
