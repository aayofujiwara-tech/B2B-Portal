/**
 * Slot Management Store
 *
 * Manages the "limited availability" model.
 * In production, this would be backed by a database.
 * For this prototype, we use localStorage for persistence.
 */

export interface SlotConfig {
  totalSlots: number;
  usedSlots: number;
  lastReloadDate: string;
  lastReloadTimestamp: string;
  status: "available" | "adjusting";
}

export interface AssessmentLog {
  id: string;
  timestamp: string;
  disease: string;
  adl: string;
  gender: string;
  budget: string;
  timing: string;
  result: "acceptable" | "consultation";
  reason?: string;
  triggerFlags?: string[];
}

export interface BookingLog {
  id: string;
  timestamp: string;
  facilityName: string;
  contactName: string;
  phone: string;
  email: string;
  preferredDate: string;
  preferredTime: string;
  notes: string;
}

// --- Facility Definitions ---

export const FACILITY_IDS = ["tsukamoto", "toyoshin", "utajima"] as const;
export type FacilityId = (typeof FACILITY_IDS)[number];

export const FACILITY_LABELS: Record<FacilityId, string> = {
  tsukamoto: "塚本",
  toyoshin: "豊新",
  utajima: "歌島",
};

const LOG_KEY = "b2b_portal_assessment_logs";
const BOOKING_KEY = "b2b_portal_booking_logs";

function slotKey(id: FacilityId): string {
  return `b2b_slots_${id}`;
}

const DEFAULT_CONFIG: SlotConfig = {
  totalSlots: 5,
  usedSlots: 2,
  lastReloadDate: new Date().toISOString().split("T")[0],
  lastReloadTimestamp: new Date().toISOString(),
  status: "available",
};

// --- Slot Management (per-facility) ---

export function getSlotConfig(facilityId: FacilityId): SlotConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  const stored = localStorage.getItem(slotKey(facilityId));
  if (!stored) {
    localStorage.setItem(slotKey(facilityId), JSON.stringify(DEFAULT_CONFIG));
    return DEFAULT_CONFIG;
  }
  return JSON.parse(stored);
}

export function saveSlotConfig(
  config: SlotConfig,
  facilityId: FacilityId
): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(slotKey(facilityId), JSON.stringify(config));
}

export function getAggregateSlots(): {
  total: number;
  used: number;
  remaining: number;
  status: SlotConfig["status"];
  lastReloadTimestamp: string;
} {
  let total = 0;
  let used = 0;
  let latest = "";
  for (const id of FACILITY_IDS) {
    const c = getSlotConfig(id);
    total += c.totalSlots;
    used += c.usedSlots;
    if (c.lastReloadTimestamp > latest) latest = c.lastReloadTimestamp;
  }
  const remaining = Math.max(0, total - used);
  return {
    total,
    used,
    remaining,
    status: remaining > 0 ? "available" : "adjusting",
    lastReloadTimestamp: latest || new Date().toISOString(),
  };
}

export function consumeSlot(facilityId?: string): boolean {
  const ids: FacilityId[] =
    facilityId && facilityId !== "any"
      ? [facilityId as FacilityId]
      : [...FACILITY_IDS];

  for (const id of ids) {
    const config = getSlotConfig(id);
    if (config.usedSlots < config.totalSlots) {
      config.usedSlots += 1;
      if (config.usedSlots >= config.totalSlots) config.status = "adjusting";
      saveSlotConfig(config, id);
      return true;
    }
  }
  return false;
}

export function reloadSlots(totalSlots: number, facilityId: FacilityId): void {
  const config: SlotConfig = {
    totalSlots,
    usedSlots: 0,
    lastReloadDate: new Date().toISOString().split("T")[0],
    lastReloadTimestamp: new Date().toISOString(),
    status: "available",
  };
  saveSlotConfig(config, facilityId);
}

// --- Facility Strengths ---

export function getFacilityStrengths(facilityId: string): string[] {
  const strengths = ["保証人不要・初期費用分割相談可・生活保護対応"];
  if (
    facilityId === "tsukamoto" ||
    facilityId === "utajima" ||
    facilityId === "any"
  ) {
    strengths.push("【塚本・歌島】JR塚本駅 徒歩圏内の好立地");
  }
  if (facilityId === "toyoshin" || facilityId === "any") {
    strengths.push("【豊新】10階建・開放感のある住環境");
  }
  return strengths;
}

