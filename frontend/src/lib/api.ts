// Typed API client — ARCHITECTURE §2 ("All API calls through a typed client in src/lib/api.ts"), §10, §17.
import { API_BASE_URL, HEALTH_URL } from './env';
import type {
  AdminDonationDetail,
  AdminOverview,
  Allocation,
  AllocationStatus,
  Analytics,
  AppConfig,
  AssistantResponse,
  AuditRow,
  DeclineReasonCode,
  DisputeReason,
  Dispute,
  Donation,
  DonationCreateInput,
  DonationDetail,
  DonationStatus,
  DonorProfile,
  DonorProfileInput,
  Feedback,
  FeedbackInput,
  FeedbackVisibility,
  LiveData,
  MeResponse,
  Message,
  MessagesResponse,
  MyImpact,
  NotificationsPage,
  NearbyDonation,
  Offer,
  OfferStatus,
  OnboardingInput,
  Paginated,
  PublicImpact,
  ReceiverProfile,
  ReceiverProfileInput,
  ReportStatus,
  SafetyReport,
  UploadBucket,
  UploadSignResponse,
  User,
  VerificationItem,
} from '@/types';

export interface ApiErrorBody {
  error: { code: string; message: string; details?: Record<string, unknown> };
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Human-readable message for any thrown value. Never shows raw codes (WALKTHROUGH §5.1). */
export function errorMessage(
  err: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (err instanceof ApiError) return err.message || fallback;
  if (err instanceof TypeError) return 'Cannot reach FoodResQ right now. Check your connection.';
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

// ---- Auth token plumbing ----
type TokenProvider = () => Promise<string | null> | string | null;
let tokenProvider: TokenProvider = () => null;
let unauthorizedHandler: (() => void) | null = null;

export function setTokenProvider(fn: TokenProvider): void {
  tokenProvider = fn;
}
export function setUnauthorizedHandler(fn: (() => void) | null): void {
  unauthorizedHandler = fn;
}

type Query = Record<string, string | number | boolean | null | undefined>;

function buildUrl(path: string, query?: Query): string {
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Query;
  auth?: boolean;
  raw?: boolean;
}

async function parseError(res: Response): Promise<ApiError> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // non-JSON error
  }
  const e = (body as ApiErrorBody | null)?.error;
  if (e && typeof e.message === 'string') {
    return new ApiError(res.status, e.code ?? 'ERROR', e.message, e.details ?? {});
  }
  // FastAPI default `{detail}` fallback
  const detail = (body as { detail?: unknown } | null)?.detail;
  const message =
    typeof detail === 'string'
      ? detail
      : res.status === 401
        ? 'Please log in again.'
        : res.status === 403
          ? "You don't have access to this."
          : res.status === 404
            ? 'Not found.'
            : res.status === 429
              ? 'Too many requests. Please wait a moment.'
              : 'Something went wrong. Please try again.';
  return new ApiError(res.status, `HTTP_${res.status}`, message, {});
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, auth = true, raw = false } = opts;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = await tokenProvider();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(buildUrl(path, query), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await parseError(res);
    if (res.status === 401 && auth && unauthorizedHandler) unauthorizedHandler();
    throw err;
  }
  if (raw) return res as unknown as T;
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

