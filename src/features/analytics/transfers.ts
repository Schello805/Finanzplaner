export function isBalancedTransfer(first:{accountId:string;amount:number|string;currency:string},second:{accountId:string;amount:number|string;currency:string}){
  if(first.accountId===second.accountId||first.currency!==second.currency)return false;
  return Math.round(Number(first.amount)*100)+Math.round(Number(second.amount)*100)===0;
}

export type TransferCandidateInput={id:string;accountId:string;accountName:string;bookedOn:string;amount:number|string;currency:string;specialType?:string};
export function findTransferCandidates(rows:TransferCandidateInput[]){
  const used=new Set<string>();const result:Array<{first:TransferCandidateInput;second:TransferCandidateInput}>=[];
  for(const first of rows){if(used.has(first.id)||first.specialType==="transfer")continue;const firstDate=Date.parse(`${first.bookedOn}T12:00:00Z`);const second=rows.find(item=>!used.has(item.id)&&item.id!==first.id&&item.specialType!=="transfer"&&isBalancedTransfer(first,item)&&Math.abs(Date.parse(`${item.bookedOn}T12:00:00Z`)-firstDate)<=3*86_400_000);if(!second)continue;used.add(first.id);used.add(second.id);result.push({first,second});}
  return result;
}
