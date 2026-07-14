import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AccessGuard } from '@/components/amkouy/access-guard';
import { Badge } from '@/components/amkouy/badge';
import { Card } from '@/components/amkouy/card';
import { ErrorState } from '@/components/amkouy/error-state';
import { LoadingState } from '@/components/amkouy/loading-state';
import { Screen } from '@/components/amkouy/screen';
import { ScreenHeader } from '@/components/amkouy/screen-header';
import { ExpenseForm } from '@/components/forms/expense-form';
import { Icon } from '@/components/icon';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import { useArchiveExpense, useExpense, useUpdateExpense } from '@/hooks/use-expenses';
import { getAttachmentSignedUrl } from '@/lib/storage';
import { EXPENSE_CATEGORY_OPTIONS, EXPENSE_STATUS_OPTIONS, ExpenseFormValues, PAYMENT_METHOD_OPTIONS } from '@/lib/validation/expense';
import { confirmDestructive, notify } from '@/utils/alert';
import { getErrorMessage } from '@/utils/errors';
import { formatMAD } from '@/utils/format';
import { goBackOrReplace } from '@/utils/navigation';

const CATEGORY_LABEL = Object.fromEntries(EXPENSE_CATEGORY_OPTIONS.map((o) => [o.value, o.label]));
const STATUS_LABEL = Object.fromEntries(EXPENSE_STATUS_OPTIONS.map((o) => [o.value, o.label]));
const PAYMENT_METHOD_LABEL = Object.fromEntries(PAYMENT_METHOD_OPTIONS.map((o) => [o.value, o.label]));
const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  draft: { bg: '#EEF0F4', text: '#5A5E66' },
  approved: { bg: '#E3E9F4', text: '#1E3A6E' },
  paid: { bg: '#DEF7E6', text: '#15803D' },
  cancelled: { bg: '#FAD9D9', text: '#B91C1C' },
};

export default function ExpenseDetailScreen() {
  return (
    <AccessGuard resource="expenses">
      <ExpenseDetailContent />
    </AccessGuard>
  );
}

function ExpenseDetailContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: expense, isLoading, isError, refetch } = useExpense(id);
  const updateExpense = useUpdateExpense();
  const archiveExpense = useArchiveExpense();
  const [showEdit, setShowEdit] = useState(false);
  const [resolvedReceiptUrl, setResolvedReceiptUrl] = useState<string | null>(null);
  const receiptPath = expense?.receipt_url ?? null;

  useEffect(() => {
    if (!receiptPath) return;
    let cancelled = false;
    getAttachmentSignedUrl(receiptPath).then((url) => {
      if (!cancelled) setResolvedReceiptUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [receiptPath]);

  const receiptUrl = receiptPath ? resolvedReceiptUrl : null;

  const handleUpdate = (values: ExpenseFormValues) => {
    updateExpense.mutate(
      {
        id: id as string,
        input: {
          category: values.category as ExpenseFormValues['category'],
          description: values.description,
          propertyId: values.propertyId,
          reservationId: values.reservationId,
          ownerId: values.ownerId,
          amount: values.amount,
          expenseDate: values.expenseDate,
          vendorName: values.vendorName,
          paymentMethod: values.paymentMethod as never,
          receiptPath: values.receiptPath,
          notes: values.notes,
          status: values.status as ExpenseFormValues['status'],
        },
      },
      {
        onSuccess: () => {
          setShowEdit(false);
          notify('Dépense modifiée', 'Les changements ont été enregistrés.');
        },
        onError: (error) => notify('Erreur', getErrorMessage(error, 'Impossible de modifier la dépense.')),
      }
    );
  };

  const handleArchive = () => {
    if (!expense) return;
    confirmDestructive('Archiver cette dépense ?', `"${expense.description}" sera retirée de vos listes.`, () => {
      archiveExpense.mutate(expense.id, {
        onSuccess: () => goBackOrReplace('/more/expenses'),
        onError: (error) => notify('Erreur', getErrorMessage(error, 'Archivage impossible.')),
      });
    });
  };

  if (isLoading) return <LoadingState label="Chargement de la dépense…" />;
  if (isError || !expense)
    return <ErrorState message="Dépense introuvable ou erreur de chargement." onRetry={refetch} />;

  const statusColors = STATUS_COLOR[expense.status];

  return (
    <Screen
      footer={
        <View style={styles.stickyFooter}>
          <Pressable onPress={() => setShowEdit(true)} style={styles.editButton}>
            <Icon name="edit" size={20} color={AmkouyColors.primary} />
            <Text style={styles.editButtonText}>Modifier</Text>
          </Pressable>
        </View>
      }>
      <ScreenHeader title={expense.expense_number} showBack fallbackHref="/more/expenses" />

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.description}>{expense.description}</Text>
          <Badge label={STATUS_LABEL[expense.status] ?? expense.status} bg={statusColors.bg} color={statusColors.text} />
        </View>

        <Card style={styles.infoCard}>
          <InfoRow label="Catégorie" value={CATEGORY_LABEL[expense.category] ?? expense.category} border />
          <InfoRow label="Montant" value={formatMAD(expense.amount)} bold border />
          <InfoRow label="Date" value={expense.expense_date} border />
          <InfoRow label="Bien" value={expense.property?.name ?? '—'} border />
          <InfoRow label="Propriétaire" value={expense.owner?.full_name ?? '—'} border />
          <InfoRow label="Fournisseur" value={expense.vendor_name ?? '—'} border />
          <InfoRow
            label="Paiement"
            value={expense.payment_method ? PAYMENT_METHOD_LABEL[expense.payment_method] : '—'}
          />
        </Card>

        {!!expense.notes && (
          <>
            <Text style={styles.sectionTitle}>Notes</Text>
            <View style={styles.notesCard}>
              <Text style={styles.notesText}>{expense.notes}</Text>
            </View>
          </>
        )}

        <Text style={styles.sectionTitle}>Reçu</Text>
        {receiptUrl ? (
          <Pressable onPress={() => notify('Reçu', receiptUrl)}>
            <Card style={styles.receiptCard}>
              <Icon name="receipt_long" size={22} color={AmkouyColors.primaryContainer} />
              <Text style={styles.receiptText}>Voir le reçu joint</Text>
            </Card>
          </Pressable>
        ) : (
          <Text style={styles.emptyText}>Aucun reçu joint.</Text>
        )}

        <Pressable onPress={handleArchive} style={styles.archiveButton}>
          <Icon name="archive" size={20} color={AmkouyColors.error} />
          <Text style={styles.archiveButtonText}>Archiver cette dépense</Text>
        </Pressable>
      </View>

      <ExpenseForm
        visible={showEdit}
        mode="edit"
        initialValues={{
          category: expense.category,
          description: expense.description,
          propertyId: expense.property_id,
          reservationId: expense.reservation_id,
          ownerId: expense.owner_id,
          amount: expense.amount,
          expenseDate: expense.expense_date,
          vendorName: expense.vendor_name ?? '',
          paymentMethod: expense.payment_method,
          notes: expense.notes ?? '',
          status: expense.status,
          receiptPath: expense.receipt_url,
        }}
        onClose={() => setShowEdit(false)}
        onSubmit={handleUpdate}
        submitting={updateExpense.isPending}
      />
    </Screen>
  );
}

function InfoRow({ label, value, border, bold }: { label: string; value: string; border?: boolean; bold?: boolean }) {
  return (
    <View style={[styles.infoRow, border && styles.infoRowBorder]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={bold ? styles.infoValueBold : styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 22,
    paddingTop: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  description: {
    flex: 1,
    ...robotoText(700, 19, { color: AmkouyColors.primary }),
  },
  infoCard: {
    paddingHorizontal: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  infoRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: AmkouyColors.hairline,
  },
  infoLabel: {
    ...robotoText(400, 13, { color: AmkouyColors.textMuted }),
  },
  infoValue: {
    ...robotoText(600, 13, { color: AmkouyColors.text }),
  },
  infoValueBold: {
    ...robotoText(900, 15, { color: AmkouyColors.secondary }),
  },
  sectionTitle: {
    ...robotoText(700, 15, { color: AmkouyColors.primary, marginTop: 22, marginBottom: 10 }),
  },
  notesCard: {
    backgroundColor: '#FFFBEC',
    borderWidth: 1,
    borderColor: '#F3E6BE',
    borderRadius: 14,
    padding: 13,
    paddingHorizontal: 15,
  },
  notesText: {
    ...robotoText(400, 12.5, { color: '#6a5a22', lineHeight: 19 }),
  },
  receiptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  receiptText: {
    ...robotoText(600, 14, { color: AmkouyColors.text }),
  },
  emptyText: {
    ...robotoText(400, 13, { color: AmkouyColors.textFaint }),
  },
  archiveButton: {
    marginTop: 28,
    height: 50,
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: AmkouyColors.error,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  archiveButtonText: {
    ...robotoText(600, 13, { color: AmkouyColors.error }),
  },
  stickyFooter: {
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 20,
    shadowColor: AmkouyColors.primary,
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -3 },
  },
  editButton: {
    height: 48,
    borderRadius: 16,
    backgroundColor: AmkouyColors.secondaryContainer,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  editButtonText: {
    ...robotoText(700, 14, { color: AmkouyColors.primary }),
  },
});
