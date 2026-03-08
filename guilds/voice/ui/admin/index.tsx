import { useCallback, useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Card } from '@openconnect/ui';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Loader2 } from 'lucide-react';

type VoiceCall = {
  id: string;
  status: string;
  isLegal: boolean;
  startedAt: string;
  durationSeconds: number | null;
  incarceratedPerson: { firstName: string; lastName: string };
  familyMember: { firstName: string; lastName: string };
  facility: { name: string };
};

function VoiceDashboard() {
  const [calls, setCalls] = useState<VoiceCall[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchActiveCalls = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    setIsRefreshing(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/monitoring/voice/active', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (response.ok && data.success) {
        setCalls(data.data.calls);
        setLastUpdated(data.data.fetchedAt);
      } else {
        setError(data.error?.message || 'Failed to fetch active calls');
      }
    } catch {
      setError('Network error while fetching active calls');
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchActiveCalls();
  }, [fetchActiveCalls]);

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Voice Call Management</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card padding="md">
          <div className="text-center">
            <p className="text-3xl font-bold text-blue-600">{calls.length}</p>
            <p className="text-sm text-gray-600">Active Calls</p>
          </div>
        </Card>
      </div>

      <Card padding="lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">Active Calls ({calls.length})</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void fetchActiveCalls()}
              disabled={isRefreshing}
            >
              {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </Button>
          </div>
          {lastUpdated && (
            <span className="text-sm text-gray-500">Last updated: {formatTime(lastUpdated)}</span>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 mb-4">{error}</div>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Resident</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Facility</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Started</TableHead>
              <TableHead>Legal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {calls.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-500">
                  No active calls at this time.
                </TableCell>
              </TableRow>
            ) : (
              calls.map((call) => (
                <TableRow key={call.id}>
                  <TableCell className="font-medium">
                    {call.incarceratedPerson.firstName} {call.incarceratedPerson.lastName}
                  </TableCell>
                  <TableCell>
                    {call.familyMember.firstName} {call.familyMember.lastName}
                  </TableCell>
                  <TableCell>{call.facility.name}</TableCell>
                  <TableCell>
                    <Badge variant={call.status === 'connected' ? 'default' : 'secondary'}>
                      {call.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatTime(call.startedAt)}</TableCell>
                  <TableCell>{call.isLegal ? 'Yes' : 'No'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Card padding="lg">
        <h2 className="text-lg font-semibold mb-4">Call History</h2>
        <div className="text-center py-8 text-gray-500">
          <p>Call history will be implemented in a future ticket.</p>
        </div>
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
