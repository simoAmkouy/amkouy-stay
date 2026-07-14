import { OwnerStatement } from '@/lib/queries/reports';
import { generatePdf } from '@/lib/export/pdf';
import { getLogoDataUri } from '@/lib/export/logo-data-uri';
import { formatMAD } from '@/utils/format';
import { DateRange, formatRangeLabel } from '@/utils/date-range';

const BRAND_PRIMARY = '#0F1F3D';
const BRAND_GOLD = '#C9A84C';

function row(label: string, value: string): string {
  return `<tr><td class="label">${label}</td><td class="value">${value}</td></tr>`;
}

/** Phase 4: professional owner statement PDF, built from the exact same `OwnerStatement`
 * numbers shown on-screen — no value here is recomputed, only formatted. */
export function buildOwnerStatementHtml(params: {
  ownerName: string;
  propertyName: string;
  propertyCity: string;
  range: DateRange;
  statement: OwnerStatement;
  managementNotes?: string;
  logoDataUri?: string;
}): string {
  const { ownerName, propertyName, propertyCity, range, statement, managementNotes, logoDataUri } = params;
  const generatedAt = new Date().toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1a1a1a; padding: 32px; }
  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid ${BRAND_GOLD}; padding-bottom: 16px; margin-bottom: 24px; }
  .brand-block { display: flex; align-items: center; gap: 12px; }
  .brand-logo { height: 44px; width: auto; object-fit: contain; }
  .brand { font-size: 22px; font-weight: 800; color: ${BRAND_PRIMARY}; letter-spacing: 0.5px; }
  .brand-sub { font-size: 11px; color: #888; margin-top: 2px; }
  .period { text-align: right; font-size: 12px; color: #555; }
  h1 { font-size: 18px; color: ${BRAND_PRIMARY}; margin: 0 0 4px; }
  .meta { font-size: 13px; color: #444; margin-bottom: 20px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: ${BRAND_PRIMARY}; border-bottom: 1px solid #e2e2e2; padding-bottom: 6px; margin-top: 24px; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  td.label { padding: 5px 0; color: #555; }
  td.value { padding: 5px 0; text-align: right; font-weight: 600; color: #1a1a1a; }
  .net { background: #f7f5ee; border-radius: 8px; padding: 12px 16px; margin-top: 8px; }
  .net .value { color: ${BRAND_PRIMARY}; font-size: 16px; }
  .notes { background: #fffbec; border: 1px solid #f3e6be; border-radius: 8px; padding: 12px 16px; font-size: 12.5px; color: #6a5a22; margin-top: 8px; white-space: pre-wrap; }
  .footer { margin-top: 32px; border-top: 1px solid #e2e2e2; padding-top: 10px; font-size: 10.5px; color: #999; }
</style>
</head>
<body>
  <div class="header">
    <div class="brand-block">
      ${logoDataUri ? `<img class="brand-logo" src="${logoDataUri}" alt="Amkouy Immobilier" />` : ''}
      <div>
        <div class="brand">AMKOUY STAY</div>
        <div class="brand-sub">Gestion immobilière &amp; conciergerie</div>
      </div>
    </div>
    <div class="period">Relevé propriétaire<br/>${formatRangeLabel(range)}</div>
  </div>

  <h1>${ownerName}</h1>
  <div class="meta">${propertyName} — ${propertyCity} · Statut du contrat : ${statement.contractStatus}</div>

  <h2>Résumé des revenus</h2>
  <table>
    ${row('Revenu hébergement', formatMAD(statement.revenue))}
    ${row('Remboursements', `- ${formatMAD(statement.refunds)}`)}
    ${row('Revenu concierge', formatMAD(statement.conciergeRevenue))}
    ${row('Dépenses', `- ${formatMAD(statement.expenses)}`)}
    ${row('Coûts de ménage', `- ${formatMAD(statement.cleaningCosts)}`)}
    ${row('Coûts de maintenance', `- ${formatMAD(statement.maintenanceCosts)}`)}
  </table>
  <div class="net"><table>${row('Revenu net', formatMAD(statement.netRevenue))}</table></div>

  <h2>Réservations</h2>
  <table>
    ${row('Réservations', String(statement.reservationsCount))}
    ${row('Nuits occupées', String(statement.occupiedNights))}
    ${row("Taux d'occupation", `${statement.occupancyRate}%`)}
  </table>

  <h2>Répartition contractuelle</h2>
  <table>
    ${row('Commission Amkouy', `${statement.commissionPct}%`)}
    ${row('Part propriétaire', formatMAD(statement.ownerShare))}
    ${row('Part Amkouy', formatMAD(statement.amkouyShare))}
  </table>

  <h2>Versements propriétaire</h2>
  <table>
    ${row('Versements payés (période)', formatMAD(statement.ownerPaymentsTotal))}
    ${row('Versements en attente', formatMAD(statement.pendingPaymentsTotal))}
  </table>

  ${
    managementNotes
      ? `<h2>Notes de gestion</h2><div class="notes">${managementNotes.replace(/</g, '&lt;')}</div>`
      : ''
  }

  <div class="footer">Document généré le ${generatedAt} — Amkouy Stay</div>
</body>
</html>`;
}

export async function exportOwnerStatementPdf(params: {
  ownerName: string;
  propertyName: string;
  propertyCity: string;
  range: DateRange;
  statement: OwnerStatement;
  managementNotes?: string;
}): Promise<void> {
  const logoDataUri = await getLogoDataUri().catch(() => undefined);
  const html = buildOwnerStatementHtml({ ...params, logoDataUri });
  const monthLabel = `${params.range.start.getFullYear()}-${String(params.range.start.getMonth() + 1).padStart(2, '0')}`;
  await generatePdf(`OWNER-STATEMENT-${monthLabel}.pdf`, html);
}
