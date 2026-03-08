import { useState, useEffect, useCallback } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Card } from '@openconnect/ui';
import { useAuth } from '../../../../apps/web/src/context/AuthContext';

const API_BASE = '/api/voice';

interface VoiceCallRecord {
  id: string;
  status: string;
  startedAt: string;
  connectedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  endedBy: string | null;
  incarceratedPerson: { firstName: string; lastName: string };
  familyMember: { firstName: string; lastName: string; phone: string };
}

interface Stats {
  activeCalls: number;
  todayTotal: number;
}

interface CallLogResponse {
  success: boolean;
  data: VoiceCallRecord[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

function usePolling<T>(fetcher: () => Promise<T>, intervalMs: number) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    fetcher()
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [fetcher]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, intervalMs);
    return () => clearInterval(id);
  }, [refresh, intervalMs]);

  return { data, loading, error, refresh };
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ringing: 'bg-yellow-100 text-yellow-800',
    connected: 'bg-green-100 text-green-800',
    completed: 'bg-gray-100 text-gray-700',
    missed: 'bg-red-100 text-red-700',
    rejected: 'bg-orange-100 text-orange-700',
    blocked_by_receiver: 'bg-red-100 text-red-800',
    terminated_by_admin: 'bg-purple-100 text-purple-700',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-700'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function formatDuration(seconds: number | null): string {
  if (seconds == null || seconds <= 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function LiveDuration({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  return <span className="tabular-nums">{formatDuration(elapsed)}</span>;
}

function VoiceDashboard() {
  const { token } = useAuth();
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const headers = { Authorization: `Bearer ${token}` };

  const fetchStats = useCallback(async (): Promise<Stats> => {
    const res = await fetch(`${API_BASE}/stats`, { headers });
    const json = await res.json();
    if (!json.success) throw new Error('Failed to load stats');
    return json.data;
  }, [token]);

  const fetchActiveCalls = useCallback(async (): Promise<VoiceCallRecord[]> => {
    const res = await fetch(`${API_BASE}/active-calls`, { headers });
    const json = await res.json();
    if (!json.success) throw new Error('Failed to load active calls');
    return json.data;
  }, [token]);

  const fetchCallLogs = useCallback(async (): Promise<CallLogResponse> => {
    const res = await fetch(`${API_BASE}/call-logs?page=${page}&pageSize=${pageSize}`, { headers });
    const json = await res.json();
    if (!json.success) throw new Error('Failed to load call logs');
    return json;
  }, [token, page]);

  const stats = usePolling(fetchStats, 15_000);
  const activeCalls = usePolling(fetchActiveCalls, 15_000);
  const callLogs = usePolling(fetchCallLogs, 30_000);

  // Re-fetch call logs when page changes
  useEffect(() => { callLogs.refresh(); }, [page]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Voice Call Management</h1>
          <p className="text-sm text-gray-500 mt-1">Monitor and manage active voice calls</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card padding="md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Active Calls</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">
                {stats.loading ? '—' : stats.data?.activeCalls ?? 0}
              </p>
            </div>
            {(stats.data?.activeCalls ?? 0) > 0 && (
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
              </span>
            )}
          </div>
        </Card>
        <Card padding="md">
          <div>
            <p className="text-sm font-medium text-gray-500">Today's Calls</p>
            <p className="text-3xl font-bold text-green-600 mt-1">
              {stats.loading ? '—' : stats.data?.todayTotal ?? 0}
            </p>
          </div>
        </Card>
      </div>

      {/* Active Calls */}
      <Card padding="lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Active Calls</h2>
          <button
            onClick={activeCalls.refresh}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            ↻ Refresh
          </button>
        </div>
        {activeCalls.loading ? (
          <p className="text-center py-6 text-gray-400">Loading...</p>
        ) : !activeCalls.data?.length ? (
          <p className="text-center py-6 text-gray-400">No active calls</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="pb-2 font-medium">Person</th>
                  <th className="pb-2 font-medium">Contact</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Started</th>
                  <th className="pb-2 font-medium">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activeCalls.data.map((call) => (
                  <tr key={call.id} className="hover:bg-gray-50">
                    <td className="py-3">
                      {call.incarceratedPerson.firstName} {call.incarceratedPerson.lastName}
                    </td>
                    <td className="py-3">
                      {call.familyMember.firstName} {call.familyMember.lastName}
                    </td>
                    <td className="py-3"><StatusBadge status={call.status} /></td>
                    <td className="py-3 text-gray-500">{formatTime(call.startedAt)}</td>
                    <td className="py-3 text-gray-500">
                      <LiveDuration startedAt={call.connectedAt || call.startedAt} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Call History */}
      <Card padding="lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Call History</h2>
          <button
            onClick={callLogs.refresh}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            ↻ Refresh
          </button>
        </div>
        {callLogs.loading ? (
          <p className="text-center py-6 text-gray-400">Loading...</p>
        ) : !callLogs.data?.data?.length ? (
          <p className="text-center py-6 text-gray-400">No call history</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="pb-2 font-medium">Person</th>
                    <th className="pb-2 font-medium">Contact</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Time</th>
                    <th className="pb-2 font-medium">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {callLogs.data.data.map((call) => (
                    <tr key={call.id} className="hover:bg-gray-50">
                      <td className="py-3">
                        {call.incarceratedPerson.firstName} {call.incarceratedPerson.lastName}
                      </td>
                      <td className="py-3">
                        {call.familyMember.firstName} {call.familyMember.lastName}
                      </td>
                      <td className="py-3"><StatusBadge status={call.status} /></td>
                      <td className="py-3 text-gray-500">{formatTime(call.startedAt)}</td>
                      <td className="py-3 text-gray-500">{formatDuration(call.durationSeconds)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {callLogs.data.pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                <p className="text-sm text-gray-500">
                  Page {callLogs.data.pagination.page} of {callLogs.data.pagination.totalPages}
                  {' '}({callLogs.data.pagination.total} total)
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-3 py-1 text-sm rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    ← Prev
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(callLogs.data!.pagination.totalPages, p + 1))}
                    disabled={page >= callLogs.data.pagination.totalPages}
                    className="px-3 py-1 text-sm rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

export default function VoiceAdmin() {
  return (
    <Routes>
      <Route index element={<VoiceDashboard />} />
    </Routes>
  );
}
