/*
  Warnings:

  - The primary key for the `users` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `password_hash` on the `users` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "farmer_profiles" DROP CONSTRAINT "farmer_profiles_user_id_fkey";

-- DropForeignKey
ALTER TABLE "farms" DROP CONSTRAINT "farms_farmer_id_fkey";

-- AlterTable
ALTER TABLE "farmer_profiles" ALTER COLUMN "user_id" SET DATA TYPE VARCHAR(128);

-- AlterTable
ALTER TABLE "farms" ALTER COLUMN "farmer_id" SET DATA TYPE VARCHAR(128);

-- AlterTable
ALTER TABLE "users" DROP CONSTRAINT "users_pkey",
DROP COLUMN "password_hash",
ALTER COLUMN "id" SET DATA TYPE VARCHAR(128),
ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");

-- AddForeignKey
ALTER TABLE "farmer_profiles" ADD CONSTRAINT "farmer_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farms" ADD CONSTRAINT "farms_farmer_id_fkey" FOREIGN KEY ("farmer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
