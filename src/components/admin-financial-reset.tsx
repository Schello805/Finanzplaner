"use client";
import {useState} from "react";
import {AlertTriangle,RotateCcw} from "lucide-react";

export function AdminFinancialReset(){
 const[open,setOpen]=useState(false),[confirmation,setConfirmation]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 async function reset(){
  setBusy(true);setMessage("");
  const response=await fetch("/api/admin/reset-financial-data",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({confirmation})});
  const body=await response.json();setBusy(false);
  if(!response.ok){setMessage(body.error??"Zurücksetzen fehlgeschlagen.");return}
  setMessage(`Zurücksetzen abgeschlossen. ${body.accountsPreserved} Konten blieben erhalten und ${body.categoriesCreated} Standardkategorien wurden angelegt.`);setOpen(false);setConfirmation("");
 }
 return <article className="card border-red-300 p-5"><AlertTriangle className="text-red-600"/><h2 className="mt-3 font-bold">Finanzdaten zurücksetzen</h2><p className="mt-2 text-sm leading-6 muted">Löscht sämtliche Umsätze, Importverläufe, Amazon-Bestellungen, gelernte Regeln, wiederkehrende Kosten, KI-Kostenhistorie und eigene Kategorien des Haushalts. Anschließend werden die Standardkategorien neu angelegt.</p><p className="mt-2 text-sm font-semibold">Konten, Benutzer, Freigaben, Passwörter, persönliche Einstellungen, KI/SMTP-Konfiguration und Importvorlagen bleiben erhalten.</p>{message&&<div role="status" className="mt-4 rounded-xl bg-[var(--surface-soft)] p-3 text-sm">{message}</div>}{!open?<button type="button" onClick={()=>setOpen(true)} className="btn-secondary mt-4 text-red-700"><RotateCcw size={16}/>Zurücksetzen vorbereiten</button>:<div className="mt-5 rounded-xl border border-red-300 bg-red-50 p-4 text-red-950"><h3 className="font-bold">Diese Finanzdaten können nicht wiederhergestellt werden</h3><p className="mt-2 text-sm">Gib zur Bestätigung exakt <strong>ALLES LÖSCHEN</strong> ein.</p><input value={confirmation} onChange={event=>setConfirmation(event.target.value)} className="mt-3 min-h-11 w-full max-w-sm rounded-xl border border-red-300 bg-white px-3" autoComplete="off" aria-label="Bestätigungstext"/><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={()=>{setOpen(false);setConfirmation("")}} className="btn-secondary">Abbrechen</button><button type="button" disabled={busy||confirmation!=="ALLES LÖSCHEN"} onClick={reset} className="btn-primary bg-red-700 hover:bg-red-800"><RotateCcw size={16}/>{busy?"Wird zurückgesetzt …":"Finanzdaten endgültig zurücksetzen"}</button></div></div>}</article>
}
