import {describe,expect,it} from "vitest";
import {accountIsVisible} from "./account-access-policy";

const children=new Set(["child"]);const shared=new Set(["shared"]);
describe("Kontoberechtigungen",()=>{
  const adult={id:"adult",kind:"adult" as const};
  it("zeigt Gemeinschaftskonten erwachsenen Haushaltsmitgliedern",()=>expect(accountIsVisible({id:"joint",kind:"joint",ownerMemberId:null},adult,children,shared)).toBe(true));
  it("verbirgt das persönliche Konto des Partners ohne Freigabe",()=>expect(accountIsVisible({id:"private",kind:"personal",ownerMemberId:"partner"},adult,children,shared)).toBe(false));
  it("zeigt ein ausdrücklich freigegebenes Partnerkonto",()=>expect(accountIsVisible({id:"shared",kind:"personal",ownerMemberId:"partner"},adult,children,shared)).toBe(true));
  it("zeigt Sorgeberechtigten das Kinderkonto",()=>expect(accountIsVisible({id:"child-account",kind:"child",ownerMemberId:"child"},adult,children,shared)).toBe(true));
  it("gibt Kindern keinen Zugriff auf fremde Privatkonten",()=>expect(accountIsVisible({id:"private",kind:"personal",ownerMemberId:"adult"},{id:"child",kind:"managed_child"},new Set(),new Set())).toBe(false));
  it("gibt Kindern keinen Zugriff auf das Gemeinschaftskonto",()=>expect(accountIsVisible({id:"joint",kind:"joint",ownerMemberId:null},{id:"child",kind:"managed_child"},new Set(),new Set())).toBe(false));
});
