UPDATE "farms"
SET "name" = INITCAP(BTRIM("name"))
WHERE "name" <> INITCAP(BTRIM("name"))
  AND ("name" = UPPER("name") OR "name" = LOWER("name"));
