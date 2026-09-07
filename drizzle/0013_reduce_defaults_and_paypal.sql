-- Einmalige Bereinigung für bestehende Testinstallationen. Diese Migration
-- läuft genau einmal; später vom Nutzer gelöschte Kategorien werden nicht neu angelegt.
DO $$
DECLARE household_row record; item record; parent_uuid uuid;
BEGIN
  FOR household_row IN SELECT id FROM households LOOP
    -- Genau einmal den neuen kleinen Testbestand ergänzen. Da Migrationen nicht
    -- wiederholt werden, bleiben spätere Löschentscheidungen des Nutzers erhalten.
    FOR item IN SELECT d.*, row_number() OVER () AS sort_order FROM (VALUES
      ('Bank & Finanzen','bank-finanzen','#786b58','landmark',NULL::text,false),('Kontoführungsgebühren','kontofuehrungsgebuehren','#897b68','receipt','bank-finanzen',false),('Kredite & Raten','kredite-raten','#897b68','badge-euro','bank-finanzen',false),
      ('Familie & Kinder','familie-kinder','#d26b90','baby',NULL,false),('Freizeit','freizeit','#d88a35','party-popper',NULL,false),('App- & In-Game-Käufe','app-in-game','#df9849','gamepad-2','freizeit',false),('Restaurants & Cafés','restaurants-cafes','#df9849','utensils','freizeit',false),
      ('Gesundheit','gesundheit','#c44f64','heart-pulse',NULL,false),('Apotheke & Medikamente','apotheke-medikamente','#cf6174','pill','gesundheit',false),('Haushalt & Drogerie','haushalt-drogerie','#159b94','spray-can',NULL,false),('Interne Umbuchung','umbuchung','#758387','arrow-left-right',NULL,false),
      ('Kommunikation & Medien','kommunikation-medien','#5275a8','wifi',NULL,false),('Streaming & Software','streaming-software','#6385b5','tv','kommunikation-medien',false),('Telefon & Internet','telefon-internet','#6385b5','phone','kommunikation-medien',false),('Lebensmittel','lebensmittel','#087e82','shopping-basket',NULL,false),
      ('Mobilität','mobilitaet','#31a77d','car',NULL,false),('Kfz-Wartung','kfz-wartung','#3daf87','wrench','mobilitaet',false),('ÖPNV & Bahn','oepnv-bahn','#3daf87','train-front','mobilitaet',false),('Tanken','tanken','#3daf87','fuel','mobilitaet',false),('Reisen & Urlaub','reisen-urlaub','#2f9eaa','plane',NULL,false),('Tierhaltung','tierhaltung','#84714f','paw-print',NULL,false),
      ('Versicherungen','versicherungen','#556b87','shield',NULL,false),('Kfz-Versicherung','kfz-versicherung','#667b96','car','versicherungen',false),('Wohnen','wohnen','#2367a1','house',NULL,false),('Miete','miete','#3478ad','key-round','wohnen',false),('Nebenkosten','nebenkosten','#3478ad','receipt-text','wohnen',false),('Strom & Heizung','strom-heizung','#3478ad','zap','wohnen',false),
      ('Einnahmen','einnahmen','#2a996b','wallet',NULL,true),('Erstattungen','erstattungen','#3baa7b','rotate-ccw','einnahmen',true),('Gehalt & Lohn','gehalt-lohn','#3baa7b','badge-euro','einnahmen',true),('Kapitalerträge','kapitalertraege','#3baa7b','trending-up','einnahmen',true),('Kindergeld','kindergeld','#3baa7b','baby','einnahmen',true)
    ) AS d(name,slug,color,icon,parent_slug,is_income) LOOP
      parent_uuid := NULL;
      IF item.parent_slug IS NOT NULL THEN SELECT id INTO parent_uuid FROM categories WHERE household_id=household_row.id AND slug=item.parent_slug ORDER BY created_at LIMIT 1; END IF;
      IF NOT EXISTS (SELECT 1 FROM categories WHERE household_id=household_row.id AND slug=item.slug) THEN
        INSERT INTO categories(household_id,parent_id,name,slug,color,icon,is_income,sort_order) VALUES(household_row.id,parent_uuid,item.name,item.slug,item.color,item.icon,item.is_income,item.sort_order);
      END IF;
    END LOOP;

    UPDATE categories SET name='Lebensmittel' WHERE household_id=household_row.id AND slug='lebensmittel' AND name='Lebensmittel & Getränke';
    UPDATE categories SET parent_id=(SELECT id FROM categories WHERE household_id=household_row.id AND slug='bank-finanzen' ORDER BY created_at LIMIT 1)
      WHERE household_id=household_row.id AND slug='kredite-raten';

    -- Den unspezifischen Oberbegriff entfernen, ohne verwendete Unterkategorien zu verlieren.
    UPDATE categories SET parent_id=NULL WHERE household_id=household_row.id AND parent_id IN (
      SELECT id FROM categories WHERE household_id=household_row.id AND slug='einkaeufe'
    );

    -- Nur unbenutzte, inzwischen aus dem schlanken Standard entfernte Kategorien löschen.
    DELETE FROM categories c
    WHERE c.household_id=household_row.id
      AND c.slug IN ('supermarkt','baeckerei','getraenke','parken-maut','kfz-wartung-reparatur','leasing-fahrzeugkauf','streaming','software-cloud','rundfunkbeitrag','drogerie-koerperpflege','reinigung-haushaltswaren','einkaeufe','kleidung-schuhe','elektronik','buecher-medien','werkzeug-hobbybedarf','arzt-behandlung','brille-hilfsmittel','haftpflicht','hausrat-gebaeude','rechtsschutz','personenversicherung','sollzinsen','depot-geldanlage','darlehensrate','kreditkartenrate','ratenkauf','kultur-veranstaltungen','sport-vereine','hobbys','unterkunft','anreise-mietwagen','urlaubsaktivitaeten','betreuung-schule','kinderkleidung','spielzeug-taschengeld','bildung-beruf','weiterbildung','arbeitsmittel','steuern-abgaben','geschenke-spenden','tierfutter-zubehoer','tierarzt','rente-pension','kindergeld-familienleistungen','erstattungen-rueckzahlungen','verkaeufe-nebeneinkuenfte','strom','heizung','instandhaltung-renovierung','moebel-einrichtung')
      AND NOT EXISTS (SELECT 1 FROM transactions t WHERE t.category_id=c.id)
      AND NOT EXISTS (SELECT 1 FROM transaction_splits s WHERE s.category_id=c.id)
      AND NOT EXISTS (SELECT 1 FROM amazon_order_items a WHERE a.category_id=c.id)
      AND NOT EXISTS (SELECT 1 FROM categorization_rules r WHERE r.category_id=c.id)
      AND NOT EXISTS (SELECT 1 FROM categories child WHERE child.parent_id=c.id);

    IF NOT EXISTS (SELECT 1 FROM import_templates WHERE household_id=household_row.id AND bank_name='PayPal' AND name='PayPal-Aktivitätsbericht') THEN
      INSERT INTO import_templates(household_id,name,bank_name,enabled,builtin,tested_at,config)
      VALUES(household_row.id,'PayPal-Aktivitätsbericht','PayPal',true,true,now(),
        '{"delimiter":",","encoding":"utf-8-sig","headerRow":1,"skipEmptyLines":true,"dateFormat":"dd.MM.yyyy","decimalSeparator":",","columns":{"bookedOn":"Datum|Date","bookingType":"Typ|Type","purpose":"Betreff|Subject|Artikelbezeichnung|Item Title","counterparty":"Name","endToEndReference":"Transaktionscode|Transaction ID","amount":"Netto|Net","currency":"Währung|Currency","info":"Status"},"requiredFields":["bookedOn","counterparty","amount","currency"],"rowFilter":{"column":"Status","allowedValues":["Abgeschlossen","Completed","Bezahlt","Paid","Erstattet","Refunded"]}}'::jsonb);
    END IF;
  END LOOP;
END $$;
