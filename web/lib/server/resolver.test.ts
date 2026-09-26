import { describe, expect, it } from "vitest";
import type { ChainBet, OracleTerms } from "../solana/codec";
import { decide } from "./resolver";

const chain = { eventDeadline: 1000 } as ChainBet;
const o = (kind: OracleTerms["kind"]): OracleTerms => ({ feed: "SOL_USD", kind, threshold: 250_000_000n });

describe("resolver decide()", () => {
  it("TOUCH_ABOVE resolves YES early once touched, NO only after the deadline", () => {
    expect(decide(chain, o("TOUCH_ABOVE"), 251_000_000n, 500)).toBe("YES");
    expect(decide(chain, o("TOUCH_ABOVE"), 249_000_000n, 500)).toBeNull();
    expect(decide(chain, o("TOUCH_ABOVE"), 249_000_000n, 1000)).toBe("NO");
  });
  it("ABOVE_AT / BELOW_AT wait for the deadline", () => {
    expect(decide(chain, o("ABOVE_AT"), 300_000_000n, 999)).toBeNull();
    expect(decide(chain, o("ABOVE_AT"), 250_000_000n, 1000)).toBe("YES"); // inclusive
    expect(decide(chain, o("BELOW_AT"), 250_000_001n, 1001)).toBe("NO");
  });
});
