// React Query hooks over src/lib/api.ts. Query keys are arrays whose first element matches realtime.ts.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, itemsOf } from '@/lib/api';
import type {
  AllocationStatus,
  AppConfig,
  DeclineReasonCode,
  DisputeReason,
  DonationCreateInput,
  DonationStatus,
  DonorProfileInput,
  FeedbackInput,
  OfferStatus,
  ReceiverProfileInput,
  ReportStatus,
} from '@/types';

// ---------- public ----------
export const useHealth = () =>
  useQuery({ queryKey: ['health'], queryFn: api.health, retry: false, refetchInterval: 30_000 });

export const usePublicImpact = () =>
  useQuery({ queryKey: ['impact', 'public'], queryFn: api.publicImpact, refetchInterval: 60_000 });

export const useMyImpact = () => useQuery({ queryKey: ['impact', 'me'], queryFn: api.myImpact });

// ---------- donor ----------
export const useDonations = (params: { status?: DonationStatus | string; page?: number } = {}) =>
  useQuery({ queryKey: ['donations', params], queryFn: () => api.donations(params) });

export const useDonation = (id: string | undefined) =>
  useQuery({
    queryKey: ['donation', id],
    queryFn: () => api.donation(id as string),
    enabled: Boolean(id),
  });

export function useCreateDonation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: DonationCreateInput) => api.createDonation(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['donations'] }),
  });
}

export function useCancelDonation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) => api.cancelDonation(id, reason),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['donation', id] });
      void qc.invalidateQueries({ queryKey: ['donations'] });
    },
  });
}

export function useHandover(donationId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ allocationId, code }: { allocationId: string; code: string }) =>
      api.handover(allocationId, code),
    onSettled: () => {
      if (donationId) void qc.invalidateQueries({ queryKey: ['donation', donationId] });
      void qc.invalidateQueries({ queryKey: ['allocation'] });
      void qc.invalidateQueries({ queryKey: ['impact'] });
    },
  });
}

export const useDonorProfile = () =>
  useQuery({ queryKey: ['profile', 'donor'], queryFn: api.donorProfile });

export function useUpdateDonorProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<DonorProfileInput>) => api.updateDonorProfile(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['profile'] });
      void qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

// ---------- receiver ----------
export const useReceiverProfile = () =>
  useQuery({ queryKey: ['profile', 'receiver'], queryFn: api.receiverProfile });

export function useUpdateReceiverProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<ReceiverProfileInput>) => api.updateReceiverProfile(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['profile'] });
      void qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

export function useSetAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: boolean) => api.setAvailability(v),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['profile'] });
      void qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

export function useSetNeeds() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: number) => api.setNeeds(v),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['profile'] });
      void qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

export const useOffers = (params: { status?: OfferStatus; page?: number } = {}) =>
  useQuery({ queryKey: ['offers', params], queryFn: () => api.offers(params) });

export const useOffer = (id: string | undefined) =>
  useQuery({
    queryKey: ['offer', id],
    queryFn: () => api.offer(id as string),
    enabled: Boolean(id),
  });

export function useAcceptOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.acceptOffer(id),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['offers'] });
      void qc.invalidateQueries({ queryKey: ['offer'] });
      void qc.invalidateQueries({ queryKey: ['allocations'] });
    },
  });
}

export function useDeclineOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason, note }: { id: string; reason: DeclineReasonCode; note?: string }) =>
      api.declineOffer(id, reason, note),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['offers'] });
      void qc.invalidateQueries({ queryKey: ['offer'] });
    },
  });
}

export const useAllocations = (
  params: { status?: AllocationStatus | string; page?: number } = {},
) => useQuery({ queryKey: ['allocations', params], queryFn: () => api.allocations(params) });

export const useAllocation = (id: string | undefined) =>
  useQuery({
    queryKey: ['allocation', id],
    queryFn: () => api.allocation(id as string),
    enabled: Boolean(id),
  });

export function useCancelAllocation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) => api.cancelAllocation(id, reason),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['allocation', id] });
      void qc.invalidateQueries({ queryKey: ['allocations'] });
    },
  });
}

