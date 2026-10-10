/**
 * Coming back to the dashboard from a bill opened in one of its lists: the same list is
 * open again, at the same place. Kept for this tab only.
 */
export type DashboardView =
  | { kind: "settle"; personId: string; currency: string }
  | { kind: "plan"; toId: string; currency: string }
  | { kind: "page" };

const KEY = "billsplit.dashboardReturn";

export function rememberDashboard(view: DashboardView): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ view, scrollY: window.scrollY }));
  } catch {
    // without storage the dashboard simply opens at the top
  }
}

/** The view to restore (once). */
export function takeDashboard(): { view: DashboardView; scrollY: number } | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return raw ? (JSON.parse(raw) as { view: DashboardView; scrollY: number }) : null;
  } catch {
    return null;
  }
}
