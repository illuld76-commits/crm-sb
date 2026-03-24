import { useState, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ZoomIn, ZoomOut, RotateCcw, RotateCw, ChevronLeft, ChevronRight,
  Download, Link2, ExternalLink, FileText, Box, Music, X, ChevronDown, ChevronUp
} from 'lucide-react';
import { toast } from 'sonner';

export interface PreviewFile {
  name: string;
  url: string;
  type: string;
  size: number;
  category?: string;
  uploadedBy?: string;
  uploadedAt?: string;
}

interface FilePreviewModalProps {
  file: PreviewFile | null;
  allFiles?: PreviewFile[];
  isOpen: boolean;
  onClose: () => void;
  onCategoryChange?: (fileUrl: string, category: string) => void;
}

const CATEGORIES = [
  'Clinical Photo', 'X-Ray / CBCT', 'STL Scan', 'OPG', 'Prescription',
  'Consent Form', 'Invoice / Receipt', 'Lab Report', 'Other'
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileTypeLabel(type: string, name: string): string {
  if (type.startsWith('image/')) return type.replace('image/', '').toUpperCase() + ' Image';
  if (type === 'application/pdf') return 'PDF Document';
  if (type.startsWith('video/')) return 'Video';
  if (type.startsWith('audio/')) return 'Audio';
  if (name.endsWith('.stl')) return 'STL 3D Model';
  return type || 'Unknown';
}

export default function FilePreviewModal({ file, allFiles, isOpen, onClose, onCategoryChange }: FilePreviewModalProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [metaOpen, setMetaOpen] = useState(false);

  const isImage = file?.type?.startsWith('image/');
  const isPdf = file?.type === 'application/pdf';
  const isVideo = file?.type?.startsWith('video/');
  const isAudio = file?.type?.startsWith('audio/');
  const isStl = file?.name?.toLowerCase().endsWith('.stl');

  const imageFiles = allFiles?.filter(f => f.type?.startsWith('image/'));
  const currentIndex = imageFiles && file ? imageFiles.findIndex(f => f.url === file.url) : -1;
  const hasGallery = imageFiles && imageFiles.length > 1 && currentIndex >= 0;

  const resetTransform = useCallback(() => { setZoom(1); setRotation(0); }, []);

  const navigateImage = useCallback((dir: number) => {
    if (!imageFiles || currentIndex < 0) return;
    const next = currentIndex + dir;
    if (next >= 0 && next < imageFiles.length) {
      // We can't change file directly — caller should handle via allFiles
    }
  }, [imageFiles, currentIndex]);

  if (!file) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { resetTransform(); onClose(); } }}>
      <DialogContent className="max-w-full h-full md:max-w-4xl md:max-h-[90vh] p-0 gap-0 flex flex-col md:flex-row overflow-hidden">
        {/* Preview Area */}
        <div className="flex-1 flex flex-col min-h-0 bg-muted/30">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b bg-background">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-sm font-medium truncate max-w-[240px]">{file.name}</span>
              </TooltipTrigger>
              <TooltipContent>{file.name}</TooltipContent>
            </Tooltip>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { resetTransform(); onClose(); }}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 flex items-center justify-center overflow-hidden p-4 relative">
            {isImage && (
              <>
                <img
                  src={file.url}
                  alt={file.name}
                  className="max-h-[70vh] object-contain transition-transform duration-200"
                  style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
                />
                {hasGallery && currentIndex > 0 && (
                  <Button variant="secondary" size="icon" className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full opacity-80 hover:opacity-100" onClick={() => navigateImage(-1)}>
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                )}
                {hasGallery && currentIndex < imageFiles!.length - 1 && (
                  <Button variant="secondary" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full opacity-80 hover:opacity-100" onClick={() => navigateImage(1)}>
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                )}
                {hasGallery && (
                  <Badge variant="secondary" className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs">
                    {currentIndex + 1} / {imageFiles!.length}
                  </Badge>
                )}
              </>
            )}

            {isPdf && (
              <iframe src={file.url} className="w-full h-[70vh] border-0 rounded-lg" title={file.name} />
            )}

            {isVideo && (
              <video controls src={file.url} className="w-full max-h-[60vh] rounded-lg" />
            )}

            {isAudio && (
              <div className="flex flex-col items-center gap-4">
                <Music className="h-16 w-16 text-muted-foreground" />
                <audio controls src={file.url} className="w-full max-w-md" />
              </div>
            )}

            {isStl && (
              <div className="flex flex-col items-center gap-3 text-center">
                <Box className="h-16 w-16 text-muted-foreground" />
                <p className="font-medium">3D File — STL format</p>
                <p className="text-sm text-muted-foreground">Cannot preview in browser</p>
                <Button onClick={() => window.open(file.url, '_blank')}>
                  <ExternalLink className="h-4 w-4 mr-2" /> Open in New Tab
                </Button>
              </div>
            )}

            {!isImage && !isPdf && !isVideo && !isAudio && !isStl && (
              <div className="flex flex-col items-center gap-3 text-center">
                <FileText className="h-16 w-16 text-muted-foreground" />
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">{formatFileSize(file.size)} · {file.type}</p>
                <Button onClick={() => window.open(file.url)}>
                  <Download className="h-4 w-4 mr-2" /> Download File
                </Button>
              </div>
            )}
          </div>

          {/* Image Controls */}
          {isImage && (
            <div className="flex items-center justify-center gap-1 p-2 border-t bg-background">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(z => Math.min(z + 0.25, 3))}>
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(z => Math.max(z - 0.25, 0.25))}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={resetTransform}>
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRotation(r => r - 90)}>
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRotation(r => r + 90)}>
                <RotateCw className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Metadata Panel — desktop: right side, mobile: collapsible bottom */}
        <div className="md:w-[260px] border-t md:border-t-0 md:border-l bg-background">
          <button
            className="md:hidden w-full flex items-center justify-between p-3 text-sm font-medium"
            onClick={() => setMetaOpen(!metaOpen)}
          >
            File Details
            {metaOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          <div className={`${metaOpen ? '' : 'hidden'} md:block p-4 space-y-4`}>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Filename</p>
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="text-sm font-medium truncate">{file.name}</p>
                </TooltipTrigger>
                <TooltipContent>{file.name}</TooltipContent>
              </Tooltip>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Size</p>
                <p className="text-sm">{formatFileSize(file.size)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Type</p>
                <p className="text-sm">{getFileTypeLabel(file.type, file.name)}</p>
              </div>
            </div>

            {onCategoryChange && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Category</p>
                <Select
                  value={file.category || 'Other'}
                  onValueChange={(val) => onCategoryChange(file.url, val)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {file.uploadedBy && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Uploaded by</p>
                <p className="text-sm">{file.uploadedBy}</p>
              </div>
            )}

            {file.uploadedAt && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Uploaded at</p>
                <p className="text-sm">{new Date(file.uploadedAt).toLocaleDateString()}</p>
              </div>
            )}

            <div className="border-t pt-3 space-y-2">
              <Button variant="outline" size="sm" className="w-full justify-start text-xs" onClick={() => window.open(file.url)}>
                <Download className="h-3 w-3 mr-2" /> Download
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start text-xs" onClick={() => {
                navigator.clipboard.writeText(file.url);
                toast.success('Link copied');
              }}>
                <Link2 className="h-3 w-3 mr-2" /> Copy Link
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start text-xs" onClick={() => window.open(file.url, '_blank')}>
                <ExternalLink className="h-3 w-3 mr-2" /> Open in New Tab
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