// --- Assessment Logs ---

export function getAssessmentLogs(): AssessmentLog[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(LOG_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function addAssessmentLog(
  log: Omit<AssessmentLog, "id" | "timestamp">
): AssessmentLog {
  const logs = getAssessmentLogs();
  const newLog: AssessmentLog = {
    ...log,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };
  logs.unshift(newLog);
  if (typeof window !== "undefined") {
    localStorage.setItem(LOG_KEY, JSON.stringify(logs));
  }
  return newLog;
}

// --- Booking Logs ---

export function getBookingLogs(): BookingLog[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(BOOKING_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function addBookingLog(
  log: Omit<BookingLog, "id" | "timestamp">
): BookingLog {
  const logs = getBookingLogs();
  const newLog: BookingLog = {
    ...log,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };
  logs.unshift(newLog);
  if (typeof window !== "undefined") {
    localStorage.setItem(BOOKING_KEY, JSON.stringify(logs));
  }
  return newLog;
}

// --- Disease Notes (備考) ---

export interface DiseaseNote {
  label: string;
  note: string;
}

export function getDiseaseNotes(disease: string): DiseaseNote[] {
  const notes: DiseaseNote[] = [];

  if (
    disease.includes("脳血管") ||
    disease.includes("心疾患")
  ) {
    notes.push({
      label: "カテーテル管理",
      note: "原則、往診時に医師が交換対応を行います",
    });
  }

  if (disease.includes("人工呼吸器") || disease.includes("呼吸器")) {
    notes.push({
      label: "人工呼吸器・気管カニューレ",
      note: "夜間の吸引が不要な場合は受入相談可能です。まずは詳細をお聞かせください",
    });
  }

  if (disease.includes("透析")) {
    notes.push({
      label: "腹膜透析（CAPD）",
      note: "要相談項目ですが、個別の調整が可能です",
    });
  }

  if (disease.includes("骨折") || disease.includes("整形")) {
    notes.push({
      label: "抜糸",
      note: "提携クリニックの看護師にて対応可能です",
    });
  }

  return notes;
}

// --- Assessment Logic ---

export interface AssessmentInput {
  disease: string;
  adl: string;
  gender: string;
  budget: string;
  timing: string;
}

export interface AssessmentResult {
  status: "acceptable" | "consultation";
  message: string;
  reasons: string[];
  triggerFlags: string[];
}

export function runAssessment(input: AssessmentInput): AssessmentResult {
  const reasons: string[] = [];
  const triggerFlags: string[] = [];
  let needsConsultation = false;

  // Disease check — only ventilator requires consultation
  if (input.disease.includes("人工呼吸器")) {
    needsConsultation = true;
    triggerFlags.push("high_risk_disease");
    reasons.push("人工呼吸器管理のため、受入体制の事前確認が必要です");
  } else if (input.disease.includes("透析")) {
    triggerFlags.push("dialysis");
    reasons.push("透析スケジュールに合わせた送迎プランをご提案します");
  }

  // ADL check — positive framing, no longer a blocker
  if (input.adl === "全介助") {
    triggerFlags.push("full_care_adl");
    reasons.push("24時間訪問看護体制でサポートいたします");
  }

  // Budget check — relaxed: offer plan adjustment instead of blocking
  if (input.budget === "〜8万円") {
    triggerFlags.push("low_budget");
    reasons.push("ご予算に応じた最適プランを面談時にご案内します");
  }

  // Timing check — positive urgency
  if (input.timing === "即日〜3日以内") {
    triggerFlags.push("urgent_timing");
    reasons.push("スピード面談枠で最短対応いたします");
  }

  if (needsConsultation) {
    return {
      status: "consultation",
      message: "入居可能性：要相談",
      reasons,
      triggerFlags,
    };
  }

  return {
    status: "acceptable",
    message: "入居可能性：高",
    reasons:
      reasons.length > 0
        ? reasons
        : ["ご入居条件に合致しています。優先面談枠をご利用いただけます"],
    triggerFlags,
  };
}
