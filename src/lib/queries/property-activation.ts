import { listActivity, logActivity } from '@/lib/queries/activity-log';
import { notifyUsers } from '@/lib/queries/notifications';
import { supabase } from '@/lib/supabase';
import { listStaffUserIds } from '@/lib/queries/users';
import { logAppError } from '@/utils/errors';

// ============================================================================
// Everything here reads from `get_property_activation_status` (the one canonical
// computation, also used by the DB trigger that actually enforces the readiness
// gate) — nothing is recomputed or stored a second time in the app layer.
// ============================================================================

export type ActivationStage =
  | 'contract_pending'
  | 'photos_pending'
  | 'property_setup_pending'
  | 'pricing_pending'
  | 'ready_for_activation'
  | 'active';

export type PropertyActivationStatus = {
  hasActiveContract: boolean;
  photosCount: number;
  photosRequired: number;
  photosSatisfied: boolean;
  setupComplete: boolean;
  missingSetupFields: string[];
  pricingComplete: boolean;
  isReady: boolean;
  activationScore: number;
  computedStage: ActivationStage;
};

export async function getPropertyActivationStatus(propertyId: string): Promise<PropertyActivationStatus> {
  const { data, error } = await supabase.rpc('get_property_activation_status', { p_property_id: propertyId });
  if (error) {
    logAppError('property-activation.getPropertyActivationStatus', error);
    throw error;
  }
  const row = data?.[0];
  return {
    hasActiveContract: row?.has_active_contract ?? false,
    photosCount: row?.photos_count ?? 0,
    photosRequired: row?.photos_required ?? 10,
    photosSatisfied: row?.photos_satisfied ?? false,
    setupComplete: row?.setup_complete ?? false,
    missingSetupFields: row?.missing_setup_fields ?? [],
    pricingComplete: row?.pricing_complete ?? false,
    isReady: row?.is_ready ?? false,
    activationScore: row?.activation_score ?? 0,
    computedStage: (row?.computed_stage as ActivationStage) ?? 'contract_pending',
  };
}

export type ActivationCenterEntry = {
  propertyId: string;
  propertyName: string;
  city: string | null;
  acquiredByAgent: string | null;
  hasActiveContract: boolean;
  photosCount: number;
  photosSatisfied: boolean;
  setupComplete: boolean;
  pricingComplete: boolean;
  isReady: boolean;
  activationScore: number;
  computedStage: ActivationStage;
  daysInOnboarding: number;
};

export async function getActivationCenterSummary(): Promise<ActivationCenterEntry[]> {
  const { data, error } = await supabase.rpc('get_activation_center_summary');
  if (error) {
    logAppError('property-activation.getActivationCenterSummary', error);
    throw error;
  }
  return (data ?? []).map((row) => ({
    propertyId: row.property_id,
    propertyName: row.property_name,
    city: row.city,
    acquiredByAgent: row.acquired_by_agent,
    hasActiveContract: row.has_active_contract,
    photosCount: row.photos_count,
    photosSatisfied: row.photos_satisfied,
    setupComplete: row.setup_complete,
    pricingComplete: row.pricing_complete,
    isReady: row.is_ready,
    activationScore: row.activation_score,
    computedStage: row.computed_stage as ActivationStage,
    daysInOnboarding: row.days_in_onboarding,
  }));
}

export type OnboardingDashboardMetrics = {
  propertiesInOnboarding: number;
  readyToActivate: number;
  activatedThisPeriod: number;
  avgActivationDays: number | null;
  blockedProperties: number;
  activationRate: number;
};

export async function getOnboardingDashboardMetrics(startIso: string, endIso: string): Promise<OnboardingDashboardMetrics> {
  const { data, error } = await supabase.rpc('get_onboarding_dashboard_metrics', { p_start: startIso, p_end: endIso });
  if (error) {
    logAppError('property-activation.getOnboardingDashboardMetrics', error);
    throw error;
  }
  const row = data?.[0];
  return {
    propertiesInOnboarding: row?.properties_in_onboarding ?? 0,
    readyToActivate: row?.ready_to_activate ?? 0,
    activatedThisPeriod: row?.activated_this_period ?? 0,
    avgActivationDays: row?.avg_activation_days == null ? null : Number(row.avg_activation_days),
    blockedProperties: row?.blocked_properties ?? 0,
    activationRate: Number(row?.activation_rate ?? 0),
  };
}

export type ActivationFunnelReport = {
  propertiesAcquired: number;
  propertiesActivated: number;
  activationRate: number;
  avgActivationDays: number | null;
  avgDaysToFirstBooking: number | null;
};

export async function getActivationFunnelReport(
  startIso: string,
  endIso: string,
  agentId?: string,
  propertyType?: string
): Promise<ActivationFunnelReport> {
  const { data, error } = await supabase.rpc('get_activation_funnel_report', {
    p_start: startIso,
    p_end: endIso,
    p_agent_id: agentId ?? undefined,
    p_property_type: (propertyType as never) ?? undefined,
  });
  if (error) {
    logAppError('property-activation.getActivationFunnelReport', error);
    throw error;
  }
  const row = data?.[0];
  return {
    propertiesAcquired: row?.properties_acquired ?? 0,
    propertiesActivated: row?.properties_activated ?? 0,
    activationRate: Number(row?.activation_rate ?? 0),
    avgActivationDays: row?.avg_activation_days == null ? null : Number(row.avg_activation_days),
    avgDaysToFirstBooking: row?.avg_days_to_first_booking == null ? null : Number(row.avg_days_to_first_booking),
  };
}

