import { useState } from "react";
import { useListFiles, useUploadFile, useDeleteFile } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Upload, Trash2, FileText, AlertCircle, X, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

interface ValidationDetail {
  field: string;
  message: string;
  expected?: string[];
  received: string;
}

interface ApiError {
  data?: { error?: string; details?: ValidationDetail[] };
  response?: { data?: { error?: string; details?: ValidationDetail[] } };
  message?: string;
}

const statusColors: Record<string, string> = {
  active:   "status-open",
  pending:  "status-pending",
  archived: "status-closed",
};

export function FilesTab({ projectId, canWrite = true }: { projectId: number; canWrite?: boolean }) {
  const { t } = useI18n();
  const { data: files, isLoading } = useListFiles(projectId);
  const [showUpload, setShowUpload] = useState(false);

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-foreground text-xl">{t('project.tabs.files')}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{files?.length ?? 0} file{(files?.length ?? 0) !== 1 ? 's' : ''}</p>
        </div>
        {canWrite && !showUpload && (
          <Button size="sm" onClick={() => setShowUpload(true)} className="gap-2">
            <Upload className="w-4 h-4" />
            {t('files.upload')}
          </Button>
        )}
      </div>

      {/* Upload form */}
      {showUpload && (
        <UploadForm projectId={projectId} onClose={() => setShowUpload(false)} />
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-2">
          {[1,2,3].map(i => (
            <div key={i} className="h-14 bg-secondary/60 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {/* Table */}
      {!isLoading && (
        <>
          {files && files.length > 0 ? (
            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-secondary/60 border-b border-border">
                    <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">{t('files.name')}</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">{t('files.version')}</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">{t('files.status')}</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">{t('files.uploader')}</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">{t('files.date')}</th>
                    {canWrite && <th className="text-xs font-semibold text-muted-foreground px-4 py-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {files.map((file) => (
                    <tr key={file.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <FileText className="w-4 h-4 text-primary" />
                          </div>
                          <span className="font-mono text-xs text-foreground font-medium">{file.fileName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">v{file.version}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-md border ${statusColors[file.status] ?? 'status-pending'}`}>
                          {file.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <div className="text-sm text-foreground">{file.uploadedByName}</div>
                          <div className="text-xs text-muted-foreground">{file.uploadedByCompany}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {format(new Date(file.createdAt), 'MMM d, yyyy HH:mm')}
                      </td>
                      {canWrite && (
                        <td className="px-4 py-3 text-right">
                          <DeleteFileButton projectId={projectId} fileId={file.id} />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="surface py-16 text-center border-dashed">
              <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">{t('files.empty')}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function UploadForm({ projectId, onClose }: { projectId: number; onClose: () => void }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [fileName, setFileName] = useState('');
  const [errorDetails, setErrorDetails] = useState<ValidationDetail[]>([]);
  const [success, setSuccess] = useState(false);

  const { mutate, isPending } = useUploadFile({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/files`] });
        queryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/activity`] });
        setSuccess(true);
        setTimeout(() => { onClose(); }, 1200);
      },
      onError: (err: ApiError) => {
        const errorData = err.data || err.response?.data;
        if (errorData?.details) {
          setErrorDetails(errorData.details);
        } else {
          toast({ title: t('common.error'), description: errorData?.error || err.message, variant: "destructive" });
        }
      }
    }
  });

  return (
    <div className="surface p-5 border border-border">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="font-semibold text-foreground text-sm">{t('files.simulate')}</h4>
          <p className="text-xs text-muted-foreground mt-0.5">{t('files.simulateHint')}</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-border transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex gap-3">
        <Input
          className="flex-1 font-mono text-sm"
          placeholder={t('files.placeholder')}
          value={fileName}
          onChange={e => { setFileName(e.target.value); setErrorDetails([]); setSuccess(false); }}
        />
        <Button
          size="sm"
          disabled={!fileName || isPending || success}
          onClick={() => mutate({ projectId, data: { fileName, fileSize: 1024, fileType: 'application/pdf' } })}
        >
          {success ? <CheckCircle2 className="w-4 h-4" /> : isPending ? '...' : t('files.testUpload')}
        </Button>
      </div>

      {errorDetails.length > 0 && (
        <div className="mt-4 p-4 rounded-lg bg-destructive/5 border border-destructive/20">
          <div className="flex items-center gap-2 text-destructive text-sm font-semibold mb-3">
            <AlertCircle className="w-4 h-4" />
            {t('files.namingViolation')}
          </div>
          <ul className="space-y-2">
            {errorDetails.map((detail, idx) => (
              <li key={idx} className="text-xs text-destructive/90">
                <span className="font-semibold">{detail.field}:</span> {detail.message}
                {detail.expected && (
                  <div className="mt-1 text-muted-foreground">
                    Allowed: {detail.expected.map(v => (
                      <span key={v} className="inline-block bg-secondary border border-border rounded px-1.5 py-0.5 font-mono mr-1 mb-1">{v}</span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function DeleteFileButton({ projectId, fileId }: { projectId: number; fileId: number }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { mutate, isPending } = useDeleteFile({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/files`] });
        queryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/activity`] });
        toast({ title: t('files.deleted') });
      }
    }
  });

  return (
    <button
      disabled={isPending}
      onClick={() => { if (confirm(t('files.deleteConfirm'))) mutate({ projectId, fileId }); }}
      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}
