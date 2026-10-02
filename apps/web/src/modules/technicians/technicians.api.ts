import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { resetDashboardCache } from '../dashboard/DashboardPage';
import type {
  TechnicianQueryFilter,
  CreateTechnicianInput,
  UpdateTechnicianInput,
} from '@crm/validation';

export interface TechnicianRecentJob {
  id: string;
  jobCardNumber: string;
  status: string;
  problemReported: string | null;
  workPerformed: string | null;
  createdAt: string;
  completedAt: string | null;
  serviceNumber: string;
  serviceType: string;
  customerName: string;
  customerPhone: string;
  productName: string;
}

export interface TechnicianItem {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  status: 'ACTIVE' | 'ON_LEAVE' | 'INACTIVE';
  portalEnabled?: boolean;
  skills: string[] | null;
  address: string | null;
  emergencyContact: string | null;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
  activeJobsCount: number;
  completedJobsCount: number;
}

export interface TechnicianDetail extends TechnicianItem {
  recentJobs?: TechnicianRecentJob[];
}

export interface TechnicianKPIs {
  totalTechnicians: number;
  activeTechnicians: number;
  onLeave: number;
  inactiveTechnicians: number;
}

export interface PaginatedTechniciansResponse {
  data: TechnicianItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Hook to query paginated technicians
 */
export function useTechniciansQuery(filters: Partial<TechnicianQueryFilter>) {
  return useQuery({
    queryKey: ['technicians', filters],
    queryFn: async () => {
      const response = await apiClient.get<PaginatedTechniciansResponse>('/technicians', {
        params: filters,
      });
      return (response as any)?.data?.data ? (response as any).data : response;
    },
    staleTime: 30_000,
  });
}

/**
 * Hook to query single technician with job history
 */
export function useTechnicianDetailQuery(id: string | undefined) {
  return useQuery({
    queryKey: ['technician', id],
    queryFn: async () => {
      if (!id) return null;
      const response = await apiClient.get<TechnicianDetail>(`/technicians/${id}`);
      return (response as any)?.data?.data ?? response?.data ?? response;
    },
    enabled: Boolean(id),
  });
}

/**
 * Hook to query technician workforce KPIs
 */
export function useTechnicianKPIsQuery() {
  return useQuery({
    queryKey: ['technicians', 'kpis'],
    queryFn: async () => {
      const response = await apiClient.get<TechnicianKPIs>('/technicians/kpis');
      return (response as any)?.data?.data ?? response?.data ?? response;
    },
    staleTime: 60_000,
  });
}

/**
 * Helper to synchronize technician counts across Technician roster and Dashboard
 */
function notifyTechnicianChanged(queryClient: ReturnType<typeof useQueryClient>) {
  resetDashboardCache();
  try {
    localStorage.setItem('crm_dashboard_refresh_tick', String(Date.now()));
  } catch {}
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('crm_dashboard_refresh'));
  }
  queryClient.invalidateQueries({ queryKey: ['technicians'] });
  queryClient.invalidateQueries({ queryKey: ['services', 'technicians'] });
  queryClient.refetchQueries({ queryKey: ['technicians', 'kpis'] });
}

/**
 * Mutation to create a technician
 */
export function useCreateTechnicianMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTechnicianInput) => {
      const response = await apiClient.post<{ success: boolean; data: any }>('/technicians', input);
      return response.data;
    },
    onSuccess: () => {
      notifyTechnicianChanged(queryClient);
    },
  });
}

/**
 * Mutation to update technician profile / status
 */
export function useUpdateTechnicianMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateTechnicianInput }) => {
      const response = await apiClient.patch<{ success: boolean; data: any }>(`/technicians/${id}`, data);
      return response.data;
    },
    onSuccess: (_, variables) => {
      notifyTechnicianChanged(queryClient);
      queryClient.invalidateQueries({ queryKey: ['technician', variables.id] });
    },
  });
}

/**
 * Mutation to delete a technician
 */
export function useDeleteTechnicianMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete<{ success: boolean; data: any; message?: string }>(`/technicians/${id}`);
      return response.data;
    },
    onSuccess: () => {
      notifyTechnicianChanged(queryClient);
    },
  });
}

/**
 * Mutation to toggle technician portal access
 */
export function useTogglePortalAccessMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, portalEnabled }: { id: string; portalEnabled: boolean }) => {
      const response = await apiClient.patch<{ success: boolean; data: any; message?: string }>(
        `/technicians/${id}/portal-access`,
        { portalEnabled }
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      notifyTechnicianChanged(queryClient);
      queryClient.invalidateQueries({ queryKey: ['technicians'] });
      queryClient.invalidateQueries({ queryKey: ['technician', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['technician-360', variables.id] });
    },
  });
}

export type {
  TechnicianAdmin360Profile,
  TechnicianAdminServiceItem,
  TechnicianAdminJobCardItem,
  TechnicianAdminCustomerItem,
  TechnicianAdminAssetItem,
  TechnicianAdminPartItem,
  TechnicianAdminPaymentItem,
} from '@crm/types';

import type { TechnicianAdmin360Profile } from '@crm/types';

/**
 * Hook to query comprehensive Admin-side 360° Technician Profile
 */
export function useTechnician360Query(id: string | undefined) {
  return useQuery({
    queryKey: ['technician-360', id],
    queryFn: async () => {
      if (!id) return null;
      const response = await apiClient.get<TechnicianAdmin360Profile>(`/technicians/${id}/360`);
      return (response as any)?.data?.data ?? response?.data ?? response;
    },
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}
