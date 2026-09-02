import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { amazonOrderImports, amazonOrderItems } from "@/db/schema";
import { parseAmazonOrderHistory } from "@/features/amazon/parser";
import { fingerprintFile } from "@/features/import/parser";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/current-user";
import { encryptSecret, stablePrivateFingerprint } from "@/lib/security";
import { memberAndVisibleAccountIds } from "@/lib/visible-accounts";

const chunks = <T,>(values: T[], size: number) =>
  Array.from({ length: Math.ceil(values.length / size) }, (_, index) =>
    values.slice(index * size, (index + 1) * size),
  );

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const { member } = await memberAndVisibleAccountIds(user.userId);
    const form = await request.formData();
    const file = form.get("file");
    const mode = String(form.get("mode") ?? "preview");
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".csv")) {
      throw new Error("Bitte Amazons „Order History.csv“ auswählen.");
    }
    if (file.size > 30 * 1024 * 1024) throw new Error("Die Datei ist größer als 30 MB.");

    const bytes = new Uint8Array(await file.arrayBuffer());
    const fileFingerprint = fingerprintFile(bytes);
    const prior = await db
      .select({ id: amazonOrderImports.id })
      .from(amazonOrderImports)
      .where(
        and(
          eq(amazonOrderImports.householdId, member.householdId),
          eq(amazonOrderImports.fileFingerprint, fileFingerprint),
        ),
      )
      .limit(1);
    if (prior.length) throw new Error("Diese Amazon-Datei wurde bereits importiert.");

    const parsed = parseAmazonOrderHistory(new TextDecoder("utf-8").decode(bytes));
    const uniqueItems = [...new Map(parsed.items.map((item) => [item.fingerprint, item])).values()];
    const existingFingerprints = new Set<string>();
    for (const part of chunks(uniqueItems.map((item) => item.fingerprint), 1000)) {
      const rows = await db
        .select({ fingerprint: amazonOrderItems.sourceFingerprint })
        .from(amazonOrderItems)
        .where(
          and(
            eq(amazonOrderItems.householdId, member.householdId),
            inArray(amazonOrderItems.sourceFingerprint, part),
          ),
        );
      rows.forEach((row) => existingFingerprints.add(row.fingerprint));
    }
    const newItems = uniqueItems.filter((item) => !existingFingerprints.has(item.fingerprint));
    const counts = new Map<string, number>();
    parsed.items.forEach((item) => counts.set(item.orderId, (counts.get(item.orderId) ?? 0) + 1));
    const multipleItemOrders = [...counts.values()].filter((count) => count > 1).length;

    if (mode === "preview") {
      return NextResponse.json({
        items: parsed.items.length,
        orders: parsed.orderCount,
        multipleItemOrders,
        newItems: newItems.length,
        duplicates: parsed.items.length - newItems.length,
        warnings: parsed.warnings.slice(0, 20),
      });
    }

    const result = await db.transaction(async (tx) => {
      const [record] = await tx
        .insert(amazonOrderImports)
        .values({
          householdId: member.householdId,
          ownerMemberId: member.id,
          uploadedBy: user.userId,
          fileFingerprint,
          originalFilename: file.name,
          itemCount: newItems.length,
          orderCount: new Set(newItems.map((item) => item.orderId)).size,
        })
        .returning();
      for (const part of chunks(newItems, 500)) {
        await tx.insert(amazonOrderItems).values(
          part.map((item) => ({
            importId: record.id,
            householdId: member.householdId,
            ownerMemberId: member.id,
            orderIdEncrypted: encryptSecret(item.orderId),
            orderIdFingerprint: stablePrivateFingerprint(item.orderId),
            sourceFingerprint: item.fingerprint,
            orderDate: item.orderDate,
            shipDate: item.shipDate,
            asin: item.asin,
            productNameEncrypted: encryptSecret(item.productName),
            department: item.department,
            status: item.status,
            quantity: item.quantity.toFixed(2),
            unitPrice: item.unitPrice.toFixed(2),
            unitTax: item.unitTax.toFixed(2),
            orderTotal: item.orderTotal.toFixed(2),
            shippingCharge: item.shippingCharge.toFixed(2),
            totalDiscounts: item.totalDiscounts.toFixed(2),
            currency: item.currency,
          })),
        );
      }
      return record;
    });
    await writeAudit("amazon-import", "Amazon-Bestellhistorie wurde lokal importiert.", {
      userId: user.userId,
      metadata: { importId: result.id, items: newItems.length, orders: result.orderCount },
    });
    return NextResponse.json(
      { importId: result.id, importedItems: newItems.length, importedOrders: result.orderCount },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Amazon-Import fehlgeschlagen." },
      { status: 400 },
    );
  }
}

export async function GET() {
  try {
    const user = await requireUser();
    const { member } = await memberAndVisibleAccountIds(user.userId);
    const rows = await db
      .select({
        id: amazonOrderImports.id,
        filename: amazonOrderImports.originalFilename,
        itemCount: amazonOrderImports.itemCount,
        orderCount: amazonOrderImports.orderCount,
        createdAt: amazonOrderImports.createdAt,
      })
      .from(amazonOrderImports)
      .where(eq(amazonOrderImports.ownerMemberId, member.id));
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Amazon-Importe konnten nicht geladen werden." },
      { status: 400 },
    );
  }
}
