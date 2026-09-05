"use client";

import { AppShell } from "@/components/shell/app-shell";
import { AsyncState } from "@/components/ui/async-state";
import { KpiGrid } from "@/components/ui/kpi-grid";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useEventStream } from "@/lib/use-event-stream";
import { useFetch } from "@/lib/use-fetch";
import { dateTime } from "@/lib/format";

/**
 * ★ Dashboard — replace the tiles and panels with your problem statement's KPIs.
 *
 * The pattern to copy: useFetch for data, useEventStream to reload on a server
 * event, AsyncState to render loading / error / empty / content.
 */
export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();

  const notifications = useFetch(() => api.notifications.list({ page_size: 5 }), []);

  // Live updates: when the server says something changed, refetch.
  useEventStream({ "kpi.refresh": () => notifications.reload() });

  if (authLoading || !user) return null;

  return (
    <AppShell>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>Signed in as {user.full_name}</p>
        </div>
      </div>

      <KpiGrid
        items={[
          // ★ Replace with real metrics. Feed counts from the API's `total`.
          { label: "Notifications", value: notifications.data?.total ?? "—", sub: "unread + read" },
          { label: "Your role", value: user.role.name },
          { label: "Status", value: "Ready", sub: "replace with a real KPI" },
        ]}
      />

      <div className="card">
        <div className="card-head">
          <span className="card-title">Recent notifications</span>
        </div>

        <AsyncState
          loading={notifications.loading}
          error={notifications.error}
          data={notifications.data}
          isEmpty={(page) => page.items.length === 0}
          emptyTitle="No notifications yet"
          emptyHint="Seeded notifications appear here once the database is populated."
          onRetry={notifications.reload}
        >
          {(page) => (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Message</th>
                    <th>Received</th>
                  </tr>
                </thead>
                <tbody>
                  {page.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.title}</td>
                      <td style={{ whiteSpace: "normal" }}>{item.message}</td>
                      <td>{dateTime(item.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AsyncState>
      </div>
    </AppShell>
  );
}
