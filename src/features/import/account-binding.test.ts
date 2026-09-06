import{describe,expect,it}from"vitest";import{validateImportAccount}from"./account-binding";
describe("Import-Kontobindung",()=>{
  it("bestätigt eine passende IBAN",()=>expect(validateImportAccount(["DE12 3456 7890 1234"],"1234").status).toBe("verified"));
  it("blockiert ein falsches Zielkonto",()=>expect(validateImportAccount(["DE12 3456 7890 1234"],"9999").status).toBe("mismatch"));
  it("vergleicht eine vollständige IBAN über ihren privaten Fingerabdruck",()=>expect(validateImportAccount(["DE12345678901234"],"1234","richtig",value=>value==="DE12345678901234"?"richtig":"falsch").status).toBe("verified"));
  it("blockiert Dateien mit mehreren Konten",()=>expect(validateImportAccount(["DE001111","DE002222"],"1111").status).toBe("mismatch"));
  it("kennzeichnet fehlende IBAN nur als nicht prüfbar",()=>expect(validateImportAccount(["DE001111"],null).status).toBe("unverified"));
});