export function useCompleteAllocation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { servings_distributed: number; distribution_area: string }) =>
      api.completeAllocation(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['allocation', id] });
      void qc.invalidateQueries({ queryKey: ['allocations'] });
      void qc.invalidateQueries({ queryKey: ['impact'] });
    },
  });
}

// ---------- shared ----------
export const useMessages = (allocationId: string | undefined) =>
  useQuery({
    queryKey: ['messages', allocationId],
    queryFn: () => api.messages(allocationId as string),
    enabled: Boolean(allocationId),
  });

export function useSendMessage(allocationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => api.sendMessage(allocationId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['messages', allocationId] }),
  });
}

export const useFeedback = (allocationId: string | undefined) =>
  useQuery({
    queryKey: ['feedback', allocationId],
    queryFn: () => api.feedback(allocationId as string),
    enabled: Boolean(allocationId),
  });

export function useSubmitFeedback(allocationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: FeedbackInput) => api.submitFeedback(allocationId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['feedback', allocationId] });
      void qc.invalidateQueries({ queryKey: ['allocation', allocationId] });
    },
  });
}

export function useRaiseDispute() {
  return useMutation({
    mutationFn: ({
      allocationId,
      reason,
      description,
    }: {
      allocationId: string;
      reason: DisputeReason;
      description: string;
    }) => api.dispute(allocationId, reason, description),
  });
}

export const useNotifications = (params: { unread?: boolean; page?: number } = {}) =>
  useQuery({ queryKey: ['notifications', params], queryFn: () => api.notifications(params) });

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { ids: string[] } | { all: true }) => api.markNotificationsRead(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { full_name?: string; phone?: string }) => api.updateMe(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  });
}

// ---------- admin ----------
export const useAdminOverview = () =>
  useQuery({ queryKey: ['admin', 'overview'], queryFn: api.adminOverview });

export const useAdminVerifications = () =>
  useQuery({
    queryKey: ['admin', 'verifications'],
    queryFn: async () => itemsOf(await api.adminVerifications()),
  });

export const useAdminFlags = () =>
  useQuery({ queryKey: ['admin', 'flags'], queryFn: async () => itemsOf(await api.adminFlags()) });

export const useAdminDonation = (id: string | undefined) =>
  useQuery({
    queryKey: ['admin', 'donation', id],
    queryFn: () => api.adminDonation(id as string),
    enabled: Boolean(id),
  });

export const useAdminSafety = () =>
  useQuery({
    queryKey: ['admin', 'safety'],
    queryFn: async () => itemsOf(await api.adminSafetyReports()),
  });

export const useAdminDisputes = () =>
  useQuery({
    queryKey: ['admin', 'disputes'],
    queryFn: async () => itemsOf(await api.adminDisputes()),
  });

export const useAdminLive = () =>
  useQuery({ queryKey: ['admin', 'live'], queryFn: api.adminLive, refetchInterval: 15_000 });

export const useAdminAnalytics = (params: { from?: string; to?: string }) =>
  useQuery({ queryKey: ['admin', 'analytics', params], queryFn: () => api.adminAnalytics(params) });

export const useAdminAudit = (params: { entity_id?: string; page?: number }) =>
  useQuery({
    queryKey: ['admin', 'audit', params],
    queryFn: () => api.adminAuditLog(params),
  });

export const useAdminConfig = () =>
  useQuery({
    queryKey: ['admin', 'config'],
    queryFn: api.adminConfig,
    refetchOnWindowFocus: false,
  });

export function useAdminMutation<TVars, TResult>(fn: (v: TVars) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['admin'] });
    },
  });
}

export function useUpdateConfig() {
  return useAdminMutation((body: Partial<AppConfig>) => api.adminUpdateConfig(body));
}

export function useResolveSafety() {
  return useAdminMutation(
    (v: { id: string; status: Exclude<ReportStatus, 'open'>; admin_notes: string }) =>
      api.adminResolveSafety(v.id, { status: v.status, admin_notes: v.admin_notes }),
  );
}
