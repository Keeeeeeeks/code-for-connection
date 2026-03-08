import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { PencilIcon, SearchIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type ContactStatus = "pending" | "approved" | "denied" | "removed";
type ContactStatusFilter = ContactStatus | "all";
type Relationship =
  | "parent"
  | "sibling"
  | "spouse"
  | "child"
  | "friend"
  | "attorney"
  | "other";

type Contact = {
  id: string;
  relationship: string;
  status: ContactStatus;
  isAttorney: boolean;
  familyMember: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
  };
  incarceratedPerson: {
    id: string;
    firstName: string;
    lastName: string;
    facility: {
      name: string;
    };
  };
};

type ContactListResponse = {
  contacts: Contact[];
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

type UpdateContactPayload = {
  phone?: string;
  email?: string;
  relationship?: string;
};

const STATUS_OPTIONS: { label: string; value: ContactStatusFilter }[] = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Denied", value: "denied" },
  { label: "Removed", value: "removed" },
];

const RELATIONSHIP_OPTIONS: { label: string; value: Relationship }[] = [
  { label: "Parent", value: "parent" },
  { label: "Sibling", value: "sibling" },
  { label: "Spouse", value: "spouse" },
  { label: "Child", value: "child" },
  { label: "Friend", value: "friend" },
  { label: "Attorney", value: "attorney" },
  { label: "Other", value: "other" },
];

const PER_PAGE_OPTIONS = [10, 25, 50] as const;

const STATUS_LABEL: Record<ContactStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  denied: "Denied",
  removed: "Removed",
};

function contactName(contact: Contact) {
  return `${contact.familyMember.firstName} ${contact.familyMember.lastName}`;
}

function residentName(contact: Contact) {
  return `${contact.incarceratedPerson.firstName} ${contact.incarceratedPerson.lastName}`;
}

function statusBadge(status: ContactStatus) {
  if (status === "approved") {
    return <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">{STATUS_LABEL[status]}</Badge>;
  }

  if (status === "pending") {
    return <Badge variant="secondary">{STATUS_LABEL[status]}</Badge>;
  }

  if (status === "denied") {
    return <Badge variant="destructive">{STATUS_LABEL[status]}</Badge>;
  }

  return <Badge variant="outline">{STATUS_LABEL[status]}</Badge>;
}

function isValidStatusFilter(value: string): value is ContactStatusFilter {
  return value === "all" || value === "pending" || value === "approved" || value === "denied" || value === "removed";
}

function isValidRelationship(value: string): value is Relationship {
  return (
    value === "parent" ||
    value === "sibling" ||
    value === "spouse" ||
    value === "child" ||
    value === "friend" ||
    value === "attorney" ||
    value === "other"
  );
}

type EditContactModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact | null;
  onContactUpdated: (contact: Contact) => void;
};

