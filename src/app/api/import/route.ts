import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, imports, importTemplates, transactions } from "@/db/schema";
import {
  findDuplicates,
  fingerprintFile,
  isPendingTransaction,
  parseBankCsv,
} from "@/features/import/parser";
import { sparkasseCamtV8 } from "@/features/import/sparkasse-camt-v8";
import type {
  ImportTemplate,
  ParsedTransaction,
} from "@/features/import/types";
import { merchantRuleMap, normalizeMerchant } from "@/features/categorization/merchant-rules";
import { requireUser } from "@/lib/current-user";
import { encryptSecret } from "@/lib/security";
import { decodeBankCsv } from "@/features/import/decode";
import { memberAndVisibleAccountIds } from "@/lib/visible-accounts";
async function context(userId: string, accountId: string) {
  const { member, accountIds } = await memberAndVisibleAccountIds(userId);
  if (!accountIds.includes(accountId))
    throw new Error("Konto nicht gefunden oder nicht freigegeben.");
  const [account] = await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.id, accountId),
        eq(accounts.householdId, member.householdId),
      ),
    )
    .limit(1);
  if (!account) throw new Error("Konto nicht gefunden oder nicht freigegeben.");
  return { member, account };
}
function summary(tx: ParsedTransaction) {
  return {
    fingerprint: tx.fingerprint,
    date: tx.bookedOn,
    amount: tx.amount,
    currency: tx.currency,
    counterparty: tx.counterparty ?? "Unbekannt",
  };
}
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const form = await request.formData();
    const file = form.get("file");
    const accountId = String(form.get("accountId") ?? "");
    const mode = String(form.get("mode") ?? "preview");
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".csv"))
      throw new Error("Bitte eine CSV-Datei auswählen.");
    if (file.size > 20 * 1024 * 1024)
      throw new Error("Die Datei ist größer als 20 MB.");
    const { member, account } = await context(user.userId, accountId);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const fileHash = fingerprintFile(bytes);
    const prior = await db
      .select()
      .from(imports)
      .where(
        and(
          eq(imports.accountId, account.id),
          eq(imports.fileFingerprint, fileHash),
        ),
      )
      .limit(1);
    if (prior.length)
      throw new Error("Diese Datei wurde für das Konto bereits importiert.");
    const templateId = String(form.get("templateId") ?? "");
    let template: ImportTemplate = sparkasseCamtV8;
    let storedTemplateId: string | undefined;
    if (templateId) {
      const [row] = await db
        .select()
        .from(importTemplates)
        .where(
          and(
            eq(importTemplates.id, templateId),
            eq(importTemplates.householdId, member.householdId),
            eq(importTemplates.enabled, true),
          ),
        )
        .limit(1);
      if (!row)
        throw new Error("Importvorlage nicht gefunden oder nicht aktiv.");
      const c = row.config;
      template = {
        id: row.id,
        name: row.name,
        bankName: row.bankName,
        delimiter: c.delimiter,
        encoding: c.encoding,
        headerRow: c.headerRow,
        skipEmptyLines: c.skipEmptyLines,
        dateFormat: c.dateFormat as ImportTemplate["dateFormat"],
        decimalSeparator: c.decimalSeparator,
        columns: c.columns as ImportTemplate["columns"],
        requiredFields: c.requiredFields as ImportTemplate["requiredFields"],
      };
      storedTemplateId = row.id;
    } else {
      const [row] = await db
        .select()
        .from(importTemplates)
        .where(
          and(
            eq(importTemplates.householdId, member.householdId),
            eq(importTemplates.builtin, true),
          ),
        )
        .limit(1);
      storedTemplateId = row?.id;
    }
    if (!storedTemplateId)
      throw new Error("Keine aktive Importvorlage vorhanden.");
    const content = decodeBankCsv(bytes, template.encoding);
    const parsed = parseBankCsv(content, template);
    const pendingTransactions = parsed.transactions.filter(isPendingTransaction);
    const importableTransactions = parsed.transactions.filter(
      (transaction) => !isPendingTransaction(transaction),
    );
    const existingRows = await db
      .select()
      .from(transactions)
      .where(eq(transactions.accountId, account.id));
    const existing: ParsedTransaction[] = existingRows.map((row) => ({
      accountReference: "",
      bookedOn: row.bookedOn,
      valuedOn: row.valuedOn ?? undefined,
      amount: Number(row.amount),
      currency: row.currency,
      direction: row.direction,
      fingerprint: row.fingerprint,
      counterparty: row.counterparty ?? undefined,
      purpose: row.purpose ?? undefined,
      originalData: {},
    }));
    const duplicateCheck = findDuplicates(importableTransactions, existing);
    if (mode === "preview")
      return NextResponse.json({
        fileFingerprint: fileHash,
        total: parsed.transactions.length,
        ignoredPending: pendingTransactions.length,
        ready: duplicateCheck.accepted.length,
        exactDuplicates: duplicateCheck.exact.length,
        suspected: duplicateCheck.suspected.map((x) => ({
          incoming: summary(x.incoming),
          existing: summary(x.existing),
        })),
        warnings: parsed.warnings,
        skippedEmptyRows: parsed.skippedEmptyRows,
      });
    const keep = new Set(
      JSON.parse(String(form.get("keepSuspected") ?? "[]")) as string[],
    );
    const keptSuspects = duplicateCheck.suspected
      .filter((x) => keep.has(x.incoming.fingerprint))
      .map((x) => x.incoming);
    const selected = [...duplicateCheck.accepted, ...keptSuspects];
    const rules = await merchantRuleMap(member.householdId, member.id);
    const locallyCategorized = selected.filter((item) => rules.has(normalizeMerchant(item.counterparty))).length;
    const result = await db.transaction(async (tx) => {
      const [record] = await tx
        .insert(imports)
        .values({
          accountId: account.id,
          templateId: storedTemplateId!,
          uploadedBy: user.userId,
          fileFingerprint: fileHash,
          originalFilename: file.name,
          status: "completed",
          importedCount: selected.length,
          duplicateCount: duplicateCheck.exact.length,
          reviewCount: duplicateCheck.suspected.length,
          completedAt: new Date(),
        })
        .returning();
      if (selected.length)
        await tx
          .insert(transactions)
          .values(
            selected.map((item) => ({
              accountId: account.id,
              importId: record.id,
              bookedOn: item.bookedOn,
              valuedOn: item.valuedOn,
              amount: item.amount.toFixed(2),
              currency: item.currency,
              direction: item.direction,
              bookingType: item.bookingType,
              counterparty: item.counterparty,
              counterpartyNormalized: normalizeMerchant(item.counterparty),
              categoryId: rules.get(normalizeMerchant(item.counterparty)),
              categorizedBy: rules.has(normalizeMerchant(item.counterparty)) ? "local-rule" : undefined,
              categorizationConfidence: rules.has(normalizeMerchant(item.counterparty)) ? "1.000" : undefined,
              purpose: item.purpose,
              bankReference: item.bankReference,
              fingerprint: item.fingerprint,
              originalDataEncrypted: encryptSecret(
                JSON.stringify(item.originalData),
              ),
            })),
          );
      return record;
    });
    return NextResponse.json(
      {
        importId: result.id,
        imported: selected.length,
        locallyCategorized,
        duplicates: duplicateCheck.exact.length,
        skippedSuspected: duplicateCheck.suspected.length - keptSuspects.length,
        ignoredPending: pendingTransactions.length,
      },
      { status: 201 },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Import fehlgeschlagen." },
      { status: 400 },
    );
  }
}
