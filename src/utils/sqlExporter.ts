/**
 * SQL Exporter Utility for Su-Qur POS Kedai Kopi
 * Generates standards-compliant SQL dumps (DDL + DML) for MySQL / MariaDB / PostgreSQL
 * Ideal for Server Migration, Hosting Transfer, and Local RDBMS Backups.
 */

import { StorageService } from '../services/storage';

function escapeSql(val: any): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return isNaN(val) ? '0' : String(val);
  if (typeof val === 'boolean') return val ? '1' : '0';
  if (typeof val === 'object') {
    return `'${JSON.stringify(val).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  }
  return `'${String(val).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

export const generatePosSqlDump = (customData?: any): string => {
  const timestamp = new Date().toISOString();
  const dateFormatted = timestamp.split('T')[0];

  const settings = customData?.settings || StorageService.getSettings();
  const users = customData?.users || StorageService.getUsers();
  const outlets = customData?.outlets || StorageService.getOutlets();
  const products = customData?.products || StorageService.getProducts();
  const ingredients = customData?.ingredients || StorageService.getIngredients();
  const branchInventory = customData?.branchInventory || StorageService.getBranchInventory();
  const stockTransfers = customData?.stockTransfers || StorageService.getStockTransfers();
  const transactions = customData?.transactions || StorageService.getTransactions();
  const suppliers = customData?.suppliers || StorageService.getSuppliers();
  const purchases = customData?.purchases || StorageService.getPurchases();
  const expenses = customData?.expenses || StorageService.getExpenses();
  const stockOpnames = customData?.stockOpnames || StorageService.getStockOpnames();
  const shifts = customData?.shifts || StorageService.getShifts();
  const cashLedgers = customData?.cashLedgers || StorageService.getCashLedgers();
  const capitalRecords = customData?.capitalRecords || StorageService.getCapitalRecords();
  const debtRecords = customData?.debtRecords || StorageService.getDebtRecords();
  const payrollRecords = customData?.payrollRecords || StorageService.getPayrollRecords();

  let sql = `-- ==============================================================================
-- SU-QUR POS DATABASE BACKUP & SERVER MIGRATION DUMP
-- Application: Kedai Kopi Su-Qur POS Management System
-- Generated At: ${timestamp}
-- Target: MySQL / MariaDB / PostgreSQL Server Migration
-- Engine: InnoDB | Charset: utf8mb4 | Collation: utf8mb4_unicode_ci
-- ==============================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+07:00";

-- ------------------------------------------------------------------------------
-- 1. Table structure & data for: suqur_settings
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS \`suqur_settings\` (
  \`id\` varchar(50) NOT NULL,
  \`store_name\` varchar(255) NOT NULL,
  \`tagline\` text,
  \`address\` text,
  \`phone\` varchar(50),
  \`tax_percentage\` decimal(5,2) DEFAULT 0.00,
  \`qris_nmid\` varchar(100),
  \`qris_merchant_name\` varchar(255),
  \`qris_image_url\` longtext,
  \`logo_url\` longtext,
  \`receipt_header\` text,
  \`receipt_footer\` text,
  \`printer_paper_size\` varchar(20) DEFAULT '58mm',
  \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO \`suqur_settings\` (\`id\`, \`store_name\`, \`tagline\`, \`address\`, \`phone\`, \`tax_percentage\`, \`qris_nmid\`, \`qris_merchant_name\`, \`receipt_header\`, \`receipt_footer\`, \`printer_paper_size\`)
VALUES (
  'store_config_1',
  ${escapeSql(settings?.storeName || 'Kedai Kopi Su-Qur')},
  ${escapeSql(settings?.tagline || 'Cita Rasa Kopi Otentik')},
  ${escapeSql(settings?.address || 'Jl. Kopi No. 1')},
  ${escapeSql(settings?.phone || '08123456789')},
  ${settings?.taxPercentage || 0},
  ${escapeSql(settings?.qrisNmid || '')},
  ${escapeSql(settings?.qrisMerchantName || '')},
  ${escapeSql(settings?.receiptHeader || '')},
  ${escapeSql(settings?.receiptFooter || '')},
  ${escapeSql(settings?.printerPaperSize || '58mm')}
) ON DUPLICATE KEY UPDATE \`store_name\` = VALUES(\`store_name\`);

-- ------------------------------------------------------------------------------
-- 2. Table structure & data for: suqur_outlets (Cabang)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS \`suqur_outlets\` (
  \`id\` varchar(50) NOT NULL,
  \`name\` varchar(255) NOT NULL,
  \`address\` text,
  \`phone\` varchar(50),
  \`is_active\` tinyint(1) DEFAULT 1,
  \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

  if (outlets && outlets.length > 0) {
    sql += `\nINSERT INTO \`suqur_outlets\` (\`id\`, \`name\`, \`address\`, \`phone\`, \`is_active\`) VALUES\n`;
    const outletValues = outlets.map((o: any) =>
      `  (${escapeSql(o.id)}, ${escapeSql(o.name)}, ${escapeSql(o.address || '')}, ${escapeSql(o.phone || '')}, ${o.isActive !== false ? 1 : 0})`
    );
    sql += outletValues.join(',\n') + ';\n';
  }

  sql += `
-- ------------------------------------------------------------------------------
-- 3. Table structure & data for: suqur_users (Kasir, Admin, Owner)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS \`suqur_users\` (
  \`id\` varchar(50) NOT NULL,
  \`name\` varchar(255) NOT NULL,
  \`role\` varchar(50) NOT NULL,
  \`pin\` varchar(50) NOT NULL,
  \`avatar\` longtext,
  \`outlet_id\` varchar(50),
  \`is_active\` tinyint(1) DEFAULT 1,
  \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

  if (users && users.length > 0) {
    sql += `\nINSERT INTO \`suqur_users\` (\`id\`, \`name\`, \`role\`, \`pin\`, \`avatar\`, \`outlet_id\`, \`is_active\`) VALUES\n`;
    const userValues = users.map((u: any) =>
      `  (${escapeSql(u.id)}, ${escapeSql(u.name)}, ${escapeSql(u.role)}, ${escapeSql(u.pin)}, ${escapeSql(u.avatar || '')}, ${escapeSql(u.outletId || '')}, ${u.isActive !== false ? 1 : 0})`
    );
    sql += userValues.join(',\n') + ';\n';
  }

  sql += `
-- ------------------------------------------------------------------------------
-- 4. Table structure & data for: suqur_ingredients (Bahan Baku & HPP)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS \`suqur_ingredients\` (
  \`id\` varchar(50) NOT NULL,
  \`name\` varchar(255) NOT NULL,
  \`unit\` varchar(50) NOT NULL,
  \`cost_per_unit\` decimal(12,2) NOT NULL DEFAULT 0.00,
  \`current_stock\` decimal(12,3) NOT NULL DEFAULT 0.000,
  \`minimum_stock\` decimal(12,3) NOT NULL DEFAULT 0.000,
  \`supplier_id\` varchar(50),
  \`last_restocked\` datetime,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

  if (ingredients && ingredients.length > 0) {
    sql += `\nINSERT INTO \`suqur_ingredients\` (\`id\`, \`name\`, \`unit\`, \`cost_per_unit\`, \`current_stock\`, \`minimum_stock\`, \`supplier_id\`, \`last_restocked\`) VALUES\n`;
    const ingValues = ingredients.map((ing: any) =>
      `  (${escapeSql(ing.id)}, ${escapeSql(ing.name)}, ${escapeSql(ing.unit)}, ${ing.costPerUnit || 0}, ${ing.currentStock || 0}, ${ing.minimumStock || 0}, ${escapeSql(ing.supplierId || '')}, ${escapeSql(ing.lastRestocked || null)})`
    );
    sql += ingValues.join(',\n') + ';\n';
  }

  sql += `
-- ------------------------------------------------------------------------------
-- 5. Table structure & data for: suqur_products (Menu Produk & Resep)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS \`suqur_products\` (
  \`id\` varchar(50) NOT NULL,
  \`name\` varchar(255) NOT NULL,
  \`category\` varchar(100) NOT NULL,
  \`price\` decimal(12,2) NOT NULL DEFAULT 0.00,
  \`cogs\` decimal(12,2) NOT NULL DEFAULT 0.00,
  \`image_url\` longtext,
  \`is_available\` tinyint(1) DEFAULT 1,
  \`recipe_data\` json,
  \`variants_data\` json,
  \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

  if (products && products.length > 0) {
    sql += `\nINSERT INTO \`suqur_products\` (\`id\`, \`name\`, \`category\`, \`price\`, \`cogs\`, \`image_url\`, \`is_available\`, \`recipe_data\`, \`variants_data\`) VALUES\n`;
    const prodValues = products.map((p: any) =>
      `  (${escapeSql(p.id)}, ${escapeSql(p.name)}, ${escapeSql(p.category || 'Minuman')}, ${p.price || 0}, ${p.cogs || 0}, ${escapeSql(p.imageUrl || '')}, ${p.isAvailable !== false ? 1 : 0}, ${escapeSql(p.recipe || [])}, ${escapeSql(p.variants || [])})`
    );
    sql += prodValues.join(',\n') + ';\n';
  }

  sql += `
-- ------------------------------------------------------------------------------
-- 6. Table structure & data for: suqur_transactions (Transaksi Kasir)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS \`suqur_transactions\` (
  \`id\` varchar(50) NOT NULL,
  \`invoice_no\` varchar(100) NOT NULL,
  \`timestamp\` datetime NOT NULL,
  \`outlet_id\` varchar(50),
  \`outlet_name\` varchar(255),
  \`cashier_id\` varchar(50),
  \`cashier_name\` varchar(255),
  \`customer_name\` varchar(255),
  \`order_type\` varchar(50) DEFAULT 'dine_in',
  \`payment_method\` varchar(50) NOT NULL,
  \`subtotal\` decimal(14,2) NOT NULL DEFAULT 0.00,
  \`discount\` decimal(14,2) DEFAULT 0.00,
  \`tax\` decimal(14,2) DEFAULT 0.00,
  \`total\` decimal(14,2) NOT NULL DEFAULT 0.00,
  \`total_cogs\` decimal(14,2) NOT NULL DEFAULT 0.00,
  \`gross_profit\` decimal(14,2) NOT NULL DEFAULT 0.00,
  \`items_json\` json,
  \`status\` varchar(50) DEFAULT 'completed',
  PRIMARY KEY (\`id\`),
  KEY \`idx_invoice\` (\`invoice_no\`),
  KEY \`idx_timestamp\` (\`timestamp\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

  if (transactions && transactions.length > 0) {
    sql += `\nINSERT INTO \`suqur_transactions\` (\`id\`, \`invoice_no\`, \`timestamp\`, \`outlet_id\`, \`outlet_name\`, \`cashier_id\`, \`cashier_name\`, \`customer_name\`, \`order_type\`, \`payment_method\`, \`subtotal\`, \`discount\`, \`tax\`, \`total\`, \`total_cogs\`, \`gross_profit\`, \`items_json\`, \`status\`) VALUES\n`;
    const txValues = transactions.map((t: any) =>
      `  (${escapeSql(t.id)}, ${escapeSql(t.invoiceNo || t.id)}, ${escapeSql(t.timestamp)}, ${escapeSql(t.outletId || '')}, ${escapeSql(t.outletName || '')}, ${escapeSql(t.cashierId || '')}, ${escapeSql(t.cashierName || '')}, ${escapeSql(t.customerName || '')}, ${escapeSql(t.orderType || 'dine_in')}, ${escapeSql(t.paymentMethod || 'cash')}, ${t.subtotal || 0}, ${t.discount || 0}, ${t.tax || 0}, ${t.total || 0}, ${t.totalCogs || 0}, ${t.grossProfit || 0}, ${escapeSql(t.items || [])}, ${escapeSql(t.status || 'completed')})`
    );
    sql += txValues.join(',\n') + ';\n';
  }

  sql += `
-- ------------------------------------------------------------------------------
-- 7. Table structure & data for: suqur_cash_ledgers (Buku Kas & Mutasi Kas)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS \`suqur_cash_ledgers\` (
  \`id\` varchar(50) NOT NULL,
  \`date\` date NOT NULL,
  \`type\` varchar(20) NOT NULL, -- IN / OUT
  \`category\` varchar(100) NOT NULL,
  \`amount\` decimal(14,2) NOT NULL DEFAULT 0.00,
  \`description\` text,
  \`outlet_id\` varchar(50),
  \`outlet_name\` varchar(255),
  \`created_by\` varchar(255),
  \`payment_method\` varchar(50),
  \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

  if (cashLedgers && cashLedgers.length > 0) {
    sql += `\nINSERT INTO \`suqur_cash_ledgers\` (\`id\`, \`date\`, \`type\`, \`category\`, \`amount\`, \`description\`, \`outlet_id\`, \`outlet_name\`, \`created_by\`, \`payment_method\`) VALUES\n`;
    const clValues = cashLedgers.map((cl: any) =>
      `  (${escapeSql(cl.id)}, ${escapeSql(cl.date)}, ${escapeSql(cl.type)}, ${escapeSql(cl.category)}, ${cl.amount || 0}, ${escapeSql(cl.description || '')}, ${escapeSql(cl.outletId || '')}, ${escapeSql(cl.outletName || '')}, ${escapeSql(cl.createdBy || '')}, ${escapeSql(cl.paymentMethod || 'CASH')})`
    );
    sql += clValues.join(',\n') + ';\n';
  }

  sql += `
-- ------------------------------------------------------------------------------
-- 8. Table structure & data for: suqur_expenses & purchases
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS \`suqur_expenses\` (
  \`id\` varchar(50) NOT NULL,
  \`expense_no\` varchar(100),
  \`date\` date NOT NULL,
  \`category\` varchar(100) NOT NULL,
  \`amount\` decimal(14,2) NOT NULL DEFAULT 0.00,
  \`description\` text,
  \`outlet_id\` varchar(50),
  \`recorded_by\` varchar(255),
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

  if (expenses && expenses.length > 0) {
    sql += `\nINSERT INTO \`suqur_expenses\` (\`id\`, \`expense_no\`, \`date\`, \`category\`, \`amount\`, \`description\`, \`outlet_id\`, \`recorded_by\`) VALUES\n`;
    const expValues = expenses.map((e: any) =>
      `  (${escapeSql(e.id)}, ${escapeSql(e.expenseNo || e.id)}, ${escapeSql(e.date)}, ${escapeSql(e.category)}, ${e.amount || 0}, ${escapeSql(e.description || '')}, ${escapeSql(e.outletId || '')}, ${escapeSql(e.recordedBy || '')})`
    );
    sql += expValues.join(',\n') + ';\n';
  }

  sql += `
-- ------------------------------------------------------------------------------
-- 9. Table structure & data for: suqur_shifts (Shift Kasir)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS \`suqur_shifts\` (
  \`id\` varchar(50) NOT NULL,
  \`user_id\` varchar(50) NOT NULL,
  \`user_name\` varchar(255) NOT NULL,
  \`outlet_id\` varchar(50),
  \`start_time\` datetime NOT NULL,
  \`end_time\` datetime,
  \`start_cash\` decimal(14,2) NOT NULL DEFAULT 0.00,
  \`actual_cash\` decimal(14,2) DEFAULT 0.00,
  \`total_cash_sales\` decimal(14,2) DEFAULT 0.00,
  \`total_qris_sales\` decimal(14,2) DEFAULT 0.00,
  \`difference\` decimal(14,2) DEFAULT 0.00,
  \`notes\` text,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

  if (shifts && shifts.length > 0) {
    sql += `\nINSERT INTO \`suqur_shifts\` (\`id\`, \`user_id\`, \`user_name\`, \`outlet_id\`, \`start_time\`, \`end_time\`, \`start_cash\`, \`actual_cash\`, \`total_cash_sales\`, \`total_qris_sales\`, \`difference\`, \`notes\`) VALUES\n`;
    const shiftValues = shifts.map((s: any) =>
      `  (${escapeSql(s.id)}, ${escapeSql(s.userId)}, ${escapeSql(s.userName)}, ${escapeSql(s.outletId || '')}, ${escapeSql(s.startTime)}, ${escapeSql(s.endTime || null)}, ${s.startCash || 0}, ${s.actualCash || 0}, ${s.totalCashSales || 0}, ${s.totalQrisSales || 0}, ${s.difference || 0}, ${escapeSql(s.notes || '')})`
    );
    sql += shiftValues.join(',\n') + ';\n';
  }

  sql += `
SET FOREIGN_KEY_CHECKS = 1;
-- ==============================================================================
-- END OF SU-QUR POS SQL BACKUP DUMP
-- ==============================================================================
`;

  return sql;
};

/**
 * Trigger immediate browser download of SQL Dump
 */
export const downloadSqlDumpFile = (customData?: any): void => {
  try {
    const sqlContent = generatePosSqlDump(customData);
    const blob = new Blob([sqlContent], { type: 'application/sql;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `suqur_pos_database_dump_${dateStr}.sql`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('[SQL Exporter] Error downloading SQL dump:', err);
  }
};