export type PropertySetupInput = {
  description?: string;
  bedrooms?: number | null;
  bathrooms?: number | null;
  maxGuests?: number | null;
  amenities?: string[];
  houseRules?: string;
  checkinInstructions?: string;
  emergencyContact?: string;
  wifiInfo?: string;
};

/** Setup-checklist fields live directly on `properties` (no duplicate onboarding-details
 * table) — this just updates the same row every other property screen already reads/writes. */
export async function updatePropertySetup(propertyId: string, input: PropertySetupInput): Promise<void> {
  const { error } = await supabase
    .from('properties')
    .update({
      description: input.description,
      bedrooms: input.bedrooms,
      bathrooms: input.bathrooms,
      max_guests: input.maxGuests,
      amenities: input.amenities,
      house_rules: input.houseRules,
      checkin_instructions: input.checkinInstructions,
      emergency_contact: input.emergencyContact,
      wifi_info: input.wifiInfo,
    })
    .eq('id', propertyId);
  if (error) {
    logAppError('property-activation.updatePropertySetup', error);
    throw error;
  }
  await logActivity({ entityType: 'property', entityId: propertyId, action: 'property.setup_updated' });
  await notifyIfNowReady(propertyId);
}

/** Called after any of the three onboarding mutations — "Property becomes ready" fires exactly
 * when this specific save is the one that completes the last outstanding requirement, not on
 * every subsequent read (computed each time, not a stored flag). */
export async function notifyIfNowReady(propertyId: string): Promise<void> {
  const status = await getPropertyActivationStatus(propertyId);
  if (status.isReady) {
    const staffIds = await listStaffUserIds();
    await notifyUsers({
      userIds: staffIds,
      type: 'onboarding',
      title: 'Propriété prête à activer',
      relatedEntityType: 'property',
      relatedEntityId: propertyId,
    });
  }
}

export type PropertyPricingInput = {
  baseNightlyRate?: number;
  cleaningFee?: number;
  defaultSecurityDepositAmount?: number;
  minStayNights?: number;
};

export async function updatePropertyPricing(propertyId: string, input: PropertyPricingInput): Promise<void> {
  const { error } = await supabase
    .from('properties')
    .update({
      base_nightly_rate: input.baseNightlyRate,
      cleaning_fee: input.cleaningFee,
      default_security_deposit_amount: input.defaultSecurityDepositAmount,
      min_stay_nights: input.minStayNights,
    })
    .eq('id', propertyId);
  if (error) {
    logAppError('property-activation.updatePropertyPricing', error);
    throw error;
  }
  await logActivity({ entityType: 'property', entityId: propertyId, action: 'property.pricing_completed' });
  await notifyIfNowReady(propertyId);
}

/** No cron exists — same pattern as Module 7's `syncContractExpiryNotifications`: safe to call on
 * every Activation Center load, deduped per-property via `activity_logs` so a property stuck in
 * onboarding for >14 days is only ever notified about once. */
export async function syncStaleOnboardingNotifications(properties: ActivationCenterEntry[]): Promise<void> {
  const stale = properties.filter((p) => p.daysInOnboarding > 14);
  if (stale.length === 0) return;
  const staffIds = await listStaffUserIds();
  for (const p of stale) {
    const action = 'property.onboarding_stale_14d';
    const history = await listActivity('property', p.propertyId);
    if (history.some((h) => h.action === action)) continue;
    await notifyUsers({
      userIds: staffIds,
      type: 'onboarding',
      title: 'Onboarding bloqué depuis plus de 14 jours',
      body: `${p.propertyName} · ${p.daysInOnboarding}j`,
      priority: 'warning',
      relatedEntityType: 'property',
      relatedEntityId: p.propertyId,
    });
    await logActivity({ entityType: 'property', entityId: p.propertyId, action });
  }
}

/** The actual onboarding -> active transition. Readiness is enforced by the DB trigger
 * (`enforce_property_activation_readiness`), not here — if the property isn't ready, this
 * throws whatever the trigger raised, so there is no "UI thinks it succeeded" gap. */
export async function activateProperty(propertyId: string, propertyName: string): Promise<void> {
  const { error } = await supabase.from('properties').update({ status: 'active' }).eq('id', propertyId);
  if (error) {
    logAppError('property-activation.activateProperty', error);
    throw error;
  }
  await logActivity({ entityType: 'property', entityId: propertyId, action: 'property.activated' });
  const staffIds = await listStaffUserIds();
  await notifyUsers({
    userIds: staffIds,
    type: 'onboarding',
    title: 'Propriété activée',
    body: propertyName,
    relatedEntityType: 'property',
    relatedEntityId: propertyId,
  });
}
