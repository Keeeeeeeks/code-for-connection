import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { SearchIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ResidentStatus = "active" | "deactivated" | "released" | "transferred";
type ResidentStatusFilter = ResidentStatus | "all";

type Resident = {
  id: string;
  firstName: string;
  lastName: string;
  externalId: string | null;
  status: ResidentStatus;
  facility: { id: string; name: string } | null;
  housingUnit: {
    id: string;
    name: string;
    unitType: { name: string; clearanceLevel: string } | null;
  } | null;
};

type ResidentListResponse = {
  residents: Resident[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
};

type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

const STATUS_OPTIONS: { label: string; value: ResidentStatusFilter }[] = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Released", value: "released" },
  { label: "Deactivated", value: "deactivated" },
  { label: "Transferred", value: "transferred" },
];

const PER_PAGE_OPTIONS = [10, 25, 50] as const;

const statusLabel: Record<ResidentStatus, string> = {
  active: "Active",
  deactivated: "Deactivated",
  released: "Released",
  transferred: "Transferred",
};

function statusBadge(status: ResidentStatus) {
  if (status === "deactivated") {
    return <Badge variant="destructive">{statusLabel[status]}</Badge>;
  }

  if (status === "released") {
    return <Badge variant="secondary">{statusLabel[status]}</Badge>;
  }

  if (status === "transferred") {
    return <Badge variant="outline">{statusLabel[status]}</Badge>;
  }

  return (
    <Badge variant="default" className="bg-emerald-600 text-white hover:bg-emerald-600">
      {statusLabel[status]}
    </Badge>
  );
}

function residentFullName(resident: Resident) {
  return `${resident.firstName} ${resident.lastName}`;
}

function handleSearchInputChange(
  event: ChangeEvent<HTMLInputElement>,
  setSearchInput: (value: string) => void
) {
  setSearchInput(event.target.value);
}

export default function ResidentListPage() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ResidentStatusFilter>("all");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<(typeof PER_PAGE_OPTIONS)[number]>(25);

  const [residents, setResidents] = useState<Resident[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    const controller = new AbortController();

    const fetchResidents = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        setError("You are not authenticated. Please sign in again.");
        setResidents([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          status,
          search,
          page: String(page),
          perPage: String(perPage),
        });

        const response = await fetch(`/api/admin/residents?${params.toString()}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        const payload = (await response.json()) as ApiResponse<ResidentListResponse>;

        if (!response.ok || !payload.success) {
          const message = payload.success
            ? "Failed to fetch residents"
            : payload.error.message;
          throw new Error(message);
        }

        setResidents(payload.data.residents);
        setTotal(payload.data.pagination.total);
        setTotalPages(Math.max(1, payload.data.pagination.totalPages));
      } catch (fetchError) {
        if (controller.signal.aborted) {
          return;
        }

        const message =
          fetchError instanceof Error
            ? fetchError.message
            : "Unexpected error while loading residents";
        setError(message);
        setResidents([]);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    void fetchResidents();

    return () => controller.abort();
  }, [status, search, page, perPage]);

  const pageInfo = useMemo(() => {
    const start = total === 0 ? 0 : (page - 1) * perPage + 1;
    const end = Math.min(total, page * perPage);
    return `${start}-${end} of ${total}`;
  }, [page, perPage, total]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Residents</h1>
        <p className="text-sm text-muted-foreground">
          Search by resident name or external ID, then filter by lifecycle status.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resident Directory</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative w-full lg:max-w-lg">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  handleSearchInputChange(event, setSearchInput)
                }
                placeholder="Search by name or external ID"
                className="pl-8"
                aria-label="Search residents"
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Select
                value={status}
                onValueChange={(value: string | null) => {
                  if (!value) {
                    return;
                  }

                  if (
                    value === "all" ||
                    value === "active" ||
                    value === "released" ||
                    value === "deactivated" ||
                    value === "transferred"
                  ) {
                    setStatus(value);
                  }
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={String(perPage)}
                onValueChange={(value: string | null) => {
                  if (!value) {
                    return;
                  }

                  const parsed = Number(value);
                  if (parsed === 10 || parsed === 25 || parsed === 50) {
                    setPerPage(parsed);
                    setPage(1);
                  }
                }}
              >
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue placeholder="Per page" />
                </SelectTrigger>
                <SelectContent>
                  {PER_PAGE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={String(option)}>
                      {option} per page
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>External ID</TableHead>
                <TableHead>Facility</TableHead>
                <TableHead>Housing Unit</TableHead>
                <TableHead>Security Level</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Loading residents...
                  </TableCell>
                </TableRow>
              ) : null}

              {!isLoading && residents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No residents found for the current filters.
                  </TableCell>
                </TableRow>
              ) : null}

              {!isLoading
                ? residents.map((resident) => (
                    <TableRow key={resident.id}>
                      <TableCell>
                        <Link
                          className="font-medium text-foreground hover:underline"
                          to={`/admin/residents/${resident.id}`}
                        >
                          {residentFullName(resident)}
                        </Link>
                      </TableCell>
                      <TableCell>{resident.externalId ?? "-"}</TableCell>
                      <TableCell>{resident.facility?.name ?? "-"}</TableCell>
                      <TableCell>{resident.housingUnit?.name ?? "-"}</TableCell>
                      <TableCell>{resident.housingUnit?.unitType?.clearanceLevel ?? "-"}</TableCell>
                      <TableCell>{statusBadge(resident.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" render={<Link to={`/admin/residents/${resident.id}`} />}>
                          View Profile
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                : null}
            </TableBody>
          </Table>

          <div className="flex flex-col justify-between gap-3 border-t pt-4 text-sm sm:flex-row sm:items-center">
            <p className="text-muted-foreground">Showing {pageInfo}</p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1 || isLoading}
              >
                Previous
              </Button>
              <span className="text-muted-foreground">
                Page {page} of {Math.max(totalPages, 1)}
              </span>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page >= totalPages || isLoading}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
