/**
 * Data / DB utilities module barrel
 *
 * Re-exports CSV parsing, column-mapping, validation, and smart-import utilities.
 * These are the frontend-facing data transformation helpers used before API
 * submission and during bulk contact import flows.
 *
 * @example
 * ```ts
 * import { validateCsvRow, smartColumnMapping, normalizePhone } from '@/lib/db'
 * import type { CsvValidationSummary, ValidatedRow } from '@/lib/db'
 * ```
 *
 * Included modules:
 *  - csv-validators   : CsvRowError, CsvRowValidation, CsvValidationSummary,
 *                       validateCsvRow, validateCsvRows, formatValidationMessage,
 *                       detectColumnMapping, applyColumnMapping
 *  - smart-csv-import : SchemaField, COLLECTION_ACCOUNT_SCHEMA, ColumnMatch,
 *                       smartColumnMapping, normalizePhone, coerceCurrency,
 *                       coerceStatus, transformRow, RowValidationError,
 *                       ValidatedRow, ValidationSummary, validateRow,
 *                       validateAllRows, generateTemplate, downloadTemplate
 */

export * from '../csv-validators'
export * from '../smart-csv-import'
