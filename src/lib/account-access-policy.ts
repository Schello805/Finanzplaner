export type AccountAccessInput={id:string;kind:"personal"|"joint"|"child";ownerMemberId:string|null};
export function accountIsVisible(account:AccountAccessInput,member:{id:string;kind:"adult"|"managed_child"},childIds:ReadonlySet<string>,sharedAccountIds:ReadonlySet<string>){
  if(account.kind==="joint")return member.kind==="adult";
  if(account.ownerMemberId===member.id)return true;
  if(account.kind==="child"&&account.ownerMemberId&&childIds.has(account.ownerMemberId))return true;
  return member.kind==="adult"&&sharedAccountIds.has(account.id);
}
