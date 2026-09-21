import { useState } from "react";

export type RfiPackageItem = {
  key: string;
  label: string;
  fileId?: number | null;
  attachment?: string | null;
  source?: string | null;
  include: boolean;
  order: number;
};

export type RfiImagePresentation = {
  sourceFileId?: number | null;
  replacementFileId?: number | null;
  sourceKind?: "viewpoint" | "upload" | "paste" | "screen-snip" | null;
  replacementKind?: "upload" | "paste" | "screen-snip" | null;
  showInRfi?: boolean;
  includeInCompletePdf?: boolean;
  crop?: { x: number; y: number; width: number; height: number } | null;
  reportScreenshots?: Array<{ fileId: number; kind: "upload" | "paste" | "screen-snip"; caption?: string | null; description?: string | null; include?: boolean; order: number }>;
} | null;

export type PendingImage = {
  file: File;
  url: string;
  mode: "source" | "replacement";
  kind: "upload" | "paste" | "screen-snip";
};

export type PendingImageInput = Omit<PendingImage, "url">;
export type CapturedFrame = { url: string; fileName: string };
export type RfiUploadResult = { name: string; state: "uploading" | "success" | "error"; message?: string };

export function useRfiCreateEvidenceState() {
  const [fileSearch, setFileSearch] = useState<string | null>(null);
  const [references, setReferences] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [packageItems, setPackageItems] = useState<RfiPackageItem[]>([]);
  const [imagePresentation, setImagePresentation] = useState<RfiImagePresentation>(null);
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [pendingImageQueue, setPendingImageQueue] = useState<PendingImageInput[]>([]);
  const [capturedFrame, setCapturedFrame] = useState<CapturedFrame | null>(null);
  const [savedImagePreviewUrl, setSavedImagePreviewUrl] = useState<string | null>(null);
  const [editingSavedImage, setEditingSavedImage] = useState(false);
  const [attachInput, setAttachInput] = useState("");
  const [uploadResults, setUploadResults] = useState<RfiUploadResult[]>([]);
  const [uploadingAtt, setUploadingAtt] = useState(false);

  return {
    fileSearch, setFileSearch,
    references, setReferences,
    attachments, setAttachments,
    packageItems, setPackageItems,
    imagePresentation, setImagePresentation,
    pendingImage, setPendingImage,
    pendingImageQueue, setPendingImageQueue,
    capturedFrame, setCapturedFrame,
    savedImagePreviewUrl, setSavedImagePreviewUrl,
    editingSavedImage, setEditingSavedImage,
    attachInput, setAttachInput,
    uploadResults, setUploadResults,
    uploadingAtt, setUploadingAtt,
  };
}
