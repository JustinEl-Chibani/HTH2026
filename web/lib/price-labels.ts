import { SOURCE_LABEL, type PriceSource } from "./prices";

export function sourceLabel(source: string): string {
  return SOURCE_LABEL[source as PriceSource] ?? source;
}
