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

const SLOT_KEY = "b2b_portal_slots";
const LOG_KEY = "b2b_portal_assessment_logs";
const BOOKING_KEY = "b2b_portal_booking_logs";

const DEFAULT_CONFIG: SlotConfig = {
  totalSlots: 5,
  usedSlots: 2,
  lastReloadDate: new Date().toISOString().split("T")[0],
  lastReloadTimestamp: new Date().toISOString(),
  status: "available",
};

// --- Slot Management ---

export function getSlotConfig(): SlotConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  const stored = localStorage.getItem(SLOT_KEY);
  if (!stored) {
    localStorage.setItem(SLOT_KEY, JSON.stringify(DEFAULT_CONFIG));
    return DEFAULT_CONFIG;
  }
  return JSON.parse(stored);
}

export function saveSlotConfig(config: SlotConfig): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SLOT_KEY, JSON.stringify(config));
}

export function getRemainingSlots(): number {
  const config = getSlotConfig();
  return Math.max(0, config.totalSlots - config.usedSlots);
}

export function consumeSlot(): boolean {
  const config = getSlotConfig();
  if (config.usedSlots >= config.totalSlots) {
    config.status = "adjusting";
    saveSlotConfig(config);
    return false;
  }
  config.usedSlots += 1;
  if (config.usedSlots >= config.totalSlots) {
    config.status = "adjusting";
  }
  saveSlotConfig(config);
  return true;
}

export function reloadSlots(totalSlots: number): void {
  const config: SlotConfig = {
    totalSlots,
    usedSlots: 0,
    lastReloadDate: new Date().toISOString().split("T")[0],
    lastReloadTimestamp: new Date().toISOString(),
    status: "available",
  };
  saveSlotConfig(config);
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

  if (disease.includes("人工呼吸器")) {
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
