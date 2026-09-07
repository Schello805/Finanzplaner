import {describe,expect,it} from "vitest";
import {isForbiddenCategoryName,normalizeCategoryName} from "./policy";
describe("category policy",()=>{
 it.each(["Sonstiges","Einkäufe","Online-Einkäufe","Shopping","Online-Shopping"])("verbietet %s",name=>expect(isForbiddenCategoryName(name)).toBe(true));
 it.each(["Lebensmittel","3D Druck","Kleidung & Schuhe"])("erlaubt %s",name=>expect(isForbiddenCategoryName(name)).toBe(false));
 it("normalisiert Schreibweisen für die Dublettenprüfung",()=>expect(normalizeCategoryName("  Dienstleistungen ")).toBe(normalizeCategoryName("DIENSTLEISTUNGEN")));
});
