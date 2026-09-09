import {randomUUID} from "node:crypto";
import {NextResponse} from "next/server";
import {FinTSClient,FinTSConfig} from "lib-fints";
import {and,eq,inArray} from "drizzle-orm";
import {z} from "zod";
import {db} from "@/db";
import {accounts,systemSettings} from "@/db/schema";
import {cleanupFinTsSessions,finTsSessions,type PendingFinTsSession} from "@/features/fints/pending-sessions";
import {requireUser} from "@/lib/current-user";
import {encryptSecret} from "@/lib/security";
import {memberAndVisibleAccountIds} from "@/lib/visible-accounts";
import {writeAudit} from "@/lib/audit";
import {isTrustedSparkasseEndpoint} from "@/features/fints/bank-directory";

const discoverSchema=z.object({action:z.literal("discover"),productId:z.string().trim().min(1).max(64),endpoint:z.string().url().startsWith("https://"),blz:z.string().regex(/^\d{8}$/),userId:z.string().trim().min(1).max(64),pin:z.string().min(1).max(64)});
const methodSchema=z.object({action:z.literal("select_method"),token:z.string().uuid(),tanMethodId:z.number().int(),tanMediaName:z.string().max(100).optional()});
const tanSchema=z.object({action:z.literal("continue_tan"),token:z.string().uuid(),tan:z.string().max(20).optional()});
const saveSchema=z.object({action:z.literal("save"),token:z.string().uuid(),bankAccountNumber:z.string().min(1),localAccountId:z.string().uuid()});
const bodySchema=z.discriminatedUnion("action",[discoverSchema,methodSchema,tanSchema,saveSchema]);
const answers=(response:{bankAnswers?:Array<{code:number;text:string}>})=>response.bankAnswers?.map(answer=>`${answer.code}: ${answer.text}`).join(" · ")||"Die Sparkasse hat die Anfrage abgelehnt.";
function result(session:PendingFinTsSession,response:{success:boolean;requiresTan:boolean;tanReference?:string;tanChallenge?:string;tanPhoto?:{mimeType:string;image:Uint8Array};bankingInformation?:PendingFinTsSession["bankingInformation"]}){
 if(response.bankingInformation)session.bankingInformation=response.bankingInformation;
 if(response.requiresTan){session.tanReference=response.tanReference;return{stage:"tan",challenge:response.tanChallenge??"Bitte den Auftrag mit deinem TAN-Verfahren freigeben.",photo:response.tanPhoto?`data:${response.tanPhoto.mimeType};base64,${Buffer.from(response.tanPhoto.image).toString("base64")}`:null,isDecoupled:session.client.config.selectedTanMethod?.isDecoupled??false}}
 const info=response.bankingInformation??session.bankingInformation??session.client.config.bankingInformation;
 const bankAccounts=info?.upd?.bankAccounts??[];
 if(response.success&&bankAccounts.length)return{stage:"accounts",accounts:bankAccounts.map(account=>({accountNumber:account.accountNumber,iban:account.iban??null,bic:account.bic??null,currency:account.currency,holder:account.holder1,product:account.product??"Sparkassenkonto",type:account.accountType}))};
 return null;
}

export async function GET(){try{const user=await requireUser();const{member,accountIds}=await memberAndVisibleAccountIds(user.userId);const key=`fints.sparkasse.${member.id}`;const[stored,localAccounts]=await Promise.all([db.select({valueJson:systemSettings.valueJson}).from(systemSettings).where(eq(systemSettings.key,key)).limit(1),accountIds.length?db.select({id:accounts.id,name:accounts.name,kind:accounts.kind,ibanLast4:accounts.ibanLast4}).from(accounts).where(and(eq(accounts.householdId,member.householdId),inArray(accounts.id,accountIds))):Promise.resolve([])]);return NextResponse.json({configured:Boolean(stored[0]),connection:stored[0]?.valueJson??null,localAccounts})}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"FinTS-Status konnte nicht geladen werden."},{status:400})}}

