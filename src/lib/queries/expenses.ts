import { logActivity } from '@/lib/queries/activity-log';
import { supabase } from '@/lib/supabase';
import { Database } from '@/types/supabase';
import { logAppError } from '@/utils/errors';

export type ExpenseRow = Database['public']['Tables']['expenses']['Row'];
export type ExpenseInsert = Database['public']['Tables']['expenses']['Insert'];
export type ExpenseUpdate = Database['public']['Tables']['expenses']['Update'];
export type ExpenseCategory = Database['public']['Enums']['expense_category'];
export type ExpenseStatus = Database['public']['Enums']['expense_status'];

export type ExpenseWithRelations = ExpenseRow & {
  property: { id: string; name: string } | null;
  owner: { id: string; full_name: string } | null;
};

const EXPENSE_SELECT = '*, property:properties(id, name), owner:owners(id, full_name)';

export async function listExpenses(): Promise<ExpenseWithRelations[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select(EXPENSE_SELECT)
    .is('deleted_at', null)
    .order('expense_date', { ascending: false });
  if (error) {
    logAppError('expenses.listExpenses', error);
    throw error;
  }
  return (data ?? []) as unknown as ExpenseWithRelations[];
}

export async function getExpense(id: string): Promise<ExpenseWithRelations | null> {
  const { data, error } = await supabase
    .from('expenses')
    .select(EXPENSE_SELECT)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) {
    logAppError('expenses.getExpense', error);
    throw error;
  }
  return data as unknown as ExpenseWithRelations | null;
}

export type ExpenseFormInput = {
  category: ExpenseCategory;
  description: string;
  propertyId: string | null;
  reservationId: string | null;
  ownerId: string | null;
  amount: number;
  expenseDate: string; // 'YYYY-MM-DD'
  vendorName?: string;
  paymentMethod: Database['public']['Enums']['payment_method_type'] | null;
  receiptPath?: string | null;
  notes?: string;
  status: ExpenseStatus;
  relatedMaintenanceTicketId?: string | null;
};

function toPayload(input: ExpenseFormInput): Omit<ExpenseInsert, 'expense_number'> {
  return {
    category: input.category,
    description: input.description,
    property_id: input.propertyId,
    reservation_id: input.reservationId,
    owner_id: input.ownerId,
    amount: input.amount,
    expense_date: input.expenseDate,
    vendor_name: input.vendorName || null,
    payment_method: input.paymentMethod,
    receipt_url: input.receiptPath || null,
    notes: input.notes || null,
    status: input.status,
    related_maintenance_ticket_id: input.relatedMaintenanceTicketId ?? null,
  };
}

export async function createExpense(input: ExpenseFormInput): Promise<ExpenseRow> {
  const { data, error } = await supabase.from('expenses').insert(toPayload(input)).select().single();
  if (error) {
    logAppError('expenses.createExpense', error);
    throw error;
  }
  await logActivity({
    entityType: 'expense',
    entityId: data.id,
    action: 'expense.created',
    changes: { category: input.category, amount: input.amount, status: input.status },
  });
  return data;
}

export async function updateExpense(id: string, input: ExpenseFormInput): Promise<ExpenseRow> {
  const { data, error } = await supabase
    .from('expenses')
    .update(toPayload(input))
    .eq('id', id)
    .select()
    .single();
  if (error) {
    logAppError('expenses.updateExpense', error);
    throw error;
  }
  await logActivity({
    entityType: 'expense',
    entityId: data.id,
    action: 'expense.updated',
    changes: { status: input.status },
  });
  return data;
}

/** Archive: soft delete, never a real DELETE (see DATABASE_SCHEMA.md §7). */
export async function archiveExpense(id: string): Promise<void> {
  const { error } = await supabase
    .from('expenses')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    logAppError('expenses.archiveExpense', error);
    throw error;
  }
  await logActivity({ entityType: 'expense', entityId: id, action: 'expense.archived' });
}

/** Category totals for the "Répartition des dépenses" breakdown, over an arbitrary date range. */
export async function getExpenseCategoryBreakdown(
  range: { start: Date; end: Date }
): Promise<{ category: ExpenseCategory; total: number }[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('category, amount')
    .is('deleted_at', null)
    .gte('expense_date', range.start.toISOString().slice(0, 10))
    .lte('expense_date', range.end.toISOString().slice(0, 10));
  if (error) {
    logAppError('expenses.getExpenseCategoryBreakdown', error);
    throw error;
  }
  const totals = new Map<ExpenseCategory, number>();
  for (const row of data ?? []) {
    totals.set(row.category, (totals.get(row.category) ?? 0) + row.amount);
  }
  return Array.from(totals, ([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);
}
