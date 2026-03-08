import { useState, useEffect, useCallback } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Card } from '@openconnect/ui';
import { useAuth } from '../../../../apps/web/src/context/AuthContext';

const API_BASE = '/api/video';

interface VideoCallRecord {
  id: string;
  status: string;
  scheduledStart: string;
  scheduledEnd: string;
  actualStart: string | null;
  actualEnd: string | null;
  durationSeconds: number | null;
  isLegal: boolean;
  endedBy: string | null;
  incarceratedPerson: { firstName: string; lastName: string };
  familyMember: { firstName: string; lastName: string };
}

interface Stats {
  activeCalls: number;
  todayTotal: number;
  pendingRequests: number;
}

interface CallLogResponse {
  success: boolean;
  data: VideoCallRecord[];
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
    requested: 'bg-yellow-100 text-yellow-800',
    scheduled: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-green-100 text-green-800',
    completed: 'bg-gray-100 text-gray-700',
    cancelled: 'bg-red-100 text-red-700',
    denied: 'bg-orange-100 text-orange-700',
    terminated_by_admin: 'bg-purple-100 text-purple-700',
    missed: 'bg-red-100 text-red-700',
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
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

function VideoDashboard() {
  const { token } = useAuth();
  const [page, setPage] = useState(1);
  const [approving, setApproving] = useState<string | null>(null);
  const pageSize = 10;

  const headers = { Authorization: `Bearer ${token}` };

  const fetchStats = useCallback(async (): Promise<Stats> => {
    const res = await fetch(`${API_BASE}/stats`, { headers });
    const json = await res.json();
    if (!json.success) throw new Error('Failed to load stats');
    return json.data;
  }, [token]);

  const fetchActiveCalls = useCallback(async (): Promise<VideoCallRecord[]> => {
    const res = await fetch(`${API_BASE}/active-calls`, { headers });
    const json = await res.json();
    if (!json.success) throw new Error('Failed to load active calls');
    return json.data;
  }, [token]);

  const fetchPendingRequests = useCallback(async (): Promise<VideoCallRecord[]> => {
    const res = await fetch(`${API_BASE}/pending-requests`, { headers });
    const json = await res.json();
    if (!json.success) throw new Error('Failed to load pending requests');
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
  const pendingRequests = usePolling(fetchPendingRequests, 15_000);
  const callLogs = usePolling(fetchCallLogs, 30_000);

  useEffect(() => { callLogs.refresh(); }, [page]);

  const handleApprove = async (callId: string) => {
    setApproving(callId);
    try {
      const res = await fetch(`${API_BASE}/approve-request/${callId}`, {
        method: 'POST',
        headers,
      });
      const json = await res.json();
      if (!json.success) throw new Error('Approval failed');
      pendingRequests.refresh();
      stats.refresh();
    } catch (e) {
      console.error('Error approving request:', e);
    } finally {
      setApproving(null);
    }
  };

  const handleDeny = async (callId: string) => {
    setApproving(callId);
    try {
      const res = await fetch(`${API_BASE}/deny-request/${callId}`, {
        method: 'POST',
        headers,
      });
      const json = await res.json();
      if (!json.success) throw new Error('Denial failed');
      pendingRequests.refresh();
      stats.refresh();
    } catch (e) {
      console.error('Error denying request:', e);
    } finally {
      setApproving(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Video Call Management</h1>
        <p className="text-sm text-gray-500 mt-1">Monitor and manage video calls and requests</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Pending Requests</p>
              <p className="text-3xl font-bold text-yellow-600 mt-1">
                {stats.loading ? '—' : stats.data?.pendingRequests ?? 0}
              </p>
            </div>
            {(stats.data?.pendingRequests ?? 0) > 0 && (
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500" />
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

      {/* Pending Approval Requests */}
      <Card padding="lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Pending Approval Requests</h2>
          <button
            onClick={pendingRequests.refresh}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            ↻ Refresh
          </button>
        </div>
        {pendingRequests.loading ? (
          <p className="text-center py-6 text-gray-400">Loading...</p>
        ) : !pendingRequests.data?.length ? (
          <p className="text-center py-6 text-gray-400">No pending requests</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="pb-2 font-medium">Person</th>
                  <th className="pb-2 font-medium">Contact</th>
                  <th className="pb-2 font-medium">Scheduled</th>
                  <th className="pb-2 font-medium">Type</th>
                  <th className="pb-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pendingRequests.data.map((req) => (
                  <tr key={req.id} className="hover:bg-gray-50">
                    <td className="py-3">
                      {req.incarceratedPerson.firstName} {req.incarceratedPerson.lastName}
                    </td>
                    <td className="py-3">
                      {req.familyMember.firstName} {req.familyMember.lastName}
                    </td>
                    <td className="py-3 text-gray-500">
                      {formatDate(req.scheduledStart)} {formatTime(req.scheduledStart)}
                    </td>
                    <td className="py-3">
                      {req.isLegal ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">Legal</span>
                      ) : (
                        <span className="text-gray-400 text-xs">Standard</span>
                      )}
                    </td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprove(req.id)}
                          disabled={approving === req.id}
                          className="px-3 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded disabled:opacity-50"
                        >
                          {approving === req.id ? '...' : 'Approve'}
                        </button>
                        <button
                          onClick={() => handleDeny(req.id)}
                          disabled={approving === req.id}
                          className="px-3 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded disabled:opacity-50"
                        >
                          Deny
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Active Video Calls */}
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
                    <td className="py-3 text-gray-500">{formatTime(call.actualStart || call.scheduledStart)}</td>
                    <td className="py-3 text-gray-500">
                      <LiveDuration startedAt={call.actualStart || call.scheduledStart} />
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
                    <th className="pb-2 font-medium">Scheduled</th>
                    <th className="pb-2 font-medium">Duration</th>
                    <th className="pb-2 font-medium">Type</th>
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
                      <td className="py-3 text-gray-500">
                        {formatDate(call.scheduledStart)} {formatTime(call.scheduledStart)}
                      </td>
                      <td className="py-3 text-gray-500">{formatDuration(call.durationSeconds)}</td>
                      <td className="py-3">
                        {call.isLegal ? (
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">Legal</span>
                        ) : (
                          <span className="text-gray-400 text-xs">Standard</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

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

export default function VideoAdmin() {
  return (
    <Routes>
      <Route index element={<VideoDashboard />} />
    </Routes>
  );
}
