import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as expensesApi from '@/lib/queries/expenses';

const KEY = ['expenses'] as const;

export function useExpenses() {
  return useQuery({ queryKey: KEY, queryFn: expensesApi.listExpenses });
}

export function useExpense(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => expensesApi.getExpense(id as string),
    enabled: !!id,
  });
}

export function useExpenseCategoryBreakdown(range: { start: Date; end: Date }) {
  return useQuery({
    queryKey: ['expense-category-breakdown', range.start.toISOString(), range.end.toISOString()],
    queryFn: () => expensesApi.getExpenseCategoryBreakdown(range),
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: expensesApi.ExpenseFormInput) => expensesApi.createExpense(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: expensesApi.ExpenseFormInput }) =>
      expensesApi.updateExpense(id, input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: KEY });
      queryClient.invalidateQueries({ queryKey: [...KEY, variables.id] });
      queryClient.invalidateQueries({ queryKey: ['activity-log', 'expense', variables.id] });
    },
  });
}

export function useArchiveExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => expensesApi.archiveExpense(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
