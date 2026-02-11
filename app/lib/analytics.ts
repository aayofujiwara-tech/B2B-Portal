/**
 * Analytics tracking layer
 *
 * Currently logs to console + localStorage.
 * In production, replace with actual analytics service (GA4, Mixpanel, etc.)
 * or connect to GAS via fetch().
 */

type EventCategory =
  | "page_view"
  | "slot_view"
  | "assessment_start"
  | "assessment_submit"
  | "result_view"
  | "consultation_call"
  | "pdf_download"
  | "booking_start"
  | "booking_submit"
  | "admin_action";

interface AnalyticsEvent {
  category: EventCategory;
  action: string;
  label?: string;
  value?: number;
  timestamp: string;
  sessionId: string;
  step?: number;
}

const ANALYTICS_KEY = "b2b_portal_analytics";

let sessionId: string = "";

function getSessionId(): string {
  if (sessionId) return sessionId;
  if (typeof window === "undefined") return "ssr";
  const stored = sessionStorage.getItem("b2b_session_id");
  if (stored) {
    sessionId = stored;
    return stored;
  }
  sessionId = crypto.randomUUID();
  sessionStorage.setItem("b2b_session_id", sessionId);
  return sessionId;
}

// Funnel step mapping for conversion tracking
const FUNNEL_STEPS: Record<string, number> = {
  page_view_top: 1,
  assessment_start: 2,
  assessment_submit: 3,
  result_view: 4,
  booking_start: 5,
  booking_submit: 6,
};

function getPersistedLog(): AnalyticsEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(ANALYTICS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function persistEvent(event: AnalyticsEvent): void {
  if (typeof window === "undefined") return;
  try {
    const logs = getPersistedLog();
    logs.push(event);
    // Keep last 500 events to avoid localStorage bloat
    const trimmed = logs.slice(-500);
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage full or unavailable — silent fail
  }
}

export function trackEvent(
  category: EventCategory,
  action: string,
  label?: string,
  value?: number
): AnalyticsEvent {
  const stepKey = `${category}${action ? `_${action}` : ""}`;
  const event: AnalyticsEvent = {
    category,
    action,
    label,
    value,
    timestamp: new Date().toISOString(),
    sessionId: getSessionId(),
    step: FUNNEL_STEPS[stepKey] ?? FUNNEL_STEPS[category],
  };

  persistEvent(event);

  console.log(
    `[Analytics] ${event.timestamp} | sid=${event.sessionId.slice(0, 8)} | step=${event.step ?? "-"} | ${category} | ${action}${label ? ` | ${label}` : ""}${value !== undefined ? ` | value=${value}` : ""}`
  );

  return event;
}

export function getEventLog(): AnalyticsEvent[] {
  return getPersistedLog();
}

export function getEventsByCategory(
  category: EventCategory
): AnalyticsEvent[] {
  return getPersistedLog().filter((e) => e.category === category);
}

export function getEventsBySession(sid: string): AnalyticsEvent[] {
  return getPersistedLog().filter((e) => e.sessionId === sid);
}

export function getCurrentSessionId(): string {
  return getSessionId();
}

export function clearAnalyticsLog(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ANALYTICS_KEY);
}
