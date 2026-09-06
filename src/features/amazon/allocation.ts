export function allocateAmazonCategories(
  items: Array<{ categoryId: string; weight: number }>,
  totalCents: number,
) {
  const weightTotal = items.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
  if (!weightTotal) throw new Error("Artikelbeträge können nicht aufgeteilt werden.");
  const shares=items.map((item,index)=>{const exact=totalCents*Math.max(0,item.weight)/weightTotal;return{index,base:Math.floor(exact),remainder:exact-Math.floor(exact)}});
  let remaining=totalCents-shares.reduce((sum,item)=>sum+item.base,0);
  for(const share of [...shares].sort((a,b)=>b.remainder-a.remainder||b.index-a.index)){if(remaining<=0)break;shares[share.index].base++;remaining--}
  const grouped = new Map<string, number>();
  items.forEach((item,index) => {
    grouped.set(item.categoryId, (grouped.get(item.categoryId) ?? 0) + shares[index].base);
  });
  return grouped;
}