export async function POST(request:Request){try{
 const user=await requireUser();const{member,accountIds}=await memberAndVisibleAccountIds(user.userId);const body=bodySchema.parse(await request.json());cleanupFinTsSessions();
 if(body.action==="discover"){
  if(!isTrustedSparkasseEndpoint(body.endpoint))throw new Error("Die FinTS-Adresse gehört nicht zu einem bekannten Sparkassen-Bankserver. Bitte ermittle sie über die BLZ oder prüfe die Adresse.");
  const config=FinTSConfig.forFirstTimeUse(body.productId,process.env.APP_VERSION??"0.5",body.endpoint,body.blz,body.userId,body.pin);
  const client=new FinTSClient(config),response=await client.synchronize();
  if(!response.success&&!response.bankingInformation)throw new Error(answers(response));
  const token=randomUUID(),session:PendingFinTsSession={client,productId:body.productId,endpoint:body.endpoint,blz:body.blz,userId:body.userId,pin:body.pin,bankingInformation:response.bankingInformation,createdAt:Date.now()};finTsSessions.set(token,session);
  const methods=config.availableTanMethods.map(method=>({id:method.id,name:method.name,isDecoupled:method.isDecoupled,media:method.activeTanMedia,mediaRequired:String(method.tanMediaRequirement).toLowerCase().includes("required")}));
  if(!methods.length)throw new Error("Die Sparkasse hat kein unterstütztes PIN/TAN-Verfahren geliefert.");
  return NextResponse.json({token,stage:"tan_method",methods,bankMessages:response.bankingInformation?.bankMessages??[]});
 }
 const session=finTsSessions.get(body.token);if(!session)throw new Error("Die Einrichtungssitzung ist abgelaufen. Bitte beginne erneut.");
 if(body.action==="select_method"){
  session.client.selectTanMethod(body.tanMethodId);if(body.tanMediaName)session.client.selectTanMedia(body.tanMediaName);session.tanMethodId=body.tanMethodId;session.tanMediaName=body.tanMediaName;
  const response=await session.client.synchronize();if(!response.success)throw new Error(answers(response));const next=result(session,response);if(!next)throw new Error("Die Sparkasse hat noch keine Konten geliefert.");return NextResponse.json({token:body.token,...next});
 }
 if(body.action==="continue_tan"){
  if(!session.tanReference)throw new Error("Die TAN-Referenz ist abgelaufen. Bitte beginne erneut.");const response=await session.client.synchronizeWithTan(session.tanReference,body.tan||undefined);if(!response.success)throw new Error(answers(response));const next=result(session,response);if(!next)throw new Error("Die Sparkasse hat nach der Freigabe keine Konten geliefert.");return NextResponse.json({token:body.token,...next});
 }
 if(!accountIds.includes(body.localAccountId))throw new Error("Das lokale Konto ist nicht zugänglich.");
 const bankAccount=session.client.config.bankingInformation.upd?.bankAccounts.find(account=>account.accountNumber===body.bankAccountNumber);if(!bankAccount)throw new Error("Sparkassenkonto nicht gefunden.");
 const encrypted=encryptSecret(JSON.stringify({productId:session.productId,endpoint:session.endpoint,blz:session.blz,userId:session.userId,pin:session.pin,tanMethodId:session.tanMethodId,tanMediaName:session.tanMediaName,bankAccountNumber:body.bankAccountNumber,bankingInformation:session.client.config.bankingInformation}));
 const key=`fints.sparkasse.${member.id}`;await db.insert(systemSettings).values({key,valueEncrypted:encrypted,valueJson:{provider:"Sparkasse FinTS",blz:session.blz,ibanLast4:bankAccount.iban?.slice(-4)??null,localAccountId:body.localAccountId,bankProduct:bankAccount.product??null,configuredAt:new Date().toISOString()},updatedBy:user.userId}).onConflictDoUpdate({target:systemSettings.key,set:{valueEncrypted:encrypted,valueJson:{provider:"Sparkasse FinTS",blz:session.blz,ibanLast4:bankAccount.iban?.slice(-4)??null,localAccountId:body.localAccountId,bankProduct:bankAccount.product??null,configuredAt:new Date().toISOString()},updatedBy:user.userId,updatedAt:new Date()}});finTsSessions.delete(body.token);await writeAudit("configuration","Eine lesende Sparkassen-FinTS-Verbindung wurde eingerichtet.",{userId:user.userId,metadata:{localAccountId:body.localAccountId,blz:session.blz}});return NextResponse.json({ok:true});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Sparkassen-Verbindung konnte nicht eingerichtet werden."},{status:400})}}
