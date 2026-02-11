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

  // Disease check
  const highRiskDiseases = ["人工呼吸器", "透析"];
  if (highRiskDiseases.some((d) => input.disease.includes(d))) {
    needsConsultation = true;
    triggerFlags.push("high_risk_disease");
    reasons.push("医療依存度が高い疾患のため、個別相談が必要です");
  }

  // ADL check
  if (input.adl === "全介助") {
    triggerFlags.push("full_care_adl");
    reasons.push("ADL全介助の方は訪問看護体制の確認が必要です");
  }

  // Budget check
  if (input.budget === "〜8万円") {
    needsConsultation = true;
    triggerFlags.push("low_budget");
    reasons.push("ご予算に応じたプランの個別調整が必要です");
  }

  // Timing check
  if (input.timing === "即日〜3日以内") {
    triggerFlags.push("urgent_timing");
    reasons.push("緊急対応枠での調整となります");
  }

  if (needsConsultation) {
    return {
      status: "consultation",
      message: "個別相談をお勧めいたします",
      reasons,
      triggerFlags,
    };
  }

  return {
    status: "acceptable",
    message: "受入可能です",
    reasons:
      reasons.length > 0 ? reasons : ["条件に合致する居室をご案内できます"],
    triggerFlags,
  };
}
