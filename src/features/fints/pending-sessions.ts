import "server-only";
import type {FinTSClient} from "lib-fints";
import type {BankingInformation} from "lib-fints";
import type {StatementResponse} from "lib-fints";
type Pending={client:FinTSClient;productId:string;endpoint:string;blz:string;userId:string;pin:string;tanMethodId?:number;tanMediaName?:string;tanReference?:string;bankingInformation?:BankingInformation;createdAt:number};
const globalStore=globalThis as typeof globalThis&{finanzplanerFinTsSessions?:Map<string,Pending>};
export const finTsSessions=globalStore.finanzplanerFinTsSessions??=new Map<string,Pending>();
export function cleanupFinTsSessions(){const cutoff=Date.now()-15*60_000;for(const[key,value]of finTsSessions)if(value.createdAt<cutoff)finTsSessions.delete(key)}
export type {Pending as PendingFinTsSession};
type StatementPending={client:FinTSClient;connection:Record<string,unknown>;settingsKey:string;tanReference:string;localAccountId:string;memberId:string;householdId:string;userId:string;createdAt:number};
const statementStore=globalThis as typeof globalThis&{finanzplanerFinTsStatementSessions?:Map<string,StatementPending>};
export const finTsStatementSessions=statementStore.finanzplanerFinTsStatementSessions??=new Map<string,StatementPending>();
export function cleanupFinTsStatementSessions(){const cutoff=Date.now()-15*60_000;for(const[key,value]of finTsStatementSessions)if(value.createdAt<cutoff)finTsStatementSessions.delete(key)}
export type {StatementPending as PendingStatementSession};
export type {StatementResponse};
