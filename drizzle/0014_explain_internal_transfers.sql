-- Der technische Slug bleibt stabil; nur die Bedeutung wird im sichtbaren Namen
-- unmissverständlich gemacht. Vom Nutzer umbenannte Kategorien bleiben erhalten.
UPDATE categories
SET name = 'Interne Umbuchung (nicht auswerten)', updated_at = now()
WHERE slug = 'umbuchung' AND name = 'Interne Umbuchung';
