// Hand-written from ARCHITECTURE.md §4 (columns) and §10 (API). snake_case, exactly as the backend sends.
// Timestamps are ISO 8601 UTC strings with "Z".

export type UUID = string;
export type ISODateTime = string;
export type ISODate = string;

// ---- Enums (ARCHITECTURE §4.1) ----
export type UserRole = 'donor' | 'receiver' | 'admin';
export type AccountStatus = 'active' | 'pending_verification' | 'rejected' | 'suspended';
export type DonorType =
  'restaurant' | 'hotel' | 'college_hostel' | 'caterer_event' | 'other_business';
export type ReceiverType = 'ngo' | 'shelter' | 'community_org' | 'food_distributor';
export type FoodCategory =
  'cooked_meal' | 'bakery' | 'sweets' | 'dairy' | 'raw_produce' | 'packaged';
export type DietType = 'veg' | 'egg' | 'non_veg';
export type DietAcceptance = 'veg_only' | 'veg_egg' | 'all';
export type StorageCondition = 'hot_held' | 'room_temp' | 'refrigerated' | 'packaged_sealed';
export type DonationStatus =
  | 'POSTED'
  | 'MATCHED'
  | 'ACCEPTED'
  | 'COLLECTED'
  | 'COMPLETED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'FLAGGED';
export type PriorityLevel = 'HIGH' | 'MEDIUM' | 'LOW';
export type OfferStatus =
  'PENDING' | 'ACCEPTED' | 'DECLINED' | 'TIMED_OUT' | 'SUPERSEDED' | 'WITHDRAWN';
export type AllocationStatus = 'ACCEPTED' | 'COLLECTED' | 'COMPLETED' | 'NO_SHOW' | 'CANCELLED';
export type FeedbackDirection = 'donor_to_receiver' | 'receiver_to_donor';
export type ReportStatus = 'open' | 'resolved_valid' | 'resolved_invalid';
export type DisputeReason =
  'no_show' | 'quantity_mismatch' | 'quality_issue' | 'behaviour' | 'other';
export type DisputeStatus = 'open' | 'resolved';

/** §7.10 decline reason codes */
export type DeclineReasonCode =
  'no_capacity' | 'too_far' | 'no_vehicle_now' | 'food_type' | 'other';

/** §6.3 auto-flag codes */
export type FlagReason =
  | 'missing_photo'
  | 'large_quantity'
  | 'unverified_large_donor'
  | 'open_safety_report'
  | 'low_quality_donor';

/** §7.3 hard filter exclusion codes */
export type ExclusionCode =
  | 'not_verified'
  | 'unavailable'
  | 'closed_at_arrival'
  | 'diet_mismatch'
  | 'category_not_accepted'
  | 'out_of_radius'
  | 'cannot_arrive_in_time'
  | 'no_capacity'
  | 'already_offered';

/** §8.1 notification types */
export type NotificationType =
  | 'VERIFICATION_RESULT'
  | 'DONATION_FLAGGED'
  | 'DONATION_APPROVED'
  | 'DONATION_REJECTED'
  | 'OFFER_RECEIVED'
  | 'OFFER_SUPERSEDED'
  | 'OFFER_TIMED_OUT'
  | 'OFFER_ACCEPTED'
  | 'OFFER_DECLINED'
  | 'NO_MATCH_ALERT'
  | 'PICKUP_REMINDER'
  | 'HANDOVER_LOCKED'
  | 'COLLECTED'
  | 'COMPLETED'
  | 'FEEDBACK_REQUEST'
  | 'ALLOCATION_CANCELLED'
  | 'DONATION_CANCELLED'
  | 'DONATION_EXPIRED'
  | 'NO_SHOW'
  | 'NEW_MESSAGE'
  | 'SAFETY_REPORT'
  | 'DISPUTE_OPENED'
  | 'DISPUTE_RESOLVED';

