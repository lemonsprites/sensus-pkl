-- Login memakai username; email dipertahankan sebagai field legacy opsional.
ALTER TABLE "User" ADD COLUMN "username" TEXT;

WITH ranked AS (
    SELECT
        "id",
        COALESCE(NULLIF(lower(split_part("email", '@', 1)), ''), 'user_' || substr("id", 1, 8)) AS base,
        row_number() OVER (
            PARTITION BY COALESCE(NULLIF(lower(split_part("email", '@', 1)), ''), 'user_' || substr("id", 1, 8))
            ORDER BY "createdAt"
        ) AS rn
    FROM "User"
)
UPDATE "User" AS u
SET "username" = CASE WHEN r.rn = 1 THEN r.base ELSE r.base || r.rn::text END
FROM ranked AS r
WHERE u."id" = r."id";

ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;
