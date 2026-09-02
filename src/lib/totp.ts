import "server-only";import * as OTPAuth from "otpauth";
export function createTotpSecret(){return new OTPAuth.Secret({size:20}).base32}
export function totpUri(secret:string,label:string){return new OTPAuth.TOTP({issuer:"Finanzplaner",label,algorithm:"SHA1",digits:6,period:30,secret:OTPAuth.Secret.fromBase32(secret)}).toString()}
export function verifyTotp(secret:string,token:string){return new OTPAuth.TOTP({issuer:"Finanzplaner",label:"Zugang",algorithm:"SHA1",digits:6,period:30,secret:OTPAuth.Secret.fromBase32(secret)}).validate({token:token.replace(/\s/g,""),window:1})!==null}
