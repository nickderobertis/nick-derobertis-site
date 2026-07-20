export type AnalyticsEvent = {
  name: string;
  params?: Record<string, string | number | boolean>;
};
type Gtag = (
  command: "event",
  name: string,
  params?: AnalyticsEvent["params"],
) => void;
export function trackEvent(event: AnalyticsEvent): void {
  const gtag = (window as typeof window & { gtag?: Gtag }).gtag;
  gtag?.("event", event.name, event.params);
}
