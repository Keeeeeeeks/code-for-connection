import { useCallback, useMemo, useState } from "react";
import {
  Upload,
  Download,
  CheckCircle,
  AlertTriangle,
  XCircle,
  FileText,
  Loader2,
} from "lucide-react";
import { useDropzone } from "react-dropzone";
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
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type RowValidation = {
  row: number;
  data: Record<string, string>;
  status: "valid" | "warning" | "error";
  errors: { field: string; message: string }[];
};

type PreviewResponse = {
  fileName: string;
  fileSize: number;
  totalRows: number;
  valid: number;
  warnings: number;
  errors: number;
  validations: RowValidation[];
};

type ConfirmResponse = {
  imported: number;
  skipped: number;
  warnings: number;
  errors: { row: number; field: string; message: string }[];
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const CSV_TEMPLATE =
  "firstName,lastName,dateOfBirth,inmateId,pin,housingUnitName,clearanceLevel\n";

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "resident-import-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function BulkImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<ConfirmResponse | null>(null);
  const [activeTab, setActiveTab] = useState("all");

  /* ---- Dropzone ---- */
  const onDrop = useCallback((accepted: File[]) => {
    if (accepted.length > 0) {
      setFile(accepted[0]);
      setPreview(null);
      setResult(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"] },
    maxSize: 2 * 1024 * 1024,
    multiple: false,
    onDropRejected: (rejections) => {
      const msg = rejections[0]?.errors[0]?.message ?? "Invalid file";
      toast.error(msg);
    },
  });

  /* ---- Preview (upload + validate) ---- */
  async function handlePreview() {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const token = localStorage.getItem("token");
      const res = await fetch("/api/admin/residents/bulk-import/preview", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error?.message ?? "Preview failed");
        return;
      }
      setPreview(json.data);
    } catch {
      toast.error("Failed to preview file");
    } finally {
      setUploading(false);
    }
  }

  /* ---- Confirm import ---- */
  async function handleImport() {
    if (!file) return;
    setConfirmOpen(false);
    setImporting(true);
    setImportProgress(10);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const progressTimer = setInterval(() => {
        setImportProgress((p) => Math.min(p + 15, 90));
      }, 400);

      const token = localStorage.getItem("token");
      const res = await fetch("/api/admin/residents/bulk-import/confirm", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      clearInterval(progressTimer);
      setImportProgress(100);

      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error?.message ?? "Import failed");
        return;
      }

      setResult(json.data);
      toast.success(`Successfully imported ${json.data.imported} residents`);
    } catch {
      toast.error("Import failed");
    } finally {
      setImporting(false);
    }
  }

  /* ---- Reset ---- */
  function handleReset() {
    setFile(null);
    setPreview(null);
    setResult(null);
    setImportProgress(0);
    setActiveTab("all");
  }

  /* ---- Filtered validations ---- */
  const filteredRows = useMemo(() => {
    if (!preview) return [];
    if (activeTab === "all") return preview.validations;
    return preview.validations.filter((v) => v.status === activeTab);
  }, [preview, activeTab]);

  /* ================================================================ */
  /*  RENDER — Import complete                                         */
  /* ================================================================ */
  if (result) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Bulk Import</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Import Complete
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold text-green-600">
                    {result.imported}
                  </p>
                  <p className="text-sm text-muted-foreground">Imported</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold text-amber-600">
                    {result.warnings}
                  </p>
                  <p className="text-sm text-muted-foreground">Warnings</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold text-red-600">
                    {result.skipped}
                  </p>
                  <p className="text-sm text-muted-foreground">Skipped</p>
                </CardContent>
              </Card>
            </div>

            {result.errors.length > 0 && (
              <div className="rounded-md border p-4">
                <h3 className="font-medium mb-2">Skipped Rows</h3>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {result.errors.map((e, i) => (
                    <li key={i}>
                      Row {e.row}: {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Button onClick={handleReset}>Import Another File</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ================================================================ */
  /*  RENDER — Preview & Validation                                    */
  /* ================================================================ */
  if (preview) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Bulk Import</h1>
          <Button variant="outline" onClick={handleReset}>
            Cancel
          </Button>
        </div>

        {/* File info bar */}
        <div className="flex items-center gap-4 rounded-md border bg-muted/50 px-4 py-3 text-sm">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{preview.fileName}</span>
          <span className="text-muted-foreground">
            {preview.totalRows} rows
          </span>
          <span className="text-muted-foreground">
            {formatBytes(preview.fileSize)}
          </span>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{preview.valid}</p>
                <p className="text-sm text-muted-foreground">Valid</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-2xl font-bold">{preview.warnings}</p>
                <p className="text-sm text-muted-foreground">Warnings</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <XCircle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-2xl font-bold">{preview.errors}</p>
                <p className="text-sm text-muted-foreground">Errors</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs + table */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">
              All ({preview.totalRows})
            </TabsTrigger>
            <TabsTrigger value="valid">
              Valid ({preview.valid})
            </TabsTrigger>
            <TabsTrigger value="warning">
              Warnings ({preview.warnings})
            </TabsTrigger>
            <TabsTrigger value="error">
              Errors ({preview.errors})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Row</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Inmate ID</TableHead>
                    <TableHead>DOB</TableHead>
                    <TableHead>Housing Unit</TableHead>
                    <TableHead>Clearance</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                    <TableHead>Issues</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center py-8 text-muted-foreground"
                      >
                        No rows to display
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRows.map((v) => (
                      <TableRow key={v.row}>
                        <TableCell className="font-mono text-sm">
                          {v.row}
                        </TableCell>
                        <TableCell>
                          {v.data.firstName} {v.data.lastName}
                        </TableCell>
                        <TableCell className="font-mono">
                          {v.data.inmateId}
                        </TableCell>
                        <TableCell>{v.data.dateOfBirth}</TableCell>
                        <TableCell>{v.data.housingUnitName}</TableCell>
                        <TableCell>{v.data.clearanceLevel}</TableCell>
                        <TableCell>
                          {v.status === "valid" && (
                            <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                              Valid
                            </Badge>
                          )}
                          {v.status === "warning" && (
                            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                              Warning
                            </Badge>
                          )}
                          {v.status === "error" && (
                            <Badge variant="destructive">Error</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {v.errors.map((e) => e.message).join("; ")}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>

        {/* Import progress */}
        {importing && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Importing residents...
            </div>
            <Progress value={importProgress} />
          </div>
        )}

        {/* Import button */}
        {!importing && preview.valid > 0 && (
          <div className="flex justify-end">
            <Button onClick={() => setConfirmOpen(true)}>
              Import {preview.valid} Valid Records
            </Button>
          </div>
        )}

        {/* Confirmation dialog */}
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Import</DialogTitle>
              <DialogDescription>
                Import {preview.valid} records from {preview.fileName}? This
                action cannot be undone.
                {preview.errors > 0 && (
                  <span className="block mt-2">
                    {preview.errors} rows with errors will be skipped.
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setConfirmOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleImport}>
                Import {preview.valid} Records
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  /* ================================================================ */
  /*  RENDER — Upload (initial state)                                  */
  /* ================================================================ */
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Bulk Import</h1>
        <Button variant="outline" onClick={downloadTemplate}>
          <Download className="h-4 w-4 mr-2" />
          Download CSV Template
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Import Resident Profiles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload a CSV file to import resident profiles in bulk. Maximum 500
            rows, 2 MB file size.
          </p>

          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
              isDragActive
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50"
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
            {isDragActive ? (
              <p className="text-sm font-medium">Drop the CSV file here</p>
            ) : (
              <div>
                <p className="text-sm font-medium">
                  Drag and drop a CSV file here, or click to browse
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  .csv files only, max 2 MB
                </p>
              </div>
            )}
          </div>

          {/* Selected file info + preview button */}
          {file && (
            <div className="flex items-center justify-between rounded-md border bg-muted/50 px-4 py-3">
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{file.name}</span>
                <span className="text-sm text-muted-foreground">
                  {formatBytes(file.size)}
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFile(null);
                    setPreview(null);
                  }}
                >
                  Remove
                </Button>
                <Button
                  size="sm"
                  onClick={handlePreview}
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Validating...
                    </>
                  ) : (
                    "Validate & Preview"
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
