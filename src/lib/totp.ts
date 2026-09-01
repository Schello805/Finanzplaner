import "server-only";
import * as OTPAuth from "otpauth";

export function createTotp(username:string){const secret=new OTPAuth.Secret({size:20});const totp=new OTPAuth.TOTP({issuer:"Finanzplaner",label:username,algorithm:"SHA1",digits:6,period:30,secret});return {secret:secret.base32,uri:totp.toString()}}
export function verifyTotp(secret:string,token:string){const totp=new OTPAuth.TOTP({issuer:"Finanzplaner",label:"Benutzer",algorithm:"SHA1",digits:6,period:30,secret:OTPAuth.Secret.fromBase32(secret)});return totp.validate({token,window:1})!==null}
