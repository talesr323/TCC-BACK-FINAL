/*
  Warnings:

  - You are about to drop the column `aluno_id` on the `fichas_treino` table. All the data in the column will be lost.
  - You are about to drop the column `treino_id` on the `fichas_treino` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `fichas_treino` DROP FOREIGN KEY `fichas_treino_aluno_id_fkey`;

-- DropForeignKey
ALTER TABLE `fichas_treino` DROP FOREIGN KEY `fichas_treino_treino_id_fkey`;

-- DropIndex
DROP INDEX `fichas_treino_aluno_id_fkey` ON `fichas_treino`;

-- DropIndex
DROP INDEX `fichas_treino_treino_id_fkey` ON `fichas_treino`;

-- AlterTable
ALTER TABLE `fichas_treino` DROP COLUMN `aluno_id`,
    DROP COLUMN `treino_id`;

-- CreateTable
CREATE TABLE `treinos_fichas` (
    `treino_id` BIGINT NOT NULL,
    `ficha_id` BIGINT NOT NULL,

    PRIMARY KEY (`treino_id`, `ficha_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `treinos_fichas` ADD CONSTRAINT `treinos_fichas_treino_id_fkey` FOREIGN KEY (`treino_id`) REFERENCES `treinos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `treinos_fichas` ADD CONSTRAINT `treinos_fichas_ficha_id_fkey` FOREIGN KEY (`ficha_id`) REFERENCES `fichas_treino`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
