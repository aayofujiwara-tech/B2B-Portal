/**
 * Analytics tracking layer
 *
 * Currently logs to console. In production, replace with
 * actual analytics service (GA4, Mixpanel, etc.)
 */

type EventCategory =
  | "slot_view"
  | "assessment_start"
  | "assessment_submit"
  | "result_view"
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
}

const eventLog: AnalyticsEvent[] = [];

export function trackEvent(
  category: EventCategory,
  action: string,
  label?: string,
  value?: number
) {
  const event: AnalyticsEvent = {
    category,
    action,
    label,
    value,
    timestamp: new Date().toISOString(),
  };

  eventLog.push(event);

  console.log(
    `[Analytics] ${event.timestamp} | ${category} | ${action}${label ? ` | ${label}` : ""}${value !== undefined ? ` | value=${value}` : ""}`
  );

  return event;
}

export function getEventLog(): AnalyticsEvent[] {
  return [...eventLog];
}

export function getEventsByCategory(category: EventCategory): AnalyticsEvent[] {
  return eventLog.filter((e) => e.category === category);
}
