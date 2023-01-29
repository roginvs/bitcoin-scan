import { Nominal } from "../nominal_types/nominaltypes";

export type BitcoinMessage = Nominal<"bitcoin message", Buffer>;
export type MessagePayload = Nominal<"message payload", Buffer>;
export type BlockHash = Nominal<"block hash", Buffer>;
