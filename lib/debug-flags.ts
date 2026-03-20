/**
 * Centralized debug flags for gating sensitive financial data logs.
 *
 * DEBUG_FINANCIALS — logs raw extraction data, EBITDA components, merge
 *   conflict details. Use `DEBUG_FINANCIALS=true` to enable.
 *
 * DEBUG_FINANCE — logs the full Financial Summary table with source
 *   provenance. Use `DEBUG_FINANCE=true` to enable.
 */

export const DEBUG_FINANCIALS = process.env.DEBUG_FINANCIALS === 'true';
export const DEBUG_FINANCE = process.env.DEBUG_FINANCE === 'true';
