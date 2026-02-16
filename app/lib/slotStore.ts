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
  diseaseOther?: string;
  adl: string;
  dementiaLevel?: string;
  gender: string;
  budget: string;
  timing: string;
  medicalDevice?: boolean;
  mentalGrade?: string;
  selfHarm?: boolean;
  otherHarm?: boolean;
  result: "acceptable" | "consultation" | "safety_risk";
  reason?: string;
  triggerFlags?: string[];
  isHandled?: boolean;
  handledAt?: string;
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
  agreed_terms?: boolean;
  agreed_consent?: boolean;
  agreed_at?: string;
  isHandled?: boolean;
  handledAt?: string;
}

// --- Facility Definitions ---

export const FACILITY_IDS = ["tsukamoto", "utajima", "toyoshin"] as const;
export type FacilityId = (typeof FACILITY_IDS)[number];

export const FACILITY_LABELS: Record<FacilityId, string> = {
  tsukamoto: "塚本",
  utajima: "歌島",
  toyoshin: "豊新",
};

const LOG_KEY = "b2b_portal_assessment_logs";
const BOOKING_KEY = "b2b_portal_booking_logs";

function slotKey(id: FacilityId): string {
  return `b2b_slots_${id}`;
}

const DEFAULT_CONFIG: SlotConfig = {
  totalSlots: 0,
  usedSlots: 0,
  lastReloadDate: new Date().toISOString().split("T")[0],
  lastReloadTimestamp: new Date().toISOString(),
  status: "adjusting",
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
    status: totalSlots > 0 ? "available" : "adjusting",
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

// --- Delete Logs ---

export function deleteAssessmentLogs(ids: string[]): AssessmentLog[] {
  const idSet = new Set(ids);
  const updated = getAssessmentLogs().filter((log) => !idSet.has(log.id));
  if (typeof window !== "undefined") {
    localStorage.setItem(LOG_KEY, JSON.stringify(updated));
  }
  return updated;
}

export function deleteBookingLogs(ids: string[]): BookingLog[] {
  const idSet = new Set(ids);
  const updated = getBookingLogs().filter((log) => !idSet.has(log.id));
  if (typeof window !== "undefined") {
    localStorage.setItem(BOOKING_KEY, JSON.stringify(updated));
  }
  return updated;
}

export function deleteAssessmentLogsBefore(cutoff: string): AssessmentLog[] {
  const updated = getAssessmentLogs().filter((log) => log.timestamp >= cutoff);
  if (typeof window !== "undefined") {
    localStorage.setItem(LOG_KEY, JSON.stringify(updated));
  }
  return updated;
}

export function deleteBookingLogsBefore(cutoff: string): BookingLog[] {
  const updated = getBookingLogs().filter((log) => log.timestamp >= cutoff);
  if (typeof window !== "undefined") {
    localStorage.setItem(BOOKING_KEY, JSON.stringify(updated));
  }
  return updated;
}

// --- Toggle Handled State ---

export function toggleAssessmentHandled(id: string): AssessmentLog[] {
  const logs = getAssessmentLogs();
  const updated = logs.map((log) =>
    log.id === id
      ? {
          ...log,
          isHandled: !log.isHandled,
          handledAt: !log.isHandled ? new Date().toISOString() : undefined,
        }
      : log
  );
  if (typeof window !== "undefined") {
    localStorage.setItem(LOG_KEY, JSON.stringify(updated));
  }
  return updated;
}

export function toggleBookingHandled(id: string): BookingLog[] {
  const logs = getBookingLogs();
  const updated = logs.map((log) =>
    log.id === id
      ? {
          ...log,
          isHandled: !log.isHandled,
          handledAt: !log.isHandled ? new Date().toISOString() : undefined,
        }
      : log
  );
  if (typeof window !== "undefined") {
    localStorage.setItem(BOOKING_KEY, JSON.stringify(updated));
  }
  return updated;
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

// --- Notification Email Management ---

const NOTIFICATION_EMAILS_KEY = "b2b_notification_emails";

export function getNotificationEmails(): string[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(NOTIFICATION_EMAILS_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function saveNotificationEmails(emails: string[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(NOTIFICATION_EMAILS_KEY, JSON.stringify(emails));
}

// --- Assessment GAS送信 (判定即時記録) ---

let _lastAssessmentFingerprint = "";

export async function sendAssessmentToGAS(input: {
  facilityName: string;
  result: string;
  disease: string;
  adl: string;
  dementiaLevel?: string;
  welfare?: boolean;
  budget: string;
}): Promise<void> {
  // 重複排除: 同一パラメータの連続送信をスキップ
  const fingerprint = JSON.stringify(input);
  if (fingerprint === _lastAssessmentFingerprint) {
    console.log("[assessment-gas] 重複スキップ");
    return;
  }
  _lastAssessmentFingerprint = fingerprint;

  try {
    await fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "assessment",
        body: {
          facilityName: input.facilityName,
          result: input.result,
          disease: input.disease,
          adl: input.adl,
          dementiaLevel: input.dementiaLevel || "",
          welfare: input.welfare ? "はい" : "いいえ",
          budget: input.budget,
          reason: "",
          isRepeater: "",
          source: "direct",
        },
      }),
    });
    console.log("[assessment-gas] 判定ログ送信成功");
  } catch (err) {
    console.error("[assessment-gas] 送信エラー:", err);
  }
}

// --- Booking Notification Service (GAS連携) ---

export interface BookingNotificationPayload {
  to: string[];
  subject: string;
  body: {
    facilityName: string;
    contactName: string;
    phone: string;
    email: string;
    preferredDates: { date: string; timeSlot: string }[];
    notes: string;
    assessmentResult: {
      status: string;
      disease: string;
      adl: string;
      reason: string;
    } | null;
    isRepeater: boolean;
    timestamp: string;
    urgencyMessage: string;
  };
}

export async function sendBookingNotification(
  booking: Omit<BookingLog, "id" | "timestamp"> & {
    allDateSlots?: { date: string; timeSlot: string }[];
    isRepeater?: boolean;
  }
): Promise<{ ok: boolean; payload: BookingNotificationPayload | null }> {
  const recipients = getNotificationEmails();
  if (recipients.length === 0) {
    console.warn("[notify] 通知先未設定のためスキップ");
    return { ok: false, payload: null };
  }

  // 直近の判定結果を取得
  const assessmentLogs = getAssessmentLogs();
  const latest = assessmentLogs.length > 0 ? assessmentLogs[0] : null;

  const payload: BookingNotificationPayload = {
    to: recipients,
    subject: `【要確認】ええすまいポータルより面談受付が入りました（施設名：${booking.facilityName}）`,
    body: {
      facilityName: booking.facilityName,
      contactName: booking.contactName,
      phone: booking.phone,
      email: booking.email,
      preferredDates: booking.allDateSlots || [
        { date: booking.preferredDate, timeSlot: booking.preferredTime },
      ],
      notes: booking.notes,
      assessmentResult: latest
        ? {
            status:
              latest.result === "acceptable"
                ? "受入可能"
                : latest.result === "safety_risk"
                  ? "要慎重検討（安全リスク）"
                  : "要相談",
            disease: latest.disease,
            adl: latest.adl,
            reason: latest.reason || "",
          }
        : null,
      isRepeater: booking.isRepeater ?? false,
      timestamp: new Date().toISOString(),
      urgencyMessage: "至急、上記連絡先へ日程確定の連絡をお願いします。",
    },
  };

  try {
    const res = await fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[notify] API応答エラー:", res.status, err);
      return { ok: false, payload };
    }

    console.log("[notify] 通知送信成功");
    return { ok: true, payload };
  } catch (err) {
    console.error("[notify] ネットワークエラー:", err);
    return { ok: false, payload };
  }
}

