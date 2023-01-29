export type Nominal<T extends string, U> = U & { _nominal: T };

export function castName<T extends string, U>(
  type: T,
  value: U
): Nominal<T, U> {
  return value as Nominal<T, U>;
}

type GetNominal<T> = T extends infer U & { _nominal: infer V extends string }
  ? V
  : never;

type GetNominalSrc<T> = T extends { _nominal: infer V extends string } & infer U
  ? // Not very good implementation
    Partial<T>
  : never;

/**
 * Use "x as TTT" instead
 */
export function cast<T extends any & { _nominal: string }>(
  value: GetNominalSrc<T>
): T {
  return value as T;
}