function EditContactModal({ open, onOpenChange, contact, onContactUpdated }: EditContactModalProps) {
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [relationship, setRelationship] = useState<Relationship>("other");
  const [initialPhone, setInitialPhone] = useState("");
  const [initialEmail, setInitialEmail] = useState("");
  const [initialRelationship, setInitialRelationship] = useState<Relationship>("other");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!contact || !open) {
      return;
    }

    const contactRelationship = isValidRelationship(contact.relationship)
      ? contact.relationship
      : contact.isAttorney
        ? "attorney"
        : "other";

    setPhone(contact.familyMember.phone ?? "");
    setEmail(contact.familyMember.email ?? "");
    setRelationship(contactRelationship);
    setInitialPhone(contact.familyMember.phone ?? "");
    setInitialEmail(contact.familyMember.email ?? "");
    setInitialRelationship(contactRelationship);
  }, [contact, open]);

  const hasChanges =
    phone.trim() !== initialPhone.trim() ||
    email.trim() !== initialEmail.trim() ||
    relationship !== initialRelationship;

  const handleSubmit = async () => {
    if (!contact || !hasChanges) {
      return;
    }

    const token = localStorage.getItem("token");

    if (!token) {
      toast.error("You are not authenticated. Please sign in again.");
      return;
    }

    const payload: UpdateContactPayload = {};
    if (phone.trim() !== initialPhone.trim()) {
      payload.phone = phone.trim();
    }
    if (email.trim() !== initialEmail.trim()) {
      payload.email = email.trim();
    }
    if (relationship !== initialRelationship) {
      payload.relationship = relationship;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`/api/admin/contacts/${contact.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const responseData = (await response.json()) as ApiResponse<Contact>;

      if (!response.ok || !responseData.success) {
        const message = responseData.success ? "Failed to update contact" : responseData.error.message;
        throw new Error(message);
      }

      onContactUpdated(responseData.data);
      toast.success("Contact updated successfully.");
      onOpenChange(false);
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : "Unexpected error while updating contact";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Contact</DialogTitle>
          <DialogDescription>Update contact details and relationship for approved contact access.</DialogDescription>
        </DialogHeader>

        {contact ? (
          <div className="grid gap-4">
            <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="contact-first-name">First Name</Label>
                <Input id="contact-first-name" value={contact.familyMember.firstName} disabled />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact-last-name">Last Name</Label>
                <Input id="contact-last-name" value={contact.familyMember.lastName} disabled />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contact-phone">Phone</Label>
              <Input
                id="contact-phone"
                value={phone}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setPhone(event.target.value)}
                placeholder="(555) 555-5555"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contact-email">Email</Label>
              <Input
                id="contact-email"
                type="email"
                value={email}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setEmail(event.target.value)}
                placeholder="name@example.com"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contact-relationship">Relationship</Label>
              <Select
                value={relationship}
                onValueChange={(value: string | null) => {
                  if (value && isValidRelationship(value)) {
                    setRelationship(value);
                  }
                }}
              >
                <SelectTrigger id="contact-relationship" className="w-full">
                  <SelectValue placeholder="Select relationship" />
                </SelectTrigger>
                <SelectContent>
                  {RELATIONSHIP_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={!hasChanges || isSaving || !contact}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ContactListPage() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ContactStatusFilter>("all");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<(typeof PER_PAGE_OPTIONS)[number]>(25);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    const controller = new AbortController();

    const fetchContacts = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        setError("You are not authenticated. Please sign in again.");
        setContacts([]);
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

        const response = await fetch(`/api/admin/contacts?${params.toString()}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        const responseData = (await response.json()) as ApiResponse<ContactListResponse>;

        if (!response.ok || !responseData.success) {
          const message = responseData.success ? "Failed to fetch contacts" : responseData.error.message;
          throw new Error(message);
        }

        setContacts(responseData.data.contacts);
        setTotal(responseData.data.pagination.total);
        setTotalPages(Math.max(1, responseData.data.pagination.totalPages));
      } catch (fetchError) {
        if (controller.signal.aborted) {
          return;
        }

        const message = fetchError instanceof Error ? fetchError.message : "Unexpected error while loading contacts";
        setError(message);
        setContacts([]);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    void fetchContacts();

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
        <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
        <p className="text-sm text-muted-foreground">
          Manage contact relationships for residents and keep approved contact details up to date.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Approved Contact Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative w-full lg:max-w-lg">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setSearchInput(event.target.value)}
                placeholder="Search by contact name or email"
                className="pl-8"
                aria-label="Search contacts"
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Select
                value={status}
                onValueChange={(value: string | null) => {
                  if (!value || !isValidStatusFilter(value)) {
                    return;
                  }

                  setStatus(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full sm:w-40">
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
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          ) : null}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contact Name</TableHead>
                <TableHead>Resident</TableHead>
                <TableHead>Facility</TableHead>
                <TableHead>Relationship</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    Loading contacts...
                  </TableCell>
                </TableRow>
              ) : null}

              {!isLoading && contacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No contacts found for the current filters.
                  </TableCell>
                </TableRow>
              ) : null}

              {!isLoading
                ? contacts.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell className="font-medium">{contactName(contact)}</TableCell>
                      <TableCell>{residentName(contact)}</TableCell>
                      <TableCell>{contact.incarceratedPerson.facility.name}</TableCell>
                      <TableCell className="capitalize">{contact.relationship}</TableCell>
                      <TableCell>{contact.familyMember.phone || "-"}</TableCell>
                      <TableCell>{contact.familyMember.email || "-"}</TableCell>
                      <TableCell>{statusBadge(contact.status)}</TableCell>
                      <TableCell className="text-right">
                        {contact.status === "approved" ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingContact(contact);
                              setIsEditModalOpen(true);
                            }}
                          >
                            <PencilIcon />
                            Edit
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
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

      <EditContactModal
        open={isEditModalOpen}
        onOpenChange={(open) => {
          setIsEditModalOpen(open);
          if (!open) {
            setEditingContact(null);
          }
        }}
        contact={editingContact}
        onContactUpdated={(updatedContact) => {
          setContacts((current) =>
            current.map((contact) => (contact.id === updatedContact.id ? updatedContact : contact))
          );
          setEditingContact(updatedContact);
        }}
      />
    </div>
  );
}