// ---- JSON shapes (§4.3) ----
export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export interface HoursWindow {
  open: string; // "HH:MM" IST
  close: string; // "HH:MM", may be "24:00"
}
export type OperatingHours = Record<Weekday, HoursWindow | null>;

export interface Checklist {
  hygienic_handling: boolean;
  not_served_from_plates: boolean;
  covered_containers: boolean;
  segregated_from_waste: boolean;
  no_spoilage_signs: boolean;
}

// ---- Common ----
export interface Paginated<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
}

// ---- Users & profiles ----
export interface User {
  id: UUID;
  role: UserRole;
  full_name: string;
  email: string;
  phone: string;
  account_status: AccountStatus;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface DonorProfile {
  user_id: UUID;
  org_name: string;
  donor_type: DonorType;
  fssai_license_no: string | null;
  address: string;
  lat: number;
  lng: number;
  is_verified: boolean;
  quality_score: number;
  created_at: ISODateTime;
}

export interface ReceiverProfile {
  user_id: UUID;
  org_name: string;
  receiver_type: ReceiverType;
  fssai_registration_no: string;
  ngo_darpan_id: string | null;
  address: string;
  lat: number;
  lng: number;
  service_radius_km: number;
  max_capacity_servings: number;
  diet_accepted: DietAcceptance;
  accepted_categories: FoodCategory[];
  has_vehicle: boolean;
  has_storage: boolean;
  has_reheating: boolean;
  operating_hours: OperatingHours;
  is_available_now: boolean;
  meals_needed_today: number | null;
  meals_needed_set_on: ISODate | null;
  reliability_score: number;
  verification_doc_path: string | null;
  verified_at: ISODateTime | null;
  verified_by: UUID | null;
  rejection_reason: string | null;
  created_at: ISODateTime;
}

export type MeResponse =
  | { onboarded: false; email: string | null }
  | { onboarded: true; user: User; profile: DonorProfile | ReceiverProfile | null };

export type DonorProfileInput = Pick<
  DonorProfile,
  'org_name' | 'donor_type' | 'fssai_license_no' | 'address' | 'lat' | 'lng'
>;
export type ReceiverProfileInput = Pick<
  ReceiverProfile,
  | 'org_name'
  | 'receiver_type'
  | 'fssai_registration_no'
  | 'ngo_darpan_id'
  | 'address'
  | 'lat'
  | 'lng'
  | 'service_radius_km'
  | 'max_capacity_servings'
  | 'diet_accepted'
  | 'accepted_categories'
  | 'has_vehicle'
  | 'has_storage'
  | 'has_reheating'
  | 'operating_hours'
  | 'verification_doc_path'
>;

export interface OnboardingInput {
  role: 'donor' | 'receiver';
  full_name: string;
  phone: string;
  profile: DonorProfileInput | ReceiverProfileInput;
}

// ---- Donations ----
export interface Donation {
  id: UUID;
  donor_id: UUID;
  title: string;
  description: string | null;
  food_category: FoodCategory;
  diet_type: DietType;
  quantity_servings: number;
  remaining_servings: number;
  expired_servings: number;
  quantity_kg: number | null;
  allergens: string | null;
  storage_condition: StorageCondition;
  ambient_above_32c: boolean;
  prepared_at: ISODateTime;
  packaged_expiry_date: ISODate | null;
  donor_pickup_by: ISODateTime;
  safe_pickup_deadline: ISODateTime;
  effective_deadline: ISODateTime;
  pickup_address: string;
  pickup_lat: number;
  pickup_lng: number;
  pickup_instructions: string | null;
  contact_phone: string;
  batch_no: string | null;
  temperature_c: number | null;
  checklist: Checklist;
  declaration_accepted: boolean;
  declaration_at: ISODateTime;
  photo_paths: string[];
  status: DonationStatus;
  priority_score: number;
  priority_level: PriorityLevel;
  search_radius_km: number;
  flag_reasons: FlagReason[];
  cancel_reason: string | null;
  no_match_alerted_at: ISODateTime | null;
  posted_at: ISODateTime;
  updated_at: ISODateTime;
  // API extras
  donor_org_name: string;
  last_consumption_at: ISODateTime;
  photo_urls: string[];
  allocated_servings: number;
}

export interface TimelineEntry {
  status: DonationStatus;
  at: ISODateTime;
  reason: string | null;
}

export interface DonationSummary {
  id: UUID;
  title: string;
  food_category: FoodCategory;
  diet_type: DietType;
  priority_level: PriorityLevel;
  status?: DonationStatus;
  quantity_servings?: number;
  donor_org_name: string;
  pickup_address?: string;
  pickup_lat: number;
  pickup_lng: number;
  effective_deadline: ISODateTime;
  prepared_at?: ISODateTime;
  last_consumption_at?: ISODateTime;
  storage_condition?: StorageCondition;
  allergens?: string | null;
}

export interface Allocation {
  id: UUID;
  donation_id: UUID;
  receiver_id: UUID;
  offer_id: UUID | null;
  servings: number;
  status: AllocationStatus;
  handover_code?: string; // only for the Receiver
  handover_attempts: number;
  accepted_at: ISODateTime;
  eta_at: ISODateTime;
  collected_at: ISODateTime | null;
  servings_distributed: number | null;
  distribution_area: string | null;
  distributed_at: ISODateTime | null;
  completed_at: ISODateTime | null;
  completion_unconfirmed: boolean;
  cancelled_at: ISODateTime | null;
  cancelled_by: UUID | null;
  cancel_reason: string | null;
  // API extras
  donation: DonationSummary;
  donor_org_name: string;
  donor_name: string | null;
  donor_phone: string | null;
  receiver_org_name: string;
  receiver_phone: string | null;
  receiver_lat: number | null;
  receiver_lng: number | null;
  pickup_address: string;
  pickup_lat: number;
  pickup_lng: number;
  pickup_instructions: string | null;
  effective_deadline: ISODateTime;
  feedback_submitted_by_me: boolean;
}

export interface DonationDetail extends Donation {
  timeline: TimelineEntry[];
  allocations: Allocation[];
  pending_offers_count: number;
}

export interface DonationCreateInput {
  title: string;
  description: string | null;
  food_category: FoodCategory;
  diet_type: DietType;
  quantity_servings: number;
  quantity_kg: number | null;
  allergens: string | null;
  storage_condition: StorageCondition;
  ambient_above_32c: boolean;
  prepared_at: ISODateTime;
  packaged_expiry_date: ISODate | null;
  donor_pickup_by: ISODateTime;
  pickup_address: string;
  pickup_lat: number;
  pickup_lng: number;
  pickup_instructions: string | null;
  contact_phone: string;
  batch_no: string | null;
  temperature_c: number | null;
  checklist: Checklist;
  declaration_accepted: boolean;
  photo_paths: string[];
}

// ---- Offers ----
export type FactorName =
  'distance' | 'capacity' | 'feasibility' | 'demand' | 'reliability' | 'diet' | 'availability';
export type FactorScores = Record<FactorName, number>;
export type JevWeights = Record<FactorName, number>;

export interface Offer {
  id: UUID;
  donation_id: UUID;
  receiver_id: UUID;
  match_run_id: UUID;
  rank: number;
  match_score: number;
  factor_scores: FactorScores;
  reasons: string[];
  distance_km: number;
  eta_minutes: number;
  offered_servings: number;
  status: OfferStatus;
  offered_at: ISODateTime;
  expires_at: ISODateTime;
  responded_at: ISODateTime | null;
  decline_reason: string | null;
  donation: DonationSummary;
  receiver_org_name: string;
  allocation_id: UUID | null;
}

/** Read-only dashboard feed entry: open food this Receiver could take (only top-ranked Receivers get offers). */
export interface NearbyDonation {
  donation_id: UUID;
  title: string;
  food_category: FoodCategory;
  diet_type: DietType;
  remaining_servings: number;
  priority_level: PriorityLevel;
  effective_deadline: ISODateTime;
  posted_at: ISODateTime;
  donor_org_name: string | null;
  distance_km: number;
  eta_minutes: number;
  offer_id: UUID | null;
  offer_status: OfferStatus | null;
}

// ---- Matching (§7.6) ----
export interface MatchCandidate {
  receiver_id: UUID;
  org_name: string;
  included: boolean;
  exclusion_code: ExclusionCode | null;
  distance_km: number | null;
  eta_minutes: number | null;
  capacity_available: number | null;
  factors: Partial<FactorScores> | null;
  match_score: number | null;
  rank: number | null;
  reasons: string[];
}

export interface MatchRun {
  id: UUID;
  donation_id: UUID;
  run_at: ISODateTime;
  trigger: string;
  search_radius_km: number;
  remaining_servings: number;
  weights: JevWeights;
  candidates: MatchCandidate[];
}

export interface AdminDonationDetail extends DonationDetail {
  match_runs: MatchRun[];
  offers: Offer[];
}

// ---- Messaging, feedback ----
export interface Message {
  id: UUID;
  allocation_id: UUID;
  sender_id: UUID;
  body: string;
  created_at: ISODateTime;
}

/** `GET /allocations/{id}/messages` */
export interface MessagesResponse {
  items: Message[];
  open: boolean; // POST allowed (server-side chat window, §10.4)
}

export interface Feedback {
  id: UUID;
  allocation_id: UUID;
  from_user_id: UUID;
  to_user_id: UUID;
  direction: FeedbackDirection;
  overall_rating: number;
  on_time: boolean | null;
  professional: boolean | null;
  proper_containers: boolean | null;
  quantity_matched: boolean | null;
  fresh_on_arrival: boolean | null;
  properly_packed: boolean | null;
  safety_issue: boolean;
  comment: string | null;
  photo_path: string | null;
  created_at: ISODateTime;
}

export interface FeedbackInput {
  overall_rating: number;
  on_time?: boolean | null;
  professional?: boolean | null;
  proper_containers?: boolean | null;
  quantity_matched?: boolean | null;
  fresh_on_arrival?: boolean | null;
  properly_packed?: boolean | null;
  safety_issue?: boolean;
  comment: string | null;
  photo_path?: string | null;
}

/** `GET /allocations/{id}/feedback` — parties get the blind view (§13.3), Admins get all rows. */
export type FeedbackVisibility =
  | {
      mine: Feedback | null;
      theirs: Feedback | null; // null until I submit or the window closes
      theirs_submitted: boolean;
      window_closed: boolean;
    }
  | { items: Feedback[]; window_closed: boolean };

export interface SafetyReport {
  id: UUID;
  allocation_id: UUID;
  donation_id: UUID;
  donor_id: UUID;
  reported_by: UUID;
  description: string;
  photo_path: string | null;
  status: ReportStatus;
  admin_notes: string | null;
  resolved_by: UUID | null;
  resolved_at: ISODateTime | null;
  created_at: ISODateTime;
  // TODO(team): confirm which display extras the backend adds (org names, donation title).
  donor_org_name?: string;
  donation_title?: string;
  photo_url?: string | null;
}

export interface Dispute {
  id: UUID;
  allocation_id: UUID;
  raised_by: UUID;
  reason: DisputeReason;
  description: string;
  status: DisputeStatus;
  resolution: string | null;
  resolved_by: UUID | null;
  resolved_at: ISODateTime | null;
  created_at: ISODateTime;
  // Admin list extras
  donation_id?: UUID;
  raised_by_name?: string;
  raised_by_role?: UserRole;
}

export interface AppNotification {
  id: UUID;
  user_id: UUID;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  read_at: ISODateTime | null;
  created_at: ISODateTime;
}

export interface NotificationsPage extends Paginated<AppNotification> {
  unread_count: number;
}

// ---- Impact / admin ----
export interface PublicImpact {
  meals_rescued: number;
  rescues_completed: number;
  active_receivers: number;
}

export interface MyImpact {
  meals_rescued: number;
  successful_rescues: number;
  avg_time_to_acceptance_minutes: number | null;
  donations_posted?: number; // Donors only
  // Receivers additionally (§14.2)
  on_time_pickup_rate?: number | null;
  reliability_score?: number | null;
}

export interface AdminOverview {
  pending_verifications: number;
  flagged_donations: number;
  open_safety_reports: number;
  open_disputes: number;
  active_rescues: number;
  meals_rescued_today: number;
  recent_no_match_alerts?: Array<{
    donation_id: UUID;
    title: string;
    donor_org_name: string;
    remaining_servings: number;
    effective_deadline: ISODateTime;
    alerted_at: ISODateTime;
  }>;
}

export interface VerificationItem {
  user: User;
  profile: ReceiverProfile;
  doc_url: string | null;
}

export interface LiveData {
  donations: Array<
    Pick<
      Donation,
      | 'id'
      | 'title'
      | 'status'
      | 'priority_level'
      | 'pickup_lat'
      | 'pickup_lng'
      | 'effective_deadline'
      | 'remaining_servings'
      | 'quantity_servings'
      | 'donor_org_name'
    >
  >;
  allocations: Array<{
    id: UUID;
    donation_id: UUID;
    status: AllocationStatus;
    servings: number;
    receiver_org_name: string;
    donation_title?: string;
    pickup_lat: number;
    pickup_lng: number;
    receiver_lat?: number | null;
    receiver_lng?: number | null;
    effective_deadline: ISODateTime;
  }>;
}

export interface Analytics {
  meals_rescued: number;
  successful_rescues: number;
  donations_posted: number;
  fully_matched_rate: number | null;
  expiry_rate: number | null;
  avg_time_to_acceptance_minutes: number | null;
  offer_acceptance_rate: number | null;
  no_show_count: number;
  good_condition_rate: number | null;
  active_donors: number;
  active_receivers: number;
  meals_per_day: Array<{ date: ISODate; meals: number }>;
  donations_by_category: Array<{ food_category: FoodCategory; count: number }>;
}

export interface AuditRow {
  id: number;
  actor_id: UUID | null;
  action: string;
  entity_type: string;
  entity_id: UUID;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created_at: ISODateTime;
}

/** `GET /admin/config` — app_config keys (§16) */
export interface AppConfig {
  jev_weights_default: JevWeights;
  jev_weights_high: JevWeights;
  road_factor: number;
  avg_speed_kmph: number;
  prep_buffer_minutes: number;
  search_radius_steps_km: number[];
  safe_window_hours: {
    hot_held: number;
    room_temp: number;
    room_temp_hot_ambient: number;
    refrigerated: number;
  };
  packaged_expiry_buffer_hours: number;
  post_pickup_consume_hours: number;
  min_rescue_window_minutes: number;
  offer_timeout_min_max: [number, number];
  offer_timeout_fraction: number;
  offer_batch_size: number;
  no_show_grace_minutes: number;
  feedback_window_hours: number;
  auto_complete_hours: number;
  priority_thresholds: { high: number; medium: number };
}

export interface UploadSignResponse {
  signed_url: string;
  path: string;
  token: string;
  max_bytes: number;
}

export type UploadBucket = 'donation-photos' | 'verification-docs' | 'feedback-photos';

// ---- Assistant (§11) ----
export interface DonationDraft {
  title?: string;
  description?: string | null;
  food_category?: FoodCategory;
  diet_type?: DietType;
  quantity_servings?: number;
  quantity_kg?: number | null;
  allergens?: string | null;
  storage_condition?: StorageCondition | null;
  prepared_at?: ISODateTime;
  donor_pickup_by?: ISODateTime;
  pickup_instructions?: string | null;
}

export interface AssistantResponse {
  conversation_id: UUID;
  reply: string;
  draft?: DonationDraft | null;
}
