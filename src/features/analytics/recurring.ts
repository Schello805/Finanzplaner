export interface RecurringInput { id:string; bookedOn:string; amount:number; merchant:string }
export interface RecurringCandidate { merchant:string; averageAmount:number; cadenceDays:number; confidence:number; transactionIds:string[]; priceChangePercent:number|null }

export function detectRecurring(inputs:RecurringInput[]):RecurringCandidate[]{
  const groups=new Map<string,RecurringInput[]>();
  for (const input of inputs.filter(x=>x.merchant.trim())) {
    const key=normalize(input.merchant);
    groups.set(key,[...(groups.get(key)??[]),input]);
  }
  const candidates:RecurringCandidate[]=[];
  for(const rows of groups.values()){if(rows.length<3)continue;const sorted=[...rows].sort((a,b)=>a.bookedOn.localeCompare(b.bookedOn));const gaps=sorted.slice(1).map((row,i)=>(Date.parse(row.bookedOn)-Date.parse(sorted[i].bookedOn))/86_400_000);const cadence=median(gaps);if(!((cadence>=25&&cadence<=35)||(cadence>=350&&cadence<=380)||(cadence>=6&&cadence<=8)))continue;const amounts=sorted.map(r=>Math.abs(r.amount));const average=amounts.reduce((a,b)=>a+b,0)/amounts.length;const deviation=amounts.reduce((s,a)=>s+Math.abs(a-average),0)/amounts.length/Math.max(average,.01);const last=amounts.at(-1)!;const previous=amounts.at(-2)!;candidates.push({merchant:sorted[0].merchant,averageAmount:round(average),cadenceDays:Math.round(cadence),confidence:Math.max(.5,Math.min(.99,1-deviation)),transactionIds:sorted.map(r=>r.id),priceChangePercent:previous?round((last-previous)/previous*100):null});}
  return candidates.sort((a,b)=>b.confidence-a.confidence);
}
const normalize=(v:string)=>v.toLocaleLowerCase("de-DE").replace(/[^a-z0-9äöüß]/g,"").replace(/gmbh|ag|kg/g,"");
const median=(a:number[])=>{const s=[...a].sort((x,y)=>x-y);return s[Math.floor(s.length/2)]};
const round=(n:number)=>Math.round(n*100)/100;
