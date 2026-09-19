import {describe,expect,it,vi} from "vitest";
import type {FinTSConfig} from "lib-fints";
import {selectTanDevice} from "./tan-device";

function config(requirement=2,media:string[]=[]){
 return {tanMediaName:"old device",selectedTanMethod:{tanMediaRequirement:requirement,activeTanMedia:media},selectTanMedia:vi.fn(function(this:{tanMediaName:string},name:string){this.tanMediaName=name})} as unknown as FinTSConfig;
}
describe("TAN device selection",()=>{
 it("rejects a missing required device before contacting the bank",()=>{
  const c=config();expect(()=>selectTanDevice(c)).toThrow("kein registriertes TAN-Gerät");expect(c.tanMediaName).toBeUndefined();
 });
 it("rejects a manually supplied device that the bank has not delivered",()=>{
  const c=config();expect(()=>selectTanDevice(c,"Apple iPhone")).toThrow("nicht als aktiv gemeldet");
 });
 it("selects the only bank-provided device",()=>{
  const c=config(2,["Registered device"]);expect(selectTanDevice(c)).toBe("Registered device");expect(c.selectTanMedia).toHaveBeenCalledWith("Registered device");
 });
 it("clears stale device names for methods without media",()=>{
  const c=config(0);expect(selectTanDevice(c,"old device")).toBeUndefined();expect(c.tanMediaName).toBeUndefined();
 });
 it("checks the protocol length and rejects newlines",()=>{
  expect(()=>selectTanDevice(config(),"x".repeat(33))).toThrow("32");expect(()=>selectTanDevice(config(),"a\nb")).toThrow("Zeilenumbrüche");
 });
});