// --- Assessment Logic ---

export interface AssessmentInput {
  disease: string;
  diseaseOther?: string;
  adl: string;
  dementiaLevel?: string;
  gender: string;
  budget: string;
  timing: string;
  facility?: string;
  welfare?: boolean;
  medicalDevice?: boolean;
  mentalGrade?: string;
  selfHarm?: boolean;
  otherHarm?: boolean;
}

export interface AssessmentResult {
  status: "acceptable" | "consultation" | "safety_risk";
  message: string;
  reasons: string[];
  triggerFlags: string[];
}

export function runAssessment(input: AssessmentInput): AssessmentResult {
  const reasons: string[] = [];
  const triggerFlags: string[] = [];
  let needsConsultation = false;

  // Safety risk check — ADL高（自立/見守り/一部介助）+ 認知症重度 → 徘徊リスク
  const isHighAdl =
    input.adl === "自立" || input.adl === "見守り" || input.adl === "一部介助";
  const isSevereDementia =
    input.disease.includes("認知症") &&
    input.dementiaLevel?.includes("重度");

  if (isHighAdl && isSevereDementia) {
    triggerFlags.push("safety_risk_wandering");
    return {
      status: "safety_risk",
      message: "要慎重検討（安全上のリスクあり）",
      reasons: [
        "本物件は一般居室を活用した住まいであり、施設のような物理的な施錠管理（外出制限）がございません。",
        "近隣に交通量の多い幹線道路があり、無断外出時の交通事故リスクを完全に排除できません。",
        "GPS追跡端末を携行いただいた場合でも、突発的な事故そのものを未然に防ぐことは困難です。",
        "入居者様の「命の安全」を最優先に考え、事前の面談を通じてリスクの許容範囲を慎重に協議させていただきます。",
      ],
      triggerFlags: ["safety_risk_wandering"],
    };
  }

  // Medical device check → 要相談
  if (input.medicalDevice) {
    needsConsultation = true;
    triggerFlags.push("medical_device");
    reasons.push(
      "医療機器・医療処置ありのため、受入体制の事前確認が必要です"
    );
  }

  // Self-harm / other-harm check → 要相談
  if (input.selfHarm || input.otherHarm) {
    needsConsultation = true;
    if (input.selfHarm) {
      triggerFlags.push("self_harm");
      reasons.push("自傷リスクがあるため、ケア体制の事前協議が必要です");
    }
    if (input.otherHarm) {
      triggerFlags.push("other_harm");
      reasons.push("他害リスクがあるため、安全管理体制の事前協議が必要です");
    }
  }

  // Toyoshin + welfare check
  if (input.facility === "toyoshin" && input.welfare) {
    needsConsultation = true;
    triggerFlags.push("toyoshin_welfare_block");
    reasons.push(
      "豊新は現在生活保護の受入を停止しておりますが、近隣の塚本・歌島では受入可能です。このまま面談予約を承り、最適な拠点をご案内いたします。"
    );
  }

  // Disease check — only ventilator requires consultation
  if (input.disease.includes("人工呼吸器")) {
    needsConsultation = true;
    triggerFlags.push("high_risk_disease");
    reasons.push("人工呼吸器管理のため、受入体制の事前確認が必要です");
  } else if (input.disease.includes("透析")) {
    triggerFlags.push("dialysis");
    reasons.push("透析スケジュールに合わせた送迎プランをご提案します");
  }

  // Mental illness notes
  if (input.disease.includes("精神疾患")) {
    triggerFlags.push("mental_illness");
    if (input.mentalGrade) {
      reasons.push(
        `精神障害者保健福祉手帳${input.mentalGrade}をお持ちとのこと、面談にて詳細をお伺いします`
      );
    }
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
