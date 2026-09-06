export const TENANT_STATUSES = ["TRIAL", "ACTIVE", "SUSPENDED"] as const;
export type TenantStatus = (typeof TENANT_STATUSES)[number];

export const USER_STATUSES = ["ACTIVE", "DISABLED"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const DATA_SCOPES = [
  "PLATFORM",
  "TENANT",
  "BRANCH",
  "UNIT",
  "OWN_PORTFOLIO",
] as const;
export type DataScope = (typeof DATA_SCOPES)[number];

export const ACTOR_LAYERS = ["PLATFORM", "TENANT"] as const;
export type ActorLayer = (typeof ACTOR_LAYERS)[number];

export const BRANCH_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type BranchStatus = (typeof BRANCH_STATUSES)[number];

export const SYSTEM_ROLE_SLUGS = [
  "platform_admin",
  "ketua",
  "manajer_cabang",
  "bendahara",
  "admin_anggota",
  "analis_kredit",
  "kolektor",
  "auditor",
] as const;
export type SystemRoleSlug = (typeof SYSTEM_ROLE_SLUGS)[number];

export const ACCOUNT_CLASSES = {
  ASSET: "1",
  LIABILITY: "2",
  EQUITY: "3",
  INCOME: "4",
  EXPENSE: "5",
} as const;

export const INTEREST_METHODS = [
  "FLAT",
  "DECLINING",
  "ANNUITY",
  "DAILY_EFFECTIVE",
] as const;
export type InterestMethod = (typeof INTEREST_METHODS)[number];

export const RATE_BASES = ["ANNUAL", "DAILY", "PRINCIPAL_TOTAL"] as const;
export type RateBasis = (typeof RATE_BASES)[number];

export const INSTALLMENT_FREQUENCIES = [
  "DAILY",
  "WEEKLY",
  "BIWEEKLY",
  "MONTHLY",
] as const;
export type InstallmentFrequency = (typeof INSTALLMENT_FREQUENCIES)[number];

export const COLLECTABILITY = [1, 2, 3, 4, 5] as const;
export type Collectability = (typeof COLLECTABILITY)[number];

export const HOLIDAY_ROLLOVER = ["STAY", "FORWARD", "BACKWARD"] as const;
export type HolidayRollover = (typeof HOLIDAY_ROLLOVER)[number];

export const PENALTY_KINDS = [
  "NONE",
  "FIXED_ONCE",
  "FIXED_PER_DAY",
  "PERCENT_INSTALLMENT",
  "PERCENT_INSTALLMENT_PER_DAY",
] as const;
export type PenaltyKind = (typeof PENALTY_KINDS)[number];

export const PAYMENT_ALLOCATION_DEFAULT = [
  "PENALTY",
  "INTEREST",
  "PRINCIPAL",
] as const;
export type PaymentBucket = (typeof PAYMENT_ALLOCATION_DEFAULT)[number];

export const MEMBER_GENDERS = ["MALE", "FEMALE"] as const;
export type MemberGender = (typeof MEMBER_GENDERS)[number];

export const MEMBER_RELIGIONS = ["ISLAM", "CHRISTIAN", "CATHOLIC", "HINDU", "BUDDHIST", "CONFUCIAN", "OTHER"] as const;
export type MemberReligion = (typeof MEMBER_RELIGIONS)[number];

export const MEMBER_MARITAL = ["SINGLE", "MARRIED", "WIDOWED", "DIVORCED"] as const;
export type MemberMarital = (typeof MEMBER_MARITAL)[number];

export const MEMBER_EDUCATION = ["SD", "SMP", "SMA", "DIPLOMA", "S1", "S2", "S3", "OTHER"] as const;
export type MemberEducation = (typeof MEMBER_EDUCATION)[number];

export const MEMBER_EMPLOYMENT = ["EMPLOYEE", "SELF_EMPLOYED", "FARMER", "CIVIL_SERVANT", "INFORMAL", "RETIRED", "OTHER"] as const;
export type MemberEmployment = (typeof MEMBER_EMPLOYMENT)[number];

export const MEMBER_HOUSE = ["OWNED", "FAMILY", "RENT", "OFFICIAL", "OTHER"] as const;
export type MemberHouse = (typeof MEMBER_HOUSE)[number];

export const MEMBER_TYPES = ["REGULAR", "EXTRAORDINARY"] as const;
export type MemberType = (typeof MEMBER_TYPES)[number];
