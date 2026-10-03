// Human labels for enum values. Values themselves match ARCHITECTURE §4.1 exactly.
import type {
  AccountStatus,
  AllocationStatus,
  DeclineReasonCode,
  DietAcceptance,
  DietType,
  DisputeReason,
  DonationStatus,
  DonorType,
  ExclusionCode,
  FactorName,
  FlagReason,
  FoodCategory,
  OfferStatus,
  PriorityLevel,
  ReceiverType,
  ReportStatus,
  StorageCondition,
  Weekday,
} from '@/types';

export const DONOR_TYPE_LABELS: Record<DonorType, string> = {
  restaurant: 'Restaurant',
  hotel: 'Hotel',
  college_hostel: 'College / hostel',
  caterer_event: 'Caterer / event organiser',
  other_business: 'Other food business',
};

export const RECEIVER_TYPE_LABELS: Record<ReceiverType, string> = {
  ngo: 'NGO',
  shelter: 'Shelter',
  community_org: 'Community organisation',
  food_distributor: 'Food distributor',
};

export const FOOD_CATEGORY_LABELS: Record<FoodCategory, string> = {
  cooked_meal: 'Cooked meal',
  bakery: 'Bakery',
  sweets: 'Sweets',
  dairy: 'Dairy',
  raw_produce: 'Raw produce',
  packaged: 'Packaged',
};

export const DIET_LABELS: Record<DietType, string> = {
  veg: 'Veg',
  egg: 'Egg',
  non_veg: 'Non-veg',
};

/** Diet dots: green / yellow / red (WALKTHROUGH §5.4). */
export const DIET_DOT_CLASS: Record<DietType, string> = {
  veg: 'bg-green',
  egg: 'bg-yellow-400',
  non_veg: 'bg-red',
};

export const DIET_ACCEPTANCE_LABELS: Record<DietAcceptance, string> = {
  veg_only: 'Veg only',
  veg_egg: 'Veg + egg',
  all: 'All (veg, egg, non-veg)',
};

export const STORAGE_LABELS: Record<StorageCondition, string> = {
  hot_held: 'Kept hot',
  room_temp: 'Room temperature',
  refrigerated: 'Refrigerated',
  packaged_sealed: 'Sealed packaged',
};

export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  active: 'Active',
  pending_verification: 'Pending verification',
  rejected: 'Rejected',
  suspended: 'Suspended',
};

export const DONATION_STATUS_LABELS: Record<DonationStatus, string> = {
  POSTED: 'Posted',
  MATCHED: 'Matched',
  ACCEPTED: 'Accepted',
  COLLECTED: 'Collected',
  COMPLETED: 'Completed',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
  FLAGGED: 'Flagged',
};

/** WALKTHROUGH §5.1 offer labels. */
export const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  PENDING: 'Awaiting response',
  ACCEPTED: 'Accepted',
  DECLINED: 'Rejected',
  TIMED_OUT: 'No response',
  SUPERSEDED: 'Taken by another Receiver',
  WITHDRAWN: 'Withdrawn',
};

export const ALLOCATION_STATUS_LABELS: Record<AllocationStatus, string> = {
  ACCEPTED: 'Accepted',
  COLLECTED: 'Collected',
  COMPLETED: 'Completed',
  NO_SHOW: 'No-show',
  CANCELLED: 'Cancelled',
};

export const PRIORITY_LABELS: Record<PriorityLevel, string> = {
  HIGH: 'High priority',
  MEDIUM: 'Medium priority',
  LOW: 'Low priority',
};

export const DECLINE_REASON_LABELS: Record<DeclineReasonCode, string> = {
  no_capacity: 'No capacity right now',
  too_far: 'Too far away',
  no_vehicle_now: 'No vehicle available now',
  food_type: "We can't use this food type",
  other: 'Other',
};

export const DISPUTE_REASON_LABELS: Record<DisputeReason, string> = {
  no_show: 'No-show',
  quantity_mismatch: 'Quantity mismatch',
  quality_issue: 'Quality issue',
  behaviour: 'Behaviour',
  other: 'Other',
};

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  open: 'Open',
  resolved_valid: 'Resolved — valid',
  resolved_invalid: 'Resolved — invalid',
};

export const FLAG_REASON_LABELS: Record<FlagReason, string> = {
  missing_photo: 'No photo uploaded',
  large_quantity: 'Large quantity (501–1000 servings)',
  unverified_large_donor: 'Unverified donor posting over 200 servings',
  open_safety_report: 'Donor has an open safety report',
  low_quality_donor: 'Donor quality score below 0.4',
};

/** §7.6 exclusion labels shown to Admin. First three are exact from the doc. */
export const EXCLUSION_LABELS: Record<ExclusionCode, string> = {
  diet_mismatch: 'Different food requirement',
  category_not_accepted: 'Does not accept this food type',
  cannot_arrive_in_time: 'Cannot arrive before deadline',
  // TODO(team): confirm wording for the remaining exclusion labels ("etc." in ARCHITECTURE §7.6).
  not_verified: 'Not verified or not active',
  unavailable: 'Not available now',
  closed_at_arrival: 'Closed at arrival time',
  out_of_radius: 'Outside service radius',
  no_capacity: 'No capacity left',
  already_offered: 'Already offered this donation',
};

export const FACTOR_LABELS: Record<FactorName, string> = {
  distance: 'Distance',
  capacity: 'Capacity',
  feasibility: 'Feasibility',
  demand: 'Demand',
  reliability: 'Reliability',
  diet: 'Diet',
  availability: 'Availability',
};
export const FACTOR_ORDER: FactorName[] = [
  'distance',
  'capacity',
  'feasibility',
  'demand',
  'reliability',
  'diet',
  'availability',
];

export const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

/** Checklist copy — EXACT (WALKTHROUGH §5.4). Keys from ARCHITECTURE §4.3. */
export const CHECKLIST_ITEMS = [
  { key: 'hygienic_handling', label: 'Food was prepared and handled hygienically.' },
  { key: 'not_served_from_plates', label: "Food was not served from customers' plates." },
  { key: 'covered_containers', label: 'Food is in clean, covered containers.' },
  { key: 'segregated_from_waste', label: 'Food is kept separate from waste.' },
  { key: 'no_spoilage_signs', label: 'Food shows no signs of spoilage (smell, colour, texture).' },
] as const;

/** Declaration copy — EXACT (WALKTHROUGH §5.4). */
export const DECLARATION_TEXT =
  'I confirm the information above is accurate and that this food is surplus that was not served to anyone. I understand FoodResQ helps coordinate the rescue but does not inspect or certify food. The donor is responsible for following food-safety rules.';

export const ACTIVE_DONATION_STATUSES = [
  'POSTED',
  'MATCHED',
  'ACCEPTED',
  'COLLECTED',
  'FLAGGED',
] as const;
export const PAST_DONATION_STATUSES = ['COMPLETED', 'EXPIRED', 'CANCELLED'] as const;
