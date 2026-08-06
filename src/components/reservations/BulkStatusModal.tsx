import { Text } from 'react-native';

import { FormModal } from '@/components/amkouy/form-modal';
import { SelectField } from '@/components/amkouy/select-field';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import { RESERVATION_STATUS_OPTIONS, ReservationStatusValue } from '@/lib/validation/reservation';

/**
 * Status-change modal shared by the bulk action bar. Reuses `FormModal`/`SelectField` exactly as
 * the single-reservation edit form does — the screen is the one that actually calls
 * `updateReservation` per selected row, this component only collects the target status.
 */
export function BulkStatusModal({
  visible,
  targetCount,
  value,
  onChangeValue,
  onClose,
  onSubmit,
  submitting,
}: {
  visible: boolean;
  targetCount: number;
  value: ReservationStatusValue | '';
  onChangeValue: (value: ReservationStatusValue) => void;
  onClose: () => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  return (
    <FormModal
      visible={visible}
      title="Changer le statut"
      onClose={onClose}
      onSubmit={onSubmit}
      submitting={submitting}
      submitLabel="Appliquer">
      <Text style={{ ...robotoText(400, 12.5, { color: AmkouyColors.textFaint, marginBottom: 4 }) }}>
        {targetCount} réservation(s) concernée(s).
      </Text>
      <SelectField
        label="Nouveau statut"
        value={value || null}
        options={[...RESERVATION_STATUS_OPTIONS]}
        onChange={(v) => onChangeValue(v as ReservationStatusValue)}
        placeholder="Sélectionner un statut…"
      />
    </FormModal>
  );
}
