INSERT INTO "import_templates" (
  "household_id", "name", "bank_name", "version", "enabled", "builtin", "config", "tested_at"
)
SELECT
  household."id",
  'Sparkassen-Kreditkartenumsätze',
  'Sparkasse Kreditkarte',
  1,
  true,
  true,
  jsonb_build_object(
    'delimiter', ';',
    'encoding', 'iso-8859-1',
    'headerRow', 1,
    'skipEmptyLines', true,
    'dateFormat', 'dd.MM.yyyy',
    'decimalSeparator', ',',
    'columns', jsonb_build_object(
      'bookedOn', 'Buchungsdatum',
      'valuedOn', 'Belegdatum',
      'bookingType', 'Abrechnungskennzeichen',
      'counterparty', 'Transaktionsbeschreibung',
      'purpose', 'Transaktionsbeschreibung Zusatz',
      'endToEndReference', 'Buchungsreferenz',
      'amount', 'Buchungsbetrag',
      'currency', 'Buchungswährung',
      'info', 'Gebührenschlüssel'
    ),
    'requiredFields', jsonb_build_array('bookedOn', 'counterparty', 'amount', 'currency')
  ),
  now()
FROM "households" household
WHERE NOT EXISTS (
  SELECT 1
  FROM "import_templates" template
  WHERE template."household_id" = household."id"
    AND template."bank_name" = 'Sparkasse Kreditkarte'
    AND template."name" = 'Sparkassen-Kreditkartenumsätze'
);
