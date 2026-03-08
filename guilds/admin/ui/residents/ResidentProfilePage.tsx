import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeftIcon, UserXIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ResidentStatus = "active" | "deactivated" | "released" | "transferred";

type ApprovedContact = {
  id: string;
  relationship: string;
  status: "pending" | "approved" | "denied" | "removed";
  familyMember: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    email: string | null;
  };
};

type ResidentProfile = {
  id: string;
  firstName: string;
  lastName: string;
  externalId: string | null;
  admittedAt: string;
  status: ResidentStatus;
  facility: { id: string; name: string } | null;
  housingUnit: {
    id: string;
    name: string;
    unitType: { name: string; clearanceLevel: string } | null;
  } | null;
  approvedContacts: ApprovedContact[];
};

type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

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

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function handleReasonChange(
  event: ChangeEvent<HTMLTextAreaElement>,
  setDeactivateReason: (value: string) => void
) {
  setDeactivateReason(event.target.value);
}

export default function ResidentProfilePage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [resident, setResident] = useState<ResidentProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isDeactivateDialogOpen, setIsDeactivateDialogOpen] = useState(false);
  const [deactivateReason, setDeactivateReason] = useState("");
  const [isSubmittingDeactivate, setIsSubmittingDeactivate] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    const fetchResident = async () => {
      if (!id) {
        setError("Resident ID is missing from the URL.");
        setIsLoading(false);
        return;
      }

      const token = localStorage.getItem("token");

      if (!token) {
        setError("You are not authenticated. Please sign in again.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/admin/residents/${id}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        const payload = (await response.json()) as ApiResponse<ResidentProfile>;

        if (!response.ok || !payload.success) {
          const message = payload.success
            ? "Failed to fetch resident profile"
            : payload.error.message;
          throw new Error(message);
        }

        setResident(payload.data);
      } catch (fetchError) {
        if (controller.signal.aborted) {
          return;
        }

        const message =
          fetchError instanceof Error
            ? fetchError.message
            : "Unexpected error while loading resident profile";
        setError(message);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    void fetchResident();

    return () => controller.abort();
  }, [id]);

  const residentName = useMemo(() => {
    if (!resident) {
      return "Resident";
    }

    return `${resident.firstName} ${resident.lastName}`;
  }, [resident]);

  const handleDeactivate = async () => {
    if (!id || !resident) {
      return;
    }

    const reason = deactivateReason.trim();
    if (!reason) {
      toast.error("A reason is required to deactivate this resident.");
      return;
    }

    const token = localStorage.getItem("token");

    if (!token) {
      toast.error("You are not authenticated. Please sign in again.");
      return;
    }

    setIsSubmittingDeactivate(true);

    try {
      const response = await fetch(`/api/admin/residents/${id}/deactivate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason }),
      });

      const payload = (await response.json()) as ApiResponse<ResidentProfile>;

      if (!response.ok || !payload.success) {
        const message = payload.success
          ? "Failed to deactivate resident"
          : payload.error.message;
        throw new Error(message);
      }

      setResident((current) =>
        current
          ? {
              ...current,
              status: "deactivated",
            }
          : current
      );

      setIsDeactivateDialogOpen(false);
      setDeactivateReason("");
      toast.success("Resident deactivated successfully.");
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Unexpected error while deactivating resident";
      toast.error(message);
    } finally {
      setIsSubmittingDeactivate(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">Loading resident profile...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
        <Button type="button" variant="outline" onClick={() => navigate("/admin/residents")}>
          Back to Residents
        </Button>
      </div>
    );
  }

  if (!resident) {
    return (
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">Resident not found.</p>
        <Button type="button" variant="outline" onClick={() => navigate("/admin/residents")}>
          Back to Residents
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Button type="button" variant="ghost" className="w-fit" onClick={() => navigate("/admin/residents")}>
            <ArrowLeftIcon />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{residentName}</h1>
            {statusBadge(resident.status)}
          </div>
          <Link className="text-sm text-muted-foreground hover:underline" to="/admin/residents">
            Return to resident list
          </Link>
        </div>

        {resident.status !== "deactivated" ? (
          <Button
            type="button"
            variant="destructive"
            onClick={() => setIsDeactivateDialogOpen(true)}
          >
            <UserXIcon />
            Deactivate
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Facility</CardTitle>
          </CardHeader>
          <CardContent>{resident.facility?.name ?? "-"}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Housing Unit</CardTitle>
          </CardHeader>
          <CardContent>{resident.housingUnit?.name ?? "-"}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Security Level</CardTitle>
          </CardHeader>
          <CardContent>{resident.housingUnit?.unitType?.clearanceLevel ?? "-"}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Admitted Date</CardTitle>
          </CardHeader>
          <CardContent>{formatDate(resident.admittedAt)}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>External ID</CardTitle>
          </CardHeader>
          <CardContent>{resident.externalId ?? "-"}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Approved Contacts</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Relationship</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resident.approvedContacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No approved contacts on file.
                  </TableCell>
                </TableRow>
              ) : (
                resident.approvedContacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell className="font-medium">
                      {contact.familyMember.firstName} {contact.familyMember.lastName}
                    </TableCell>
                    <TableCell>{contact.relationship}</TableCell>
                    <TableCell>{contact.familyMember.phone ?? "-"}</TableCell>
                    <TableCell>{contact.familyMember.email ?? "-"}</TableCell>
                    <TableCell className="capitalize">{contact.status}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDeactivateDialogOpen} onOpenChange={setIsDeactivateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate Resident</DialogTitle>
            <DialogDescription>
              Communication access will be removed. Records are preserved. This is reversible.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label htmlFor="deactivation-reason" className="text-sm font-medium">
              Reason
            </label>
            <Textarea
              id="deactivation-reason"
              value={deactivateReason}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                handleReasonChange(event, setDeactivateReason)
              }
              placeholder="Document why this resident is being deactivated"
              required
              disabled={isSubmittingDeactivate}
            />
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />} disabled={isSubmittingDeactivate}>
              Cancel
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeactivate}
              disabled={isSubmittingDeactivate || !deactivateReason.trim()}
            >
              {isSubmittingDeactivate ? "Deactivating..." : "Confirm Deactivation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
