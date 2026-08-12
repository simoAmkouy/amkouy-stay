/**
 * ReservationDetailCard — read/action modal that opens when a reservation block
 * is tapped in the Portfolio or Apartment Calendar.
 *
 * Architecture rules followed:
 * - All data comes from existing hooks (useReservation, useReservationServices,
 *   usePayments, useReservationPaymentSummary). Nothing new.
 * - All mutations go through existing useUpdateReservation (→ updateReservation()
 *   → existing audit/notification pipeline). Nothing new.
 * - Cache invalidation covers both reservations AND calendar query keys so every
 *   screen stays consistent after a mutation.
 * - No new business logic, no new DB tables, no new RLS.
 * - PDF uses existing generatePdf() utility — same path as owner statement PDF.
 */

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { ReservationForm } from '@/components/forms/reservation-form';
import { Icon } from '@/components/icon';
import { canAccess } from '@/constants/permissions';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import { useAuth } from '@/hooks/use-auth';
import { useReservation, useUpdateReservation } from '@/hooks/use-reservations';
import { useReservationServices } from '@/hooks/use-reservation-services';
import { usePayments, useReservationPaymentSummary } from '@/hooks/use-payments';
import { supabase } from '@/lib/supabase';
import { ReservationServiceWithRelations } from '@/lib/queries/reservation-services';
import { ReservationPaymentSummary } from '@/lib/queries/payments';
import { generatePdf, sharePdf } from '@/lib/export/pdf';
import { getLogoDataUri } from '@/lib/export/logo-data-uri';
import {
  ReservationFormValues,
  ReservationStatusValue,
} from '@/lib/validation/reservation';

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<string, string> = {
  pending:     'En attente',
  confirmed:   'Confirmée',
  checked_in:  'En séjour',
  checked_out: 'Parti',
  completed:   'Terminée',
  cancelled:   'Annulée',
  no_show:     'Non présenté',
};

