import { useState } from "react";
import { useListFiles, useUploadFile, useDeleteFile } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Upload, Trash2, File, AlertCircle } from "lucide-react";
import { format } from "date-fns";

export function FilesTab({ projectId }: { projectId: number }) {
  const { t } = useI18n();
  const { data: files, isLoading } = useListFiles(projectId);
  const [showUpload, setShowUpload] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-display font-bold text-white">{t('project.tabs.files')}</h3>
        <Button onClick={() => setShowUpload(!showUpload)}>
          <Upload className="w-4 h-4 mr-2" />
          {t('files.upload')}
        </Button>
      </div>

      {showUpload && <UploadForm projectId={projectId} onClose={() => setShowUpload(false)} />}

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">{t('common.loading')}</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm text-left">
            <thead className="bg-card text-muted-foreground text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-4">{t('files.name')}</th>
                <th className="px-6 py-4">Version</th>
                <th className="px-6 py-4">{t('files.status')}</th>
                <th className="px-6 py-4">{t('files.uploader')}</th>
                <th className="px-6 py-4">{t('files.date')}</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {files?.map((file) => (
                <tr key={file.id} className="hover:bg-card/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-white flex items-center">
                    <File className="w-4 h-4 mr-2 text-primary" />
                    {file.fileName}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">v{file.version}</td>
                  <td className="px-6 py-4">
                    <Badge variant="outline">{file.status}</Badge>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{file.uploadedByName}</td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {format(new Date(file.createdAt), 'MMM d, yyyy HH:mm')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <DeleteFileButton projectId={projectId} fileId={file.id} />
                  </td>
                </tr>
              ))}
              {files?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    No files uploaded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function UploadForm({ projectId, onClose }: { projectId: number, onClose: () => void }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [fileName, setFileName] = useState('');
  const [errorDetails, setErrorDetails] = useState<any[]>([]);

  const { mutate, isPending } = useUploadFile({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/files`] });
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/activity`] });
        toast({ title: t('common.success') });
        onClose();
      },
      onError: (err: any) => {
        const errorData = err.data || err.response?.data;
        if (errorData?.details) {
           setErrorDetails(errorData.details);
        } else {
           toast({ title: t('common.error'), description: errorData?.error || err.message || "Upload failed", variant: "destructive" });
        }
      }
    }
  });

  return (
    <div className="bg-card/50 p-6 rounded-xl border border-border mb-6">
      <h4 className="font-semibold text-white mb-4">Simulate File Upload</h4>
      <p className="text-xs text-muted-foreground mb-4">
        Enter a file name exactly matching the project's naming convention to test strict validation.
      </p>
      
      <div className="flex space-x-4">
        <div className="flex-1">
          <Input 
            placeholder="e.g., PRJ-ARC-FL1-DWG-001.pdf" 
            value={fileName}
            onChange={(e) => { setFileName(e.target.value); setErrorDetails([]); }}
          />
        </div>
        <Button 
          disabled={!fileName || isPending}
          onClick={() => mutate({ projectId, data: { fileName, fileSize: 1024, fileType: 'application/pdf' } })}
        >
          {isPending ? 'Uploading...' : 'Test Upload'}
        </Button>
      </div>

      {errorDetails.length > 0 && (
        <div className="mt-4 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
          <div className="flex items-center text-destructive font-semibold mb-2">
            <AlertCircle className="w-4 h-4 mr-2" />
            Naming Convention Violation
          </div>
          <ul className="text-sm text-destructive/90 space-y-1 list-disc pl-5">
            {errorDetails.map((detail, idx) => (
              <li key={idx}>
                <strong>{detail.field}:</strong> {detail.message} 
                {detail.expected && ` (Expected one of: ${detail.expected.join(', ')})`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function DeleteFileButton({ projectId, fileId }: { projectId: number, fileId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { mutate, isPending } = useDeleteFile({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/files`] });
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/activity`] });
        toast({ title: "File deleted" });
      }
    }
  });

  return (
    <Button 
      variant="ghost" 
      size="icon" 
      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
      disabled={isPending}
      onClick={() => {
        if(confirm("Are you sure you want to delete this file?")) {
          mutate({ projectId, fileId });
        }
      }}
    >
      <Trash2 className="w-4 h-4" />
    </Button>
  );
}
