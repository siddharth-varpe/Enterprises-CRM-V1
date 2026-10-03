import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import type {
  Inquiry,
  InquiryKPIs,
  InquiryQueryFilters,
  ConvertInquiryResult,
} from '@crm/types';
import type {
  CreateInquiryInput,
  UpdateInquiryInput,
  AssignInquiryInput,
  UpdateInquiryStatusInput,
  InquiryFollowUpInput,
  ConvertInquiryInput,
} from '@crm/validation';

const FALLBACK_INQUIRIES: Inquiry[] = [];

const FALLBACK_INQUIRY_KPIS: InquiryKPIs = {
  totalInquiries: 0,
  newInquiries: 0,
  followUpDue: 0,
  qualifiedLeads: 0,
  convertedCount: 0,
  conversionRate: 0,
  spamCount: 0,
};

export function useInquiryKPIs() {
  return useQuery({
    queryKey: ['inquiries', 'kpis'],
    queryFn: async () => {
      try {
        const response = await apiClient.get<InquiryKPIs>('/inquiries/kpis');
        return (response as any)?.data?.data ?? response?.data ?? response;
      } catch {
        return FALLBACK_INQUIRY_KPIS;
      }
    },
  });
}

export function useInquiries(filters: Partial<InquiryQueryFilters> = {}) {
  return useQuery({
    queryKey: ['inquiries', 'list', filters],
    queryFn: async () => {
      try {
        const response = await apiClient.get<any>('/inquiries', { params: filters as any });
        return (response as any)?.data?.data ? (response as any).data : response;
      } catch {
        let filtered = [...FALLBACK_INQUIRIES];
        if (filters.status) filtered = filtered.filter((i) => i.status === filters.status);
        if (filters.inquiryType) filtered = filtered.filter((i) => i.inquiryType === filters.inquiryType);
        if (filters.priority) filtered = filtered.filter((i) => i.priority === filters.priority);
        if (filters.search) {
          const s = filters.search.toLowerCase();
          filtered = filtered.filter(
            (i) =>
              i.name.toLowerCase().includes(s) ||
              i.phone.includes(s) ||
              i.inquiryNumber.toLowerCase().includes(s)
          );
        }
        return {
          data: filtered,
          pagination: { page: 1, limit: 10, total: filtered.length, totalPages: 1 },
        };
      }
    },
  });
}

export function useInquiry(id?: string) {
  return useQuery({
    queryKey: ['inquiries', 'detail', id],
    queryFn: async () => {
      if (!id) throw new Error('Inquiry ID required');
      try {
        const response = await apiClient.get<Inquiry>(`/inquiries/${id}`);
        return (response as any)?.data?.data ?? response?.data ?? response;
      } catch {
        const found = FALLBACK_INQUIRIES.find((i) => i.id === id) || null;
        return found;
      }
    },
    enabled: Boolean(id),
  });
}

export function useCreateInquiry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateInquiryInput) => {
      const response = await apiClient.post<{ success: boolean; data: Inquiry }>('/inquiries', payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inquiries'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateInquiry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateInquiryInput }) => {
      const response = await apiClient.patch<{ success: boolean; data: Inquiry }>(`/inquiries/${id}`, payload);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inquiries'] });
      queryClient.invalidateQueries({ queryKey: ['inquiries', 'detail', variables.id] });
    },
  });
}

export function useAssignInquiry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: AssignInquiryInput }) => {
      const response = await apiClient.post<{ success: boolean; data: Inquiry }>(`/inquiries/${id}/assign`, payload);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inquiries'] });
      queryClient.invalidateQueries({ queryKey: ['inquiries', 'detail', variables.id] });
    },
  });
}

export function useUpdateInquiryStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateInquiryStatusInput }) => {
      const response = await apiClient.post<{ success: boolean; data: Inquiry }>(`/inquiries/${id}/status`, payload);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inquiries'] });
      queryClient.invalidateQueries({ queryKey: ['inquiries', 'detail', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['inquiries', 'kpis'] });
    },
  });
}

export function useAddInquiryFollowUp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: InquiryFollowUpInput }) => {
      const response = await apiClient.post<{ success: boolean; data: Inquiry }>(`/inquiries/${id}/follow-up`, payload);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inquiries'] });
      queryClient.invalidateQueries({ queryKey: ['inquiries', 'detail', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
    },
  });
}

export function useConvertInquiry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: ConvertInquiryInput }) => {
      const response = await apiClient.post<{ success: boolean; data: ConvertInquiryResult }>(
        `/inquiries/${id}/convert`,
        payload
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inquiries'] });
      queryClient.invalidateQueries({ queryKey: ['inquiries', 'detail', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      queryClient.invalidateQueries({ queryKey: ['warranties'] });
      queryClient.invalidateQueries({ queryKey: ['job-cards'] });
      queryClient.invalidateQueries({ queryKey: ['search'] });
      queryClient.invalidateQueries({ queryKey: ['global-search'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useCloseInquiry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      const response = await apiClient.post<{ success: boolean; data: Inquiry }>(`/inquiries/${id}/close`, { notes });
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inquiries'] });
      queryClient.invalidateQueries({ queryKey: ['inquiries', 'detail', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['inquiries', 'kpis'] });
    },
  });
}

export function useMarkInquirySpam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      const response = await apiClient.post<{ success: boolean; data: Inquiry }>(`/inquiries/${id}/spam`, { notes });
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inquiries'] });
      queryClient.invalidateQueries({ queryKey: ['inquiries', 'detail', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['inquiries', 'kpis'] });
    },
  });
}
