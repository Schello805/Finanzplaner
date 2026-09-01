import {describe,expect,it} from "vitest";
import {detectRecurring} from "./recurring";
describe("wiederkehrende Zahlungen",()=>{it("erkennt monatliche Zahlungen und Preisänderungen",()=>{const result=detectRecurring([{id:"1",bookedOn:"2026-06-01",amount:-10,merchant:"Video GmbH"},{id:"2",bookedOn:"2026-07-01",amount:-10,merchant:"Video GmbH"},{id:"3",bookedOn:"2026-08-01",amount:-12,merchant:"Video GmbH"}]);expect(result[0].cadenceDays).toBe(31);expect(result[0].priceChangePercent).toBe(20)})});
