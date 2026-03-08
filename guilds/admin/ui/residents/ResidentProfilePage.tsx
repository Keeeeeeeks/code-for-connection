import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  CalendarIcon,
  CopyIcon,
  KeyRoundIcon,
  UserMinusIcon,
  UserXIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

  const [isReleaseDialogOpen, setIsReleaseDialogOpen] = useState(false);
  const [releaseReason, setReleaseReason] = useState("");
  const [releaseDate, setReleaseDate] = useState<Date>(new Date());
  const [isSubmittingRelease, setIsSubmittingRelease] = useState(false);

  const [isPinDialogOpen, setIsPinDialogOpen] = useState(false);
  const [pinStep, setPinStep] = useState<1 | 2>(1);
  const [newPin, setNewPin] = useState<string | null>(null);
  const [isSubmittingPin, setIsSubmittingPin] = useState(false);

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

  const handleRelease = async () => {
    if (!id || !resident) {
      return;
    }

    const reason = releaseReason.trim();
    if (!reason) {
      toast.error("A reason is required to release this resident.");
      return;
    }

    const token = localStorage.getItem("token");

    if (!token) {
      toast.error("You are not authenticated. Please sign in again.");
      return;
    }

    setIsSubmittingRelease(true);

    try {
      const response = await fetch(`/api/admin/residents/${id}/release`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reason,
          releaseDate: releaseDate.toISOString(),
        }),
      });

      const payload = (await response.json()) as ApiResponse<ResidentProfile>;

      if (!response.ok || !payload.success) {
        const message = payload.success
          ? "Failed to release resident"
          : payload.error.message;
        throw new Error(message);
      }

      setResident((current) =>
        current
          ? {
              ...current,
              status: "released",
            }
          : current
      );

      setIsReleaseDialogOpen(false);
      setReleaseReason("");
      setReleaseDate(new Date());
      toast.success("Resident released successfully.");
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Unexpected error while releasing resident";
      toast.error(message);
    } finally {
      setIsSubmittingRelease(false);
    }
  };

  const handlePinDialogOpenChange = (open: boolean) => {
    if (open) {
      setPinStep(1);
      setNewPin(null);
      setIsPinDialogOpen(true);
      return;
    }

    setIsPinDialogOpen(false);
    setNewPin(null);
  };

  const handleGenerateNewPin = async () => {
    if (!id || !resident) {
      return;
    }

    const token = localStorage.getItem("token");

    if (!token) {
      toast.error("You are not authenticated. Please sign in again.");
      return;
    }

    setIsSubmittingPin(true);

    try {
      const response = await fetch(`/api/admin/residents/${id}/reset-pin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });

      const payload = (await response.json()) as ApiResponse<{ newPin: string }>;

      if (!response.ok || !payload.success) {
        const message = payload.success ? "Failed to reset PIN" : payload.error.message;
        throw new Error(message);
      }

      setNewPin(payload.data.newPin);
      setPinStep(2);
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Unexpected error while resetting PIN";
      toast.error(message);
    } finally {
      setIsSubmittingPin(false);
    }
  };

  const handleCopyPin = async () => {
    if (!newPin) {
      return;
    }

    try {
      await navigator.clipboard.writeText(newPin);
      toast.success("PIN copied to clipboard.");
    } catch {
      toast.error("Unable to copy PIN. Please copy it manually.");
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

        <div className="flex items-center gap-2">
          {resident.status === "active" ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setIsReleaseDialogOpen(true)}
            >
              <UserMinusIcon />
              Release
            </Button>
          ) : null}

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
            <CardTitle>PIN</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-3">
            <span className="font-medium">PIN: ••••</span>
            <Button type="button" variant="outline" onClick={() => handlePinDialogOpenChange(true)}>
              <KeyRoundIcon />
              Reset PIN
            </Button>
          </CardContent>
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

      <Dialog open={isReleaseDialogOpen} onOpenChange={setIsReleaseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Release Resident</DialogTitle>
            <DialogDescription>
              Communication access will be removed. Release date will be recorded.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="release-date" className="text-sm font-medium">
                Release date
              </label>
              <Popover>
                <PopoverTrigger
                  render={
                    <Button
                      id="release-date"
                      type="button"
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                      disabled={isSubmittingRelease}
                    />
                  }
                >
                  <CalendarIcon className="text-muted-foreground" />
                  {format(releaseDate, "PPP")}
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={releaseDate}
                    onSelect={(selectedDate) => {
                      if (selectedDate) {
                        setReleaseDate(selectedDate);
                      }
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label htmlFor="release-reason" className="text-sm font-medium">
                Reason
              </label>
              <Textarea
                id="release-reason"
                value={releaseReason}
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                  handleReasonChange(event, setReleaseReason)
                }
                placeholder="Document why this resident is being released"
                required
                disabled={isSubmittingRelease}
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />} disabled={isSubmittingRelease}>
              Cancel
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              onClick={handleRelease}
              disabled={isSubmittingRelease || !releaseReason.trim()}
            >
              {isSubmittingRelease ? "Releasing..." : "Confirm Release"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPinDialogOpen} onOpenChange={handlePinDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset PIN</DialogTitle>
            <DialogDescription>
              Generate a new resident PIN and securely communicate it immediately.
            </DialogDescription>
          </DialogHeader>

          {pinStep === 1 ? (
            <Alert variant="destructive">
              <AlertTriangleIcon />
              <AlertDescription>
                This will generate a new PIN. The old PIN will stop working immediately. You must
                communicate the new PIN to the resident.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              <div className="text-4xl font-mono tracking-widest text-center p-6 bg-muted rounded-lg">
                {newPin}
              </div>
              <Button type="button" variant="outline" className="w-full" onClick={handleCopyPin}>
                <CopyIcon />
                Copy to Clipboard
              </Button>
              <p className="text-sm text-muted-foreground">This PIN will not be shown again.</p>
            </div>
          )}

          <DialogFooter>
            {pinStep === 1 ? (
              <>
                <DialogClose render={<Button type="button" variant="outline" />} disabled={isSubmittingPin}>
                  Cancel
                </DialogClose>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleGenerateNewPin}
                  disabled={isSubmittingPin}
                >
                  {isSubmittingPin ? "Generating..." : "Generate New PIN"}
                </Button>
              </>
            ) : (
              <Button type="button" onClick={() => handlePinDialogOpenChange(false)}>
                Done
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
