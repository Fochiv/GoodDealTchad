-- Good Deal Tchad - schéma MySQL
-- Import :
--   mysql -u UTILISATEUR -p NOM_DE_LA_BASE < database/mysql-schema.sql
--
-- La base de données doit être créée et sélectionnée par l'hébergeur
-- ou par la commande d'import. Exemple :
-- CREATE DATABASE IF NOT EXISTS good_deal_tchad
--   CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- USE good_deal_tchad;

CREATE TABLE IF NOT EXISTS `commandes` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `forfait_id` VARCHAR(100) NOT NULL,
  `operateur_forfait` VARCHAR(50) NOT NULL,
  `beneficiaire_phone` VARCHAR(30) NOT NULL,
  `payment_operator` VARCHAR(50) NOT NULL,
  `payment_phone` VARCHAR(30) NOT NULL,
  `transaction_id` VARCHAR(191) NULL,
  `reference` VARCHAR(191) NULL,
  `statut` VARCHAR(32) NOT NULL DEFAULT 'pending',
  `montant` INT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_commandes_statut` (`statut`),
  KEY `idx_commandes_created_at` (`created_at`),
  KEY `idx_commandes_reference` (`reference`),
  KEY `idx_commandes_transaction_id` (`transaction_id`)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE=utf8mb4_unicode_ci;