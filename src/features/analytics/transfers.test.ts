import{describe,expect,it}from"vitest";import{findTransferCandidates,isBalancedTransfer}from"./transfers";
describe("interne Umbuchungen",()=>{
  it("erkennt centgenaue Gegenbuchungen verschiedener Konten",()=>expect(isBalancedTransfer({accountId:"a",amount:"-100.00",currency:"EUR"},{accountId:"b",amount:"100.00",currency:"EUR"})).toBe(true));
  it("akzeptiert keine zwei Buchungen desselben Kontos",()=>expect(isBalancedTransfer({accountId:"a",amount:-100,currency:"EUR"},{accountId:"a",amount:100,currency:"EUR"})).toBe(false));
  it("akzeptiert weder Betrags- noch Währungsabweichungen",()=>expect(isBalancedTransfer({accountId:"a",amount:-100,currency:"EUR"},{accountId:"b",amount:99.99,currency:"EUR"})).toBe(false));
  it("schlägt nur zeitnahe Gegenbuchungen verschiedener Konten vor",()=>{const rows=[{id:"1",accountId:"a",accountName:"A",bookedOn:"2026-09-01",amount:-100,currency:"EUR"},{id:"2",accountId:"b",accountName:"B",bookedOn:"2026-09-02",amount:100,currency:"EUR"},{id:"3",accountId:"b",accountName:"B",bookedOn:"2026-09-20",amount:100,currency:"EUR"}];expect(findTransferCandidates(rows)).toHaveLength(1);expect(findTransferCandidates(rows)[0].second.id).toBe("2")});
});
