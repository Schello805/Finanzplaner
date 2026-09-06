const clean=(value:string)=>value.normalize("NFKC").replace(/[^A-Za-z0-9]/g,"").toUpperCase();

export function validateImportAccount(references:string[],expectedLast4:string|null,expectedFingerprint?:string|null,fingerprint?:(value:string)=>string){
  const unique=[...new Set(references.map(clean).filter(Boolean))];
  if(unique.length>1)return{status:"mismatch" as const,message:"Die Datei enthält Umsätze für mehrere Kontoreferenzen und kann keinem einzelnen Konto sicher zugeordnet werden."};
  if(!unique.length)return{status:"unverified" as const,message:"Die Importdatei enthält keine prüfbare Kontoreferenz."};
  if(!expectedLast4)return{status:"unverified" as const,message:"Beim Zielkonto ist keine IBAN hinterlegt. Die Kontozuordnung konnte deshalb nicht automatisch geprüft werden."};
  if(/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(unique[0])&&expectedFingerprint&&fingerprint){if(fingerprint(unique[0])!==expectedFingerprint)return{status:"mismatch" as const,message:"Die vollständige IBAN der Datei gehört nicht zum ausgewählten Zielkonto."};return{status:"verified" as const,message:`Die vollständige IBAN •••• ${clean(expectedLast4)} stimmt mit dem ausgewählten Konto überein.`};}
  if(!unique[0].endsWith(clean(expectedLast4)))return{status:"mismatch" as const,message:`Die Kontoreferenz der Datei endet auf ${unique[0].slice(-4)}, das ausgewählte Konto jedoch auf ${clean(expectedLast4)}.`};
  return{status:"verified" as const,message:`Kontoreferenz •••• ${clean(expectedLast4)} stimmt mit dem ausgewählten Konto überein.`};
}