type BadgeStyle = { bg: string; text: string; border: string };
const STATUS_BADGE: Record<string, BadgeStyle> = {
  pending:     { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' },
  confirmed:   { bg: '#D1FAE5', text: '#065F46', border: '#10B981' },
  checked_in:  { bg: '#0F1F3D', text: '#FFFFFF', border: '#0F1F3D' },
  checked_out: { bg: '#E5E7EB', text: '#374151', border: '#9CA3AF' },
  completed:   { bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6' },
  cancelled:   { bg: '#FEE2E2', text: '#991B1B', border: '#EF4444' },
  no_show:     { bg: '#FCE7F3', text: '#9D174D', border: '#EC4899' },
};
function statusBadge(s: string): BadgeStyle {
  return STATUS_BADGE[s] ?? { bg: '#E5E7EB', text: '#374151', border: '#9CA3AF' };
}

const SERVICE_STATUS_LABELS: Record<string, string> = {
  requested:   'Demandé',
  accepted:    'Accepté',
  scheduled:   'Planifié',
  in_progress: 'En cours',
  delivered:   'Livré',
  cancelled:   'Annulé',
  refunded:    'Remboursé',
};

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  deposit_hold:    'Acompte',
  charge:          'Solde',
  refund:          'Remboursement',
  deposit_release: 'Remb. caution',
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash:          'Espèces',
  bank_transfer: 'Virement',
  card:          'Carte',
  check:         'Chèque',
  stripe:        'Stripe',
  other:         'Autre',
};

const CLEANING_STATUS_LABELS: Record<string, string> = {
  pending:     'En attente',
  assigned:    'Assigné',
  in_progress: 'En cours',
  completed:   'Terminé',
  verified:    'Vérifié',
  cancelled:   'Annulé',
};

function formatMAD(n: number): string {
  return n.toLocaleString('fr-MA', { maximumFractionDigits: 0 }) + ' DH';
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  const months = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
  return `${d} ${months[parseInt(m, 10) - 1]} ${y}`;
}

// ---------------------------------------------------------------------------
// Client-facing invoice — compact one-page A4 design, no internal data.
// All values come from existing hooks; nothing is recomputed here.
// ---------------------------------------------------------------------------

const BRAND_PRIMARY = '#0F1F3D';
const BRAND_GOLD    = '#C9A84C';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

type InvoiceParams = {
  reservationCode: string;
  guestName: string;
  guestPhone: string | null | undefined;
  guestEmail: string | null | undefined;
  adults: number;
  children: number;
  checkIn: string;
  checkOut: string;
  nights: number | null;
  channelName: string | null | undefined;
  propertyName: string | null | undefined;
  propertyCity: string | null | undefined;
  specialRequests: string | null | undefined;
  nightlyRate: number;
  subtotalAmount: number;
  cleaningFeeAmount: number;
  totalAmount: number;
  services: ReservationServiceWithRelations[];
  payments: import('@/lib/queries/payments').PaymentRow[];
  paymentSummary: ReservationPaymentSummary | undefined;
  logoDataUri?: string;
};

function buildInvoiceHtml(p: InvoiceParams): string {
  const {
    reservationCode, guestName, guestPhone, guestEmail, adults, children,
    checkIn, checkOut, nights, channelName, propertyName, propertyCity,
    specialRequests, nightlyRate, subtotalAmount, cleaningFeeAmount, totalAmount,
    services, payments, paymentSummary, logoDataUri,
  } = p;

  const nightCount   = nights ?? 0;
  const issueDate    = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const propertyLine = ([propertyName, propertyCity].filter(Boolean) as string[]).map(esc).join(' — ');
  const travellerText = adults + ' adulte' + (adults > 1 ? 's' : '') +
    (children > 0 ? ' + ' + children + ' enfant' + (children > 1 ? 's' : '') : '');

  const activeServices = services.filter(s => s.status !== 'cancelled' && s.status !== 'refunded');
  const servicesSubtotal = activeServices.reduce((sum, s) => sum + (s.total_price ?? 0), 0);
  // Grand total = accommodation total (nightly+cleaning) + active services
  const grandTotal = totalAmount + servicesSubtotal;

  // Per-service paid amounts (new amount_paid field) + global paid amounts
  const servicesPaid   = activeServices.reduce((sum, s) => sum + (s.amount_paid ?? 0), 0);
  const grandTotalPaid = (paymentSummary?.netCollected ?? 0) + servicesPaid;
  const invoiceBalance = Math.max(0, grandTotal - grandTotalPaid);
  const isFullyPaid    = grandTotalPaid > 0 && invoiceBalance <= 0;

  // ── Status badge helper ──
  const mkBadge = (lbl: string, cls: string) => `<span class="st ${cls}">${lbl}</span>`;

  // ── Accommodation payment status ──
  // All payments[] rows are accommodation-level (design of the payments system).
  // Cleaning fee is bundled with nights in totalAmount and tracked together.
  const accPayé  = paymentSummary?.netCollected ?? 0;
  const accReste = Math.max(0, totalAmount - accPayé);
  const accBadgeHtml = accPayé <= 0       ? mkBadge('NON PAYÉ', 'st-unpd')
    : accPayé >= totalAmount              ? mkBadge('PAYÉ',     'st-paid')
    :                                       mkBadge('ACOMPTE',  'st-part');
  const accLabel   = cleaningFeeAmount > 0 ? 'Hébergement &amp; Ménage' : 'Hébergement';
  const accCalcSub = cleaningFeeAmount > 0
    ? `${nightCount} nuit${nightCount !== 1 ? 's' : ''} × ${formatMAD(nightlyRate)} + ${formatMAD(cleaningFeeAmount)} ménage`
    : `${nightCount} nuit${nightCount !== 1 ? 's' : ''} × ${formatMAD(nightlyRate)}`;

  // ── Prestations rows (5 columns: Description | Total | Payé | Reste | Statut) ──
  const prestRows = [
    `<tr>
      <td class="desc">${accLabel}<br/><span class="sub">${accCalcSub}</span></td>
      <td class="amt">${formatMAD(totalAmount)}</td>
      <td class="pmtamt">${formatMAD(accPayé)}</td>
      <td class="pmtamt">${formatMAD(accReste)}</td>
      <td class="stcol">${accBadgeHtml}</td>
    </tr>`,
    ...activeServices.map(s => {
      const svcPayé = s.amount_paid ?? 0;
      const svcTotal = s.total_price ?? 0;
      const svcReste = Math.max(0, svcTotal - svcPayé);
      const svcBadgeHtml = svcPayé >= svcTotal && svcTotal > 0 ? mkBadge('PAYÉ ✓', 'st-paid')
        : svcPayé > 0 ? mkBadge('ACOMPTE', 'st-part')
        : mkBadge('NON PAYÉ', 'st-unpd');
      const calcSub = [
        s.quantity > 1 ? `${s.quantity} × ${formatMAD(s.unit_price)}` : '',
        s.scheduled_date ? formatDate(s.scheduled_date) : '',
      ].filter(Boolean).join(' · ');
      const opStatusLabel = SERVICE_STATUS_LABELS[s.status] ?? s.status;
      return `<tr>
        <td class="desc">${esc(s.service?.name ?? '—')}<span class="svc-op-st">${opStatusLabel}</span>${calcSub ? `<br/><span class="sub">${calcSub}</span>` : ''}</td>
        <td class="amt">${formatMAD(svcTotal)}</td>
        <td class="pmtamt">${formatMAD(svcPayé)}</td>
        <td class="pmtamt">${formatMAD(svcReste)}</td>
        <td class="stcol">${svcBadgeHtml}</td>
      </tr>`;
    }),
  ].join('');

  // ── Payment rows for fin-table (2-column: description + amount) ──
  const payFinRows = payments
    .filter(pay => pay.status !== 'failed')
    .map(pay => {
      const isRefund = pay.type === 'refund' || pay.type === 'deposit_release';
      const method = PAYMENT_METHOD_LABELS[pay.method] ?? pay.method;
      const date = pay.processed_at ? formatDate(pay.processed_at.slice(0, 10)) : '';
      const label = [PAYMENT_TYPE_LABELS[pay.type] ?? pay.type, method, date]
        .filter(Boolean).join(' · ');
      return `<tr class="${isRefund ? 'red' : 'green'}">
        <td>${label}</td>
        <td>${isRefund ? '− ' : ''}${formatMAD(pay.amount)}</td>
      </tr>`;
    }).join('');

  // ── Service payment rows in payment section ──
  const svcPmtRows = activeServices
    .filter(s => (s.amount_paid ?? 0) > 0)
    .map(s => `<tr class="green">
      <td>Paiement · ${esc(s.service?.name ?? '—')}</td>
      <td>${formatMAD(s.amount_paid ?? 0)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<style>
@page { size: A4 portrait; margin: 0; }
*    { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
  font-size: 10.5px;
  line-height: 1.45;
  color: #1a1a1a;
  background: #fff;
}
@media print {
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
.page { padding: 13mm 16mm 12mm; }

/* ── Header ── */
.hdr {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding-bottom: 10px;
  margin-bottom: 12px;
  border-bottom: 1.5px solid ${BRAND_GOLD};
}
.hdr-brand { display: flex; align-items: center; gap: 10px; }
.logo      { height: 38px; width: auto; }
.brand     { font-size: 15px; font-weight: 800; color: ${BRAND_PRIMARY}; letter-spacing: 0.3px; }
.brand-sub { font-size: 9px; color: #999; margin-top: 2px; }
.hdr-right { text-align: right; }
.facture   { font-size: 20px; font-weight: 800; color: ${BRAND_PRIMARY}; letter-spacing: 1.5px; }
.doc-ref   { font-size: 9.5px; color: #666; line-height: 1.7; margin-top: 4px; }
.doc-ref b { color: #222; }

/* ── Info grid (Client + Séjour) ── */
.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 20px;
  background: #f8f8f8;
  border-radius: 5px;
  padding: 9px 12px;
  margin-bottom: 12px;
}
.info-head { font-size: 8px; font-weight: 700; text-transform: uppercase;
             letter-spacing: 0.9px; color: ${BRAND_GOLD}; margin-bottom: 5px; }
.info-row  { display: flex; gap: 6px; margin-bottom: 2px; align-items: baseline; }
.lbl       { font-size: 9px; color: #888; min-width: 52px; flex-shrink: 0; }
.val       { font-size: 9.5px; font-weight: 600; color: #1a1a1a; word-break: break-word; }

/* ── Section label ── */
.slbl {
  font-size: 8px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.8px; color: ${BRAND_PRIMARY}; margin-bottom: 5px;
}

/* ── Prestations table ── */
.pt { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
.pt thead th {
  font-size: 8.5px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.3px; color: #888; padding: 3px 0;
  border-bottom: 1px solid #ddd;
}
.pt thead th.amt    { text-align: right; white-space: nowrap; }
.pt thead th.pmtamt { text-align: right; white-space: nowrap; }
.pt thead th.stcol  { text-align: center; white-space: nowrap; }
.pt tbody tr { page-break-inside: avoid; }
.pt tbody tr + tr td { border-top: 1px solid #f0f0f0; }
.pt td { padding: 5px 0; vertical-align: middle; }
.pt td.desc   { padding-right: 8px; vertical-align: top; padding-top: 6px; }
.pt td.amt    { text-align: right; font-weight: 600; white-space: nowrap; padding-right: 8px; }
.pt td.pmtamt { text-align: right; color: #555; white-space: nowrap; font-size: 10px; padding-right: 8px; }
.pt td.stcol  { text-align: center; padding-left: 4px; }
.pt tfoot td {
  border-top: 2px solid ${BRAND_PRIMARY}; padding-top: 6px; padding-bottom: 2px;
  font-weight: 700; font-size: 11px; color: ${BRAND_PRIMARY};
}
.pt tfoot td.amt    { text-align: right; }
.pt tfoot td.pmtamt { text-align: right; font-size: 10px; }
.sub { font-size: 9px; color: #888; margin-top: 1px; display: block; }
/* ── Payment status badges ── */
.st { display: inline-block; font-size: 7px; font-weight: 800; letter-spacing: 0.4px;
      text-transform: uppercase; padding: 2px 5px; border-radius: 3px; white-space: nowrap; }
.st-paid { background: #DCFCE7; color: #15803D; }
.st-part { background: #FEF3C7; color: #92400E; }
.st-unpd { background: #FEE2E2; color: #B91C1C; }
.st-remb { background: #F1F5F9; color: #64748B; }
/* Operational service status chip (Accepté / Planifié / etc.) */
.svc-op-st { display: inline-block; font-size: 7px; font-weight: 600; color: #555;
             background: #f0f0f0; border-radius: 3px; padding: 1px 4px;
             margin-left: 5px; vertical-align: middle; }

/* ── Financial summary ── */
.fin { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
.fin td { padding: 3px 0; font-size: 10px; }
.fin td:last-child { text-align: right; font-weight: 600; white-space: nowrap; }
.fin .muted td { color: #555; }
.fin .total td {
  font-weight: 800; font-size: 12px; color: ${BRAND_PRIMARY};
  border-top: 2px solid ${BRAND_PRIMARY}; padding-top: 6px;
}
.fin .green td:last-child { color: #15803D; }
.fin .red   td:last-child { color: #B91C1C; }
.fin .sep   td { border-top: 1px solid #e8e8e8; padding-top: 5px; }

/* ── Balance box ── */
.bal {
  border-radius: 6px; padding: 9px 14px; margin-top: 8px;
  page-break-inside: avoid; display: flex;
  justify-content: space-between; align-items: center;
}
.bal.due  { background: #FEF2F2; border: 1.5px solid #EF4444; }
.bal.paid { background: #F0FDF4; border: 1.5px solid #22C55E; }
.bal-lbl  { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; }
.bal.due  .bal-lbl  { color: #B91C1C; }
.bal.paid .bal-lbl  { color: #15803D; }
.bal-amt  { font-size: 20px; font-weight: 800; line-height: 1; }
.bal.due  .bal-amt  { color: #B91C1C; }
.bal.paid .bal-amt  { color: #15803D; }

/* ── Payments table ── */
.pay { width: 100%; border-collapse: collapse; font-size: 9.5px; }
.pay th {
  font-size: 8px; text-transform: uppercase; letter-spacing: 0.3px;
  color: #aaa; padding: 0 6px 4px 0; border-bottom: 1px solid #eee;
  text-align: left;
}
.pay td { padding: 4px 6px 4px 0; border-bottom: 1px solid #f5f5f5; color: #555; }
.pay tr:last-child td { border-bottom: none; }
.pay td:last-child { text-align: right; padding-right: 0; }

/* ── Special requests ── */
.notes {
  background: #fffbec; border: 1px solid #f3e6be; border-radius: 4px;
  padding: 7px 10px; font-size: 9.5px; color: #6a5a22;
  white-space: pre-wrap; word-break: break-word; page-break-inside: avoid;
}

/* ── Divider ── */
.div { border: none; border-top: 1px solid #e8e8e8; margin: 10px 0; }

/* ── Footer ── */
.ftr {
  margin-top: 14px; padding-top: 9px;
  border-top: 1.5px solid ${BRAND_GOLD};
  display: flex; justify-content: space-between; align-items: flex-start;
}
.ftr-brand { font-size: 11px; font-weight: 700; color: ${BRAND_PRIMARY}; }
.ftr-sub   { font-size: 9px; color: #aaa; margin-top: 1px; }
.ftr-right { text-align: right; font-size: 9.5px; color: #555; line-height: 1.7; }
.ftr-thank { text-align: center; font-size: 9px; color: #888; font-style: italic; margin-bottom: 8px; }
</style>
</head>
<body>
<div class="page">

<!-- HEADER -->
<div class="hdr">
  <div class="hdr-brand">
    ${logoDataUri ? `<img class="logo" src="${logoDataUri}" alt="Amkouy Stay"/>` : ''}
    <div>
      <div class="brand">AMKOUY STAY</div>
      <div class="brand-sub">Property Management &amp; Concierge · Agadir · Morocco</div>
    </div>
  </div>
  <div class="hdr-right">
    <div class="facture">FACTURE</div>
    <div class="doc-ref">
      Réf. <b>${esc(reservationCode)}</b><br/>
      Émis le ${issueDate}
    </div>
  </div>
</div>

<!-- CLIENT + SÉJOUR -->
<div class="info-grid">
  <div>
    <div class="info-head">Client</div>
    <div class="info-row"><span class="lbl">Nom</span><span class="val">${esc(guestName)}</span></div>
    ${guestPhone ? `<div class="info-row"><span class="lbl">Tél.</span><span class="val">${esc(guestPhone)}</span></div>` : ''}
    ${guestEmail ? `<div class="info-row"><span class="lbl">Email</span><span class="val">${esc(guestEmail)}</span></div>` : ''}
    <div class="info-row"><span class="lbl">Voyageurs</span><span class="val">${esc(travellerText)}</span></div>
  </div>
  <div>
    <div class="info-head">Séjour</div>
    ${propertyLine ? `<div class="info-row"><span class="lbl">Bien</span><span class="val">${propertyLine}</span></div>` : ''}
    <div class="info-row"><span class="lbl">Arrivée</span><span class="val">${formatDate(checkIn)}</span></div>
    <div class="info-row"><span class="lbl">Départ</span><span class="val">${formatDate(checkOut)}</span></div>
    <div class="info-row"><span class="lbl">Durée</span><span class="val">${nightCount} nuit${nightCount !== 1 ? 's' : ''}</span></div>
    ${channelName ? `<div class="info-row"><span class="lbl">Canal</span><span class="val">${esc(channelName)}</span></div>` : ''}
  </div>
</div>

<!-- PRESTATIONS (5 colonnes: Description | Total | Payé | Reste | Statut) -->
<div class="slbl">Prestations</div>
<table class="pt">
  <thead>
    <tr>
      <th style="text-align:left;width:34%">Description</th>
      <th class="amt"    style="width:14%">Total</th>
      <th class="pmtamt" style="width:14%">Payé</th>
      <th class="pmtamt" style="width:14%">Reste</th>
      <th class="stcol"  style="width:24%">Statut pmt.</th>
    </tr>
  </thead>
  <tbody>${prestRows}</tbody>
  <tfoot>
    <tr>
      <td>TOTAL FACTURE</td>
      <td class="amt">${formatMAD(grandTotal)}</td>
      <td class="pmtamt" style="color:#15803D;font-weight:800">${formatMAD(grandTotalPaid)}</td>
      <td class="pmtamt" style="color:${invoiceBalance > 0 ? '#B91C1C' : '#15803D'};font-weight:800">${formatMAD(invoiceBalance)}</td>
      <td></td>
    </tr>
  </tfoot>
</table>

<!-- PAIEMENTS REÇUS -->
${payments.filter(pay => pay.status !== 'failed').length > 0 || svcPmtRows ? `
<hr class="div"/>
<div class="slbl" style="margin-bottom:4px">Paiements reçus</div>
<table class="fin">
  ${payFinRows}
  ${svcPmtRows}
  ${grandTotalPaid > 0 ? `
  <tr class="sep">
    <td style="font-weight:800;font-size:11px;color:#15803D">Total encaissé</td>
    <td style="font-weight:800;font-size:11px;color:#15803D">${formatMAD(grandTotalPaid)}</td>
  </tr>` : ''}
</table>` : ''}

${paymentSummary ? `
<div class="bal ${isFullyPaid ? 'paid' : 'due'}">
  <div>
    <div class="bal-lbl">${isFullyPaid ? 'Payé intégralement' : 'Reste à payer'}</div>
    ${!isFullyPaid ? `<div style="font-size:9px;color:#888;margin-top:2px">Montant dû à la date de séjour</div>` : ''}
  </div>
  <div class="bal-amt">${isFullyPaid ? 'PAYÉ ✓' : formatMAD(invoiceBalance)}</div>
</div>` : ''}

${specialRequests ? `
<hr class="div"/>
<div class="slbl" style="margin-bottom:4px">Demandes spéciales</div>
<div class="notes">${esc(specialRequests)}</div>` : ''}

<div class="ftr-thank">Merci de votre confiance. Nous sommes ravis de vous accueillir à Agadir.</div>
<div class="ftr">
  <div>
    <div class="ftr-brand">AMKOUY STAY</div>
    <div class="ftr-sub">Property Management &amp; Concierge · Agadir · Morocco</div>
  </div>
  <div class="ftr-right">Tél&nbsp;: 0662205930<br/>Réf. ${esc(reservationCode)}</div>
</div>

</div><!-- /.page -->
</body>
</html>`;
}

/** Plain-text WhatsApp message built from the same data as the invoice. */
function buildWhatsappText(p: InvoiceParams): string {
  const activeSvcs = p.services.filter(s => s.status !== 'cancelled' && s.status !== 'refunded');
  const total = p.totalAmount + activeSvcs.reduce((sum, s) => sum + (s.total_price ?? 0), 0);
  const svcPaid = activeSvcs.reduce((sum, s) => sum + (s.amount_paid ?? 0), 0);
  const totalPaid = (p.paymentSummary?.netCollected ?? 0) + svcPaid;
  const balance = Math.max(0, total - totalPaid);
  const propertyLine = [p.propertyName, p.propertyCity].filter(Boolean).join(', ');
  return [
    `Bonjour ${p.guestName},`,
    '',
    'Veuillez trouver ci-joint votre facture AMKOUY Stay.',
    '',
    `Réf. : ${p.reservationCode}`,
    propertyLine ? `Bien : ${propertyLine}` : '',
    `Séjour : ${formatDate(p.checkIn)} → ${formatDate(p.checkOut)}`,
    `Total : ${formatMAD(total)}`,
    balance > 0 ? `Reste à payer : ${formatMAD(balance)}` : 'Payé intégralement ✓',
    '',
    'Merci pour votre confiance.',
    '',
    'AMKOUY Stay',
    'Tél. 0662205930',
  ].filter(line => line !== null).join('\n');
}

// ---------------------------------------------------------------------------
// Quick status action definitions
// ---------------------------------------------------------------------------

type QuickAction = {
  label: string;
  icon: string;
  bg: string;
  text: string;
  toStatus: ReservationStatusValue;
};

const QUICK_ACTIONS: Partial<Record<ReservationStatusValue, QuickAction[]>> = {
  pending: [
    { label: 'Confirmer',  icon: 'check_circle', bg: '#D1FAE5', text: '#065F46', toStatus: 'confirmed' },
    { label: 'No-show',    icon: 'person_off',   bg: '#FCE7F3', text: '#9D174D', toStatus: 'no_show'   },
    { label: 'Annuler',    icon: 'cancel',        bg: '#FEE2E2', text: '#991B1B', toStatus: 'cancelled' },
  ],
  confirmed: [
    { label: 'Check-in',  icon: 'login',         bg: '#0F1F3D', text: '#FFFFFF', toStatus: 'checked_in'  },
    { label: 'No-show',   icon: 'person_off',    bg: '#FCE7F3', text: '#9D174D', toStatus: 'no_show'     },
    { label: 'Annuler',   icon: 'cancel',         bg: '#FEE2E2', text: '#991B1B', toStatus: 'cancelled'  },
  ],
  checked_in: [
    { label: 'Check-out', icon: 'logout',         bg: '#E5E7EB', text: '#374151', toStatus: 'checked_out' },
  ],
  checked_out: [
    { label: 'Terminer',  icon: 'task_alt',       bg: '#DBEAFE', text: '#1E40AF', toStatus: 'completed' },
  ],
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type ReservationDetailCardProps = {
  /** null = hidden */
  reservationId: string | null;
  onClose: () => void;
  /** Called after any successful mutation so the caller can refresh calendar cache */
  onCalendarMutated: () => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReservationDetailCard({
  reservationId,
  onClose,
  onCalendarMutated,
}: ReservationDetailCardProps) {
  const { profile } = useAuth();
  const canEdit = canAccess(profile?.role, 'reservations');

  const queryClient = useQueryClient();
  const [editFormVisible, setEditFormVisible] = useState(false);
  const [actionPending, setActionPending] = useState<ReservationStatusValue | null>(null);
  const [printing, setPrinting] = useState(false);
  const [sharing, setSharing]   = useState(false);

  // Existing hook — fetches reservation with property/guest/channel joins
  const { data: reservation, isLoading, error } = useReservation(reservationId ?? undefined);

  // Existing hooks reused from reservation detail screen
  const { data: services } = useReservationServices(reservationId ?? undefined);
  const { data: payments } = usePayments(reservationId ?? undefined);
  const { data: paymentSummary } = useReservationPaymentSummary(reservationId ?? undefined);

  // Existing mutation — goes through updateReservation() → audit log → notifications
  const updateMutation = useUpdateReservation();

  // Cleaning tasks within the stay's date window (read-only, narrow query)
  const { data: cleaningTasks } = useQuery({
    queryKey: ['card-cleaning', reservation?.property_id, reservation?.check_in_date, reservation?.check_out_date],
    queryFn: async () => {
      const { data, error: qErr } = await supabase
        .from('cleaning_tasks')
        .select('id, scheduled_date, status')
        .eq('property_id', reservation!.property_id)
        .is('deleted_at', null)
        .gte('scheduled_date', reservation!.check_in_date)
        .lte('scheduled_date', reservation!.check_out_date);
      if (qErr) throw qErr;
      return data ?? [];
    },
    enabled: !!reservation,
    staleTime: 60_000,
  });

  // Maintenance tickets created during the stay window
  const { data: maintenanceTickets } = useQuery({
    queryKey: ['card-maintenance', reservation?.property_id, reservation?.check_in_date, reservation?.check_out_date],
    queryFn: async () => {
      const { data, error: qErr } = await supabase
        .from('maintenance_tickets')
        .select('id, priority, status')
        .eq('property_id', reservation!.property_id)
        .is('deleted_at', null)
        .gte('created_at', reservation!.check_in_date)
        .lte('created_at', reservation!.check_out_date + 'T23:59:59Z')
        .not('status', 'in', '(closed,cancelled)');
      if (qErr) throw qErr;
      return data ?? [];
    },
    enabled: !!reservation,
    staleTime: 60_000,
  });

  // Services total — accommodation payment summary is separate, no double-counting
  const servicesTotal = useMemo(
    () =>
      (services ?? [])
        .filter((s) => s.status !== 'cancelled' && s.status !== 'refunded')
        .reduce((sum, s) => sum + (s.total_price ?? 0), 0),
    [services]
  );

  function invalidateCalendar() {
    queryClient.invalidateQueries({ queryKey: ['calendar-reservations'] });
    queryClient.invalidateQueries({ queryKey: ['calendar-cleaning'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-metrics-calendar-today'] });
    onCalendarMutated();
  }

  function buildInput(overrides: Partial<ReservationFormValues> = {}): ReservationFormValues {
    if (!reservation) throw new Error('No reservation loaded');
    return {
      propertyId:         reservation.property_id,
      channelId:          reservation.channel_id ?? '',
      guestName:          reservation.guest?.full_name ?? '',
      guestPhone:         reservation.guest?.phone ?? '',
      checkInDate:        reservation.check_in_date,
      checkOutDate:       reservation.check_out_date,
      nightlyRate:        reservation.nightly_rate,
      cleaningFeeAmount:  reservation.cleaning_fee_amount,
      adults:             reservation.adults,
      children:           reservation.children,
      status:             reservation.status as ReservationStatusValue,
      specialRequests:    reservation.special_requests ?? '',
      ...overrides,
    };
  }

  async function handleQuickStatusChange(toStatus: ReservationStatusValue) {
    if (!reservation) return;
    setActionPending(toStatus);
    try {
      await updateMutation.mutateAsync(
        { id: reservation.id, input: buildInput({ status: toStatus }) },
        { onSuccess: () => invalidateCalendar() },
      );
      onClose();
    } catch (e) {
      Alert.alert('Erreur', (e as Error).message);
    } finally {
      setActionPending(null);
    }
  }

  async function handleEditSubmit(values: ReservationFormValues) {
    if (!reservation) return;
    try {
      await updateMutation.mutateAsync(
        { id: reservation.id, input: values },
        { onSuccess: () => invalidateCalendar() },
      );
      setEditFormVisible(false);
      onClose();
    } catch (e) {
      Alert.alert('Erreur', (e as Error).message);
    }
  }

  function buildInvoiceParams(logoDataUri?: string): InvoiceParams {
    return {
      reservationCode:   reservation!.reservation_code,
      guestName:         reservation!.guest?.full_name ?? '—',
      guestPhone:        reservation!.guest?.phone,
      guestEmail:        (reservation!.guest as any)?.email,
      adults:            reservation!.adults,
      children:          reservation!.children,
      checkIn:           reservation!.check_in_date,
      checkOut:          reservation!.check_out_date,
      nights:            reservation!.nights,
      channelName:       reservation!.channel?.name,
      propertyName:      reservation!.property?.name,
      propertyCity:      reservation!.property?.city,
      specialRequests:   reservation!.special_requests,
      nightlyRate:       reservation!.nightly_rate,
      subtotalAmount:    reservation!.subtotal_amount,
      cleaningFeeAmount: reservation!.cleaning_fee_amount,
      totalAmount:       reservation!.total_amount,
      services:          services ?? [],
      payments:          payments ?? [],
      paymentSummary,
      logoDataUri,
    };
  }

  async function handlePrint() {
    if (!reservation) return;
    setPrinting(true);
    try {
      const logoDataUri = await getLogoDataUri().catch(() => undefined);
      const invoiceParams = buildInvoiceParams(logoDataUri);
      const html = buildInvoiceHtml(invoiceParams);
      await generatePdf(`FACTURE-${reservation.reservation_code}.pdf`, html);
    } catch {
      Alert.alert('Erreur', 'Impossible de générer le PDF');
    } finally {
      setPrinting(false);
    }
  }

  async function handleShare() {
    if (!reservation) return;
    setSharing(true);
    try {
      const logoDataUri = await getLogoDataUri().catch(() => undefined);
      const invoiceParams = buildInvoiceParams(logoDataUri);
      const html = buildInvoiceHtml(invoiceParams);
      const whatsappText = buildWhatsappText(invoiceParams);
      await sharePdf(`FACTURE-${reservation.reservation_code}.pdf`, html, whatsappText);
    } catch {
      Alert.alert('Erreur', 'Impossible de partager la facture');
    } finally {
      setSharing(false);
    }
  }

  const visible = !!reservationId;
  const bs = reservation ? statusBadge(reservation.status) : null;
  const quickActions = reservation
    ? (QUICK_ACTIONS[reservation.status as ReservationStatusValue] ?? [])
    : [];

  const hasCleaningOrMaintenance =
    (cleaningTasks && cleaningTasks.length > 0) ||
    (maintenanceTickets && maintenanceTickets.length > 0);

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        <KeyboardAvoidingView
          style={styles.root}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* ── Header ── */}
          <View style={styles.header}>
            <View style={{ flex: 1, gap: 4 }}>
              {reservation ? (
                <>
                  <Text style={styles.code}>{reservation.reservation_code}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: bs!.bg, borderColor: bs!.border }]}>
                    <Text style={[styles.statusBadgeText, { color: bs!.text }]}>
                      {STATUS_LABELS[reservation.status] ?? reservation.status}
                    </Text>
                  </View>
                </>
              ) : (
                <Text style={styles.code}>Réservation</Text>
              )}
            </View>
            <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
              <Icon name="close" size={20} color={AmkouyColors.textMuted} />
            </Pressable>
          </View>

          {/* ── Loading / Error ── */}
          {isLoading && (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={AmkouyColors.primary} />
            </View>
          )}
          {error && (
            <View style={styles.center}>
              <Icon name="error_outline" size={32} color={AmkouyColors.error} />
              <Text style={styles.errorText}>Impossible de charger la réservation</Text>
            </View>
          )}

          {!isLoading && reservation && (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>

              {/* ── Guest ── */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Client</Text>
                <Row icon="person" label="Nom" value={reservation.guest?.full_name ?? '—'} />
                {reservation.guest?.phone && (
                  <Row icon="phone" label="Téléphone" value={reservation.guest.phone} />
                )}
                <Row
                  icon="group"
                  label="Voyageurs"
                  value={`${reservation.adults} adulte${reservation.adults > 1 ? 's' : ''}${
                    reservation.children > 0
                      ? ` · ${reservation.children} enfant${reservation.children > 1 ? 's' : ''}`
                      : ''
                  }`}
                />
              </View>

              {/* ── Stay dates ── */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Séjour</Text>
                <Row icon="login"       label="Arrivée"  value={formatDate(reservation.check_in_date)} />
                <Row icon="logout"      label="Départ"   value={formatDate(reservation.check_out_date)} />
                <Row icon="nights_stay" label="Nuits"    value={String(reservation.nights ?? 0)} />
                {reservation.channel && (
                  <Row icon="storefront" label="Canal" value={reservation.channel.name} />
                )}
              </View>

              {/* ── Property ── */}
              {reservation.property && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Bien</Text>
                  <Row icon="apartment" label="Nom"   value={reservation.property.name} />
                  <Row icon="place"     label="Ville" value={reservation.property.city} />
                </View>
              )}

              {/* ── Special requests ── */}
              {!!reservation.special_requests && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Demandes spéciales</Text>
                  <Text style={styles.notesText}>{reservation.special_requests}</Text>
                </View>
              )}

              {/* ── Services & supplements ── */}
              {services !== undefined && services.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Services &amp; suppléments</Text>
                  {services.map((svc) => {
                    const isCancelled = svc.status === 'cancelled' || svc.status === 'refunded';
                    return (
                      <View key={svc.id} style={styles.serviceRow}>
                        <View style={styles.serviceLeft}>
                          <Text style={[styles.serviceName, isCancelled && styles.serviceStrike]}>
                            {svc.service?.name ?? '—'}
                          </Text>
                          <Text style={styles.serviceDetail}>
                            {svc.quantity} × {formatMAD(svc.unit_price)}
                            {svc.scheduled_date ? `  ·  ${formatDate(svc.scheduled_date)}` : ''}
                          </Text>
                        </View>
                        <View style={styles.serviceRight}>
                          <Text style={[styles.serviceTotal, isCancelled && styles.serviceStrike]}>
                            {formatMAD(svc.total_price ?? 0)}
                          </Text>
                          <View style={[styles.svcBadge, { backgroundColor: isCancelled ? '#FEE2E2' : '#F3F4F6' }]}>
                            <Text style={[styles.svcBadgeText, { color: isCancelled ? '#991B1B' : AmkouyColors.textMuted }]}>
                              {SERVICE_STATUS_LABELS[svc.status] ?? svc.status}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                  {servicesTotal > 0 && (
                    <>
                      <View style={styles.divider} />
                      <Row icon="receipt" label="Total services" value={formatMAD(servicesTotal)} bold />
                    </>
                  )}
                </View>
              )}

              {/* ── Finances hébergement ── */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Finances hébergement</Text>
                <Row icon="monetization_on"   label="Tarif/nuit"     value={formatMAD(reservation.nightly_rate)} />
                <Row icon="calculate"         label="Sous-total"      value={formatMAD(reservation.subtotal_amount)} />
                {reservation.cleaning_fee_amount > 0 && (
                  <Row icon="cleaning_services" label="Frais ménage"  value={formatMAD(reservation.cleaning_fee_amount)} />
                )}
                <View style={styles.divider} />
                <Row icon="receipt_long" label="Total logement" value={formatMAD(reservation.total_amount)} bold />
              </View>

              {/* ── Paiements ── */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Paiements</Text>
                {paymentSummary ? (
                  <>
                    {paymentSummary.depositPaid > 0 && (
                      <Row icon="savings"         label="Acompte versé"  value={formatMAD(paymentSummary.depositPaid)} />
                    )}
                    {paymentSummary.balancePaid > 0 && (
                      <Row icon="paid"            label="Solde versé"    value={formatMAD(paymentSummary.balancePaid)} />
                    )}
                    {paymentSummary.refunded > 0 && (
                      <Row icon="undo"            label="Remboursements" value={`- ${formatMAD(paymentSummary.refunded)}`} />
                    )}
                    <View style={styles.divider} />
                    <Row icon="check_circle"      label="Net encaissé"   value={formatMAD(paymentSummary.netCollected)} color="#15803D" bold />
                    {paymentSummary.outstanding > 0 && (
                      <Row icon="pending_actions" label="Reste dû"       value={formatMAD(paymentSummary.outstanding)} color="#B91C1C" />
                    )}
                  </>
                ) : (
                  <View style={{ paddingVertical: 6 }}>
                    <ActivityIndicator size="small" color={AmkouyColors.textFaint} />
                  </View>
                )}

                {/* Individual payment rows */}
                {payments && payments.length > 0 && (
                  <>
                    <View style={[styles.divider, { marginTop: 6 }]} />
                    <Text style={styles.paymentListLabel}>Détail des mouvements</Text>
                    {payments.map((p) => {
                      const isRefund = p.type === 'refund' || p.type === 'deposit_release';
                      return (
                        <View key={p.id} style={styles.paymentItem}>
                          <View style={styles.paymentItemLeft}>
                            <Icon
                              name={isRefund ? 'undo' : 'payments'}
                              size={13}
                              color={isRefund ? '#B91C1C' : '#15803D'}
                            />
                            <View>
                              <Text style={styles.paymentItemType}>
                                {PAYMENT_TYPE_LABELS[p.type] ?? p.type}
                              </Text>
                              <Text style={styles.paymentItemMeta}>
                                {PAYMENT_METHOD_LABELS[p.method] ?? p.method}
                                {p.processed_at ? `  ·  ${formatDate(p.processed_at.slice(0, 10))}` : ''}
                              </Text>
                            </View>
                          </View>
                          <Text style={[styles.paymentItemAmount, isRefund && { color: '#B91C1C' }]}>
                            {isRefund ? '- ' : ''}{formatMAD(p.amount)}
                          </Text>
                        </View>
                      );
                    })}
                  </>
                )}
              </View>

              {/* ── Ménage & Maintenance ── */}
              {hasCleaningOrMaintenance && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Ménage &amp; maintenance</Text>
                  {(cleaningTasks ?? []).map((t) => (
                    <View key={t.id} style={styles.markerItem}>
                      <Icon name="cleaning_services" size={14} color="#3B82F6" />
                      <View style={styles.markerContent}>
                        <Text style={styles.markerTitle}>
                          Ménage{t.scheduled_date ? ` — ${formatDate(t.scheduled_date)}` : ''}
                        </Text>
                        <Text style={styles.markerSub}>
                          {CLEANING_STATUS_LABELS[t.status] ?? t.status}
                        </Text>
                      </View>
                    </View>
                  ))}
                  {(maintenanceTickets ?? []).map((t) => {
                    const isUrgent = t.priority === 'urgent';
                    return (
                      <View key={t.id} style={styles.markerItem}>
                        <Icon name="build" size={14} color={isUrgent ? '#EF4444' : '#6B7280'} />
                        <View style={styles.markerContent}>
                          <Text style={[styles.markerTitle, isUrgent && { color: '#B91C1C' }]}>
                            Maintenance {isUrgent ? 'urgente' : 'planifiée'}
                          </Text>
                          <Text style={styles.markerSub}>{t.status}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

            </ScrollView>
          )}

          {/* ── Footer ── */}
          {!isLoading && reservation && (
            <View style={styles.footer}>
              {/* Quick status actions */}
              {canEdit && quickActions.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.quickActionsRow}
                >
                  {quickActions.map((a) => (
                    <TouchableOpacity
                      key={a.toStatus}
                      style={[styles.quickActionBtn, { backgroundColor: a.bg }]}
                      onPress={() => handleQuickStatusChange(a.toStatus)}
                      disabled={actionPending !== null || updateMutation.isPending}
                      activeOpacity={0.75}
                    >
                      {actionPending === a.toStatus ? (
                        <ActivityIndicator size="small" color={a.text} />
                      ) : (
                        <>
                          <Icon name={a.icon} size={14} color={a.text} />
                          <Text style={[styles.quickActionLabel, { color: a.text }]}>{a.label}</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {/* Primary actions */}
              <View style={styles.primaryActions}>
                {canEdit && (
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.editBtn]}
                    onPress={() => setEditFormVisible(true)}
                    activeOpacity={0.8}
                  >
                    <Icon name="edit" size={16} color={AmkouyColors.primary} />
                    <Text style={styles.editBtnText}>Modifier</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.actionBtn, styles.printBtn]}
                  onPress={handlePrint}
                  disabled={printing || sharing}
                  activeOpacity={0.8}
                >
                  {printing ? (
                    <ActivityIndicator size="small" color="#374151" />
                  ) : (
                    <>
                      <Icon name="print" size={16} color="#374151" />
                      <Text style={styles.printBtnText}>PDF</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.shareBtn]}
                  onPress={handleShare}
                  disabled={printing || sharing}
                  activeOpacity={0.8}
                >
                  {sharing ? (
                    <ActivityIndicator size="small" color={AmkouyColors.primary} />
                  ) : (
                    <>
                      <Icon name="share" size={16} color={AmkouyColors.primary} />
                      <Text style={styles.shareBtnText}>Partager</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.viewBtn]}
                  onPress={() => {
                    onClose();
                    router.push(`/reservations/${reservation.id}`);
                  }}
                  activeOpacity={0.8}
                >
                  <Icon name="open_in_new" size={16} color="#FFFFFF" />
                  <Text style={styles.viewBtnText}>Voir la réservation</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit form — reuses existing ReservationForm, no new form logic */}
      {reservation && (
        <ReservationForm
          visible={editFormVisible}
          mode="edit"
          initialValues={buildInput()}
          onClose={() => setEditFormVisible(false)}
          onSubmit={handleEditSubmit}
          submitting={updateMutation.isPending}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Internal Row helper
// ---------------------------------------------------------------------------

function Row({
  icon,
  label,
  value,
  bold = false,
  color,
}: {
  icon: string;
  label: string;
  value: string;
  bold?: boolean;
  color?: string;
}) {
  return (
    <View style={rowStyles.row}>
      <Icon name={icon} size={15} color={AmkouyColors.textMuted} />
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={[rowStyles.value, bold && rowStyles.valueBold, color ? { color } : undefined]}>
        {value}
      </Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 5,
  },
  label: {
    ...robotoText(400, 13, { color: AmkouyColors.textMuted, flex: 1 }),
  },
  value: {
    ...robotoText(500, 13, { color: AmkouyColors.text }),
    textAlign: 'right',
    maxWidth: '55%',
  },
  valueBold: {
    ...robotoText(700, 14, { color: AmkouyColors.primary }),
  },
});

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: AmkouyColors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: AmkouyColors.hairline,
    gap: 12,
  },
  code: {
    ...robotoText(700, 18, { color: AmkouyColors.primary }),
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusBadgeText: {
    ...robotoText(600, 12),
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: AmkouyColors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
    paddingBottom: 24,
  },
  section: {
    backgroundColor: AmkouyColors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: AmkouyColors.hairline,
    gap: 2,
    marginBottom: 8,
  },
  sectionTitle: {
    ...robotoText(600, 12, {
      color: AmkouyColors.textFaint,
      marginBottom: 6,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    }),
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: AmkouyColors.hairline,
    marginVertical: 4,
  },
  notesText: {
    ...robotoText(400, 13, { color: AmkouyColors.text, lineHeight: 20 }),
  },

  // Services
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 6,
    gap: 8,
  },
  serviceLeft: {
    flex: 1,
    gap: 2,
  },
  serviceName: {
    ...robotoText(500, 13, { color: AmkouyColors.text }),
  },
  serviceStrike: {
    textDecorationLine: 'line-through',
    color: AmkouyColors.textMuted,
  },
  serviceDetail: {
    ...robotoText(400, 11, { color: AmkouyColors.textMuted }),
  },
  serviceRight: {
    alignItems: 'flex-end',
    gap: 3,
  },
  serviceTotal: {
    ...robotoText(600, 13, { color: AmkouyColors.text }),
  },
  svcBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  svcBadgeText: {
    ...robotoText(500, 10),
  },

  // Payment list
  paymentListLabel: {
    ...robotoText(600, 11, {
      color: AmkouyColors.textFaint,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginTop: 4,
      marginBottom: 2,
    }),
  },
  paymentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
    gap: 8,
  },
  paymentItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  paymentItemType: {
    ...robotoText(500, 13, { color: AmkouyColors.text }),
  },
  paymentItemMeta: {
    ...robotoText(400, 11, { color: AmkouyColors.textMuted }),
  },
  paymentItemAmount: {
    ...robotoText(600, 13, { color: '#15803D' }),
  },

  // Cleaning / maintenance markers
  markerItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 5,
  },
  markerContent: {
    flex: 1,
    gap: 1,
  },
  markerTitle: {
    ...robotoText(500, 13, { color: AmkouyColors.text }),
  },
  markerSub: {
    ...robotoText(400, 11, { color: AmkouyColors.textMuted }),
  },

  // Center (loading / error)
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  errorText: {
    ...robotoText(400, 14, { color: AmkouyColors.error }),
  },

  // Footer
  footer: {
    borderTopWidth: 1,
    borderTopColor: AmkouyColors.hairline,
    backgroundColor: AmkouyColors.card,
    paddingBottom: Platform.OS === 'ios' ? 8 : 16,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  quickActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
  },
  quickActionLabel: {
    ...robotoText(600, 12),
  },
  primaryActions: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 46,
    borderRadius: 23,
  },
  editBtn: {
    flex: 1,
    backgroundColor: AmkouyColors.secondaryContainer,
    borderWidth: 1,
    borderColor: AmkouyColors.secondary,
  },
  editBtnText: {
    ...robotoText(600, 14, { color: AmkouyColors.primary }),
  },
  printBtn: {
    width: 56,
    backgroundColor: AmkouyColors.hairline,
    borderWidth: 1,
    borderColor: AmkouyColors.hairline,
  },
  printBtnText: {
    ...robotoText(600, 13, { color: '#374151' }),
  },
  shareBtn: {
    flex: 1,
    backgroundColor: AmkouyColors.secondaryContainer,
    borderWidth: 1,
    borderColor: AmkouyColors.secondary,
  },
  shareBtnText: {
    ...robotoText(600, 14, { color: AmkouyColors.primary }),
  },
  viewBtn: {
    flex: 2,
    backgroundColor: AmkouyColors.primary,
  },
  viewBtnText: {
    ...robotoText(600, 14, { color: '#FFFFFF' }),
  },
});
