import "server-only";
import nodemailer from "nodemailer";

export interface SmtpConfig {host:string;port:number;secure:boolean;user?:string;password?:string;from:string}
export function mailer(config:SmtpConfig){return nodemailer.createTransport({host:config.host,port:config.port,secure:config.secure,auth:config.user?{user:config.user,pass:config.password}:undefined,connectionTimeout:10000,socketTimeout:15000})}
export async function sendSafeNotification(config:SmtpConfig,to:string,subject:string,message:string,appUrl:string){return mailer(config).sendMail({from:config.from,to,subject,text:`${message}\n\nFinanzplaner öffnen: ${appUrl}\n\nDiese Nachricht enthält bewusst keine Finanzdaten.`})}