// ---- Endpoints (ARCHITECTURE §10) ----
export const api = {
  // health (public, backend root)
  health: async (): Promise<{ status: string }> => {
    const res = await fetch(HEALTH_URL, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw await parseError(res);
    return (await res.json()) as { status: string };
  },

  // dev auth — TODO(team): remove before pilot
  devLogin: (email: string) =>
    request<{ access_token: string }>('/dev/login', {
      method: 'POST',
      body: { email },
      auth: false,
    }),

  // 10.1 account
  me: () => request<MeResponse>('/me'),
  onboarding: (body: OnboardingInput) =>
    request<MeResponse>('/onboarding', { method: 'POST', body }),
  updateMe: (body: { full_name?: string; phone?: string }) =>
    request<MeResponse>('/me', { method: 'PATCH', body }),

  // 10.2 donor
  donorProfile: () => request<DonorProfile>('/donor/profile'),
  updateDonorProfile: (body: Partial<DonorProfileInput>) =>
    request<DonorProfile>('/donor/profile', { method: 'PATCH', body }),
  createDonation: (body: DonationCreateInput) =>
    request<Donation>('/donations', { method: 'POST', body }),
  donations: (params: { status?: DonationStatus | string; page?: number } = {}) =>
    request<Paginated<Donation>>('/donations', { query: params }),
  donation: (id: string) => request<DonationDetail>(`/donations/${id}`),
  cancelDonation: (id: string, reason: string) =>
    request<Donation>(`/donations/${id}/cancel`, { method: 'POST', body: { reason } }),
  handover: (allocationId: string, code: string) =>
    request<Allocation>(`/allocations/${allocationId}/handover`, {
      method: 'POST',
      body: { code },
    }),
  donationRecordCsv: (id: string) =>
    request<Response>(`/donations/${id}/record.csv`, { raw: true }),
  myImpact: () => request<MyImpact>('/impact/me'),

  // 10.3 receiver
  receiverProfile: () => request<ReceiverProfile>('/receiver/profile'),
  updateReceiverProfile: (body: Partial<ReceiverProfileInput>) =>
    request<ReceiverProfile>('/receiver/profile', { method: 'PATCH', body }),
  setAvailability: (is_available_now: boolean) =>
    request<ReceiverProfile>('/receiver/availability', {
      method: 'PATCH',
      body: { is_available_now },
    }),
  setNeeds: (meals_needed_today: number) =>
    request<ReceiverProfile>('/receiver/needs', { method: 'PATCH', body: { meals_needed_today } }),
  offers: (params: { status?: OfferStatus; page?: number } = {}) =>
    request<Paginated<Offer>>('/offers', { query: params }),
  nearbyDonations: () => request<{ items: NearbyDonation[] }>('/receiver/nearby-donations'),
  offer: (id: string) => request<Offer>(`/offers/${id}`),
  acceptOffer: (id: string) => request<Allocation>(`/offers/${id}/accept`, { method: 'POST' }),
  declineOffer: (id: string, reason_code: DeclineReasonCode, note?: string) =>
    request<Offer>(`/offers/${id}/decline`, {
      method: 'POST',
      body: { reason_code, ...(note ? { note } : {}) },
    }),
  allocations: (params: { status?: AllocationStatus | string; page?: number } = {}) =>
    request<Paginated<Allocation>>('/allocations', { query: params }),
  cancelAllocation: (id: string, reason: string) =>
    request<Allocation>(`/allocations/${id}/cancel`, { method: 'POST', body: { reason } }),
  completeAllocation: (
    id: string,
    body: { servings_distributed: number; distribution_area: string },
  ) => request<Allocation>(`/allocations/${id}/complete`, { method: 'POST', body }),

  // 10.4 shared
  allocation: (id: string) => request<Allocation>(`/allocations/${id}`),
  messages: (id: string) => request<MessagesResponse>(`/allocations/${id}/messages`),
  sendMessage: (id: string, body: string) =>
    request<Message>(`/allocations/${id}/messages`, { method: 'POST', body: { body } }),
  submitFeedback: (id: string, body: FeedbackInput) =>
    request<Feedback>(`/allocations/${id}/feedback`, { method: 'POST', body }),
  feedback: (id: string) => request<FeedbackVisibility>(`/allocations/${id}/feedback`),
  dispute: (id: string, reason: DisputeReason, description: string) =>
    request<Dispute>(`/allocations/${id}/dispute`, {
      method: 'POST',
      body: { reason, description },
    }),
  notifications: (params: { unread?: boolean; page?: number } = {}) =>
    request<NotificationsPage>('/notifications', { query: params }),
  markNotificationsRead: (body: { ids: string[] } | { all: true }) =>
    request<{ updated: number }>('/notifications/read', { method: 'POST', body }),
  /** `allocation_id` scopes feedback photos to `{allocation_id}/…` (ARCHITECTURE §4.5). */
  signUpload: (bucket: UploadBucket, content_type: string, allocation_id?: string) =>
    request<UploadSignResponse>('/uploads/sign', {
      method: 'POST',
      body: { bucket, content_type, ...(allocation_id ? { allocation_id } : {}) },
    }),
  publicImpact: () => request<PublicImpact>('/impact/public', { auth: false }),

  // 10.5 admin
  adminOverview: () => request<AdminOverview>('/admin/overview'),
  adminVerifications: () => request<{ items: VerificationItem[] }>('/admin/verifications'),
  adminVerify: (userId: string) =>
    request<User>(`/admin/users/${userId}/verify`, { method: 'POST' }),
  adminReject: (userId: string, reason: string) =>
    request<User>(`/admin/users/${userId}/reject`, { method: 'POST', body: { reason } }),
  adminSuspend: (userId: string, reason: string) =>
    request<User>(`/admin/users/${userId}/suspend`, { method: 'POST', body: { reason } }),
  adminReinstate: (userId: string, reason: string) =>
    request<User>(`/admin/users/${userId}/reinstate`, { method: 'POST', body: { reason } }),
  adminBadgeDonor: (userId: string) =>
    request<DonorProfile>(`/admin/donors/${userId}/badge`, { method: 'POST' }),
  adminFlags: () => request<{ items: Donation[] }>('/admin/flags'),
  adminApprove: (id: string) =>
    request<Donation>(`/admin/donations/${id}/approve`, { method: 'POST' }),
  adminRejectDonation: (id: string, reason: string) =>
    request<Donation>(`/admin/donations/${id}/reject`, { method: 'POST', body: { reason } }),
  adminAssign: (id: string, body: { receiver_id: string; servings: number; note: string }) =>
    request<Allocation>(`/admin/donations/${id}/assign`, { method: 'POST', body }),
  adminDonation: (id: string) => request<AdminDonationDetail>(`/admin/donations/${id}`),
  adminOverrideCollect: (allocationId: string, reason: string) =>
    request<Allocation>(`/admin/allocations/${allocationId}/override-collect`, {
      method: 'POST',
      body: { reason },
    }),
  adminSafetyReports: () => request<{ items: SafetyReport[] }>('/admin/safety-reports'),
  adminResolveSafety: (
    id: string,
    body: { status: Exclude<ReportStatus, 'open'>; admin_notes: string },
  ) => request<SafetyReport>(`/admin/safety-reports/${id}/resolve`, { method: 'POST', body }),
  adminDisputes: () => request<{ items: Dispute[] }>('/admin/disputes'),
  adminResolveDispute: (id: string, resolution: string) =>
    request<Dispute>(`/admin/disputes/${id}/resolve`, { method: 'POST', body: { resolution } }),
  adminLive: () => request<LiveData>('/admin/live'),
  adminAnalytics: (params: { from?: string; to?: string }) =>
    request<Analytics>('/admin/analytics', { query: params }),
  adminAuditLog: (params: { entity_id?: string; page?: number } = {}) =>
    request<Paginated<AuditRow>>('/admin/audit-log', { query: params }),
  adminConfig: () => request<AppConfig>('/admin/config'),
  adminUpdateConfig: (body: Partial<AppConfig>) =>
    request<AppConfig>('/admin/config', { method: 'PUT', body }),
  /** `user_id` = the new Admin's existing Supabase Auth user id (backend creates the `users` row). */
  adminCreateAdmin: (body: { user_id: string; email: string; full_name: string; phone: string }) =>
    request<User>('/admin/admins', { method: 'POST', body }),

  // 10.6 assistant
  assistantChat: (body: { conversation_id?: string | null; message: string }) =>
    request<AssistantResponse>('/assistant/chat', { method: 'POST', body }),
};

/** Accept either a paginated envelope or a bare array (defensive while backend settles). */
export function itemsOf<T>(data: Paginated<T> | T[] | { items: T[] } | undefined | null): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.items ?? [];
}

/** Signed-URL upload flow (ARCHITECTURE §4.5). Returns the storage path. */
export async function uploadFile(
  bucket: UploadBucket,
  file: File,
  allocationId?: string,
): Promise<string> {
  const allowed =
    bucket === 'verification-docs'
      ? ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
      : ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) {
    throw new ApiError(422, 'UNSUPPORTED_TYPE', 'This file type is not allowed.');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new ApiError(422, 'FILE_TOO_LARGE', 'Files must be 5 MB or smaller.');
  }
  const signed = await api.signUpload(bucket, file.type, allocationId);
  const res = await fetch(signed.signed_url, {
    method: 'PUT',
    headers: { 'Content-Type': file.type, 'x-upsert': 'false' },
    body: file,
  });
  if (!res.ok) throw new ApiError(res.status, 'UPLOAD_FAILED', 'Upload failed. Please try again.');
  return signed.path;
}

/** Download the FSSAI record CSV with auth (cannot use a plain link because of the Bearer header). */
export async function downloadRecordCsv(donationId: string): Promise<void> {
  const res = await api.donationRecordCsv(donationId);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `foodresq-record-${donationId.slice(0, 8)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
