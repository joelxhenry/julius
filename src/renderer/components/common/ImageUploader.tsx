import { useState, useCallback, useRef } from 'react';
import {
  Modal,
  Stack,
  Group,
  Text,
  Button,
  Image,
  Box,
  Progress,
  Alert,
  Paper,
} from '@mantine/core';
import { Dropzone, IMAGE_MIME_TYPE, FileWithPath } from '@mantine/dropzone';
import { IconUpload, IconPhoto, IconX, IconCheck, IconAlertCircle } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { IpcChannel } from '../../../shared/types/ipc';
import { imageCache } from '../../utils/imageCache';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface ImageUploaderProps {
  opened: boolean;
  onClose: () => void;
  sku: string;
  isVariant?: boolean;
  onUploadComplete?: () => void;
}

interface PreviewFile {
  file: FileWithPath;
  preview: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

export function ImageUploader({
  opened,
  onClose,
  sku,
  isVariant = false,
  onUploadComplete,
}: ImageUploaderProps) {
  const [files, setFiles] = useState<PreviewFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const openRef = useRef<() => void>(null);

  const handleDrop = useCallback((acceptedFiles: FileWithPath[]) => {
    const newFiles: PreviewFile[] = acceptedFiles.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      status: 'pending' as const,
    }));
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const handleRemoveFile = useCallback((index: number) => {
    setFiles((prev) => {
      const newFiles = [...prev];
      // Revoke the object URL to prevent memory leaks
      URL.revokeObjectURL(newFiles[index].preview);
      newFiles.splice(index, 1);
      return newFiles;
    });
  }, []);

  const handleUpload = useCallback(async () => {
    if (files.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    const totalFiles = files.length;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < files.length; i++) {
      const previewFile = files[i];
      if (previewFile.status !== 'pending') continue;

      // Update status to uploading
      setFiles((prev) =>
        prev.map((f, idx) =>
          idx === i ? { ...f, status: 'uploading' as const } : f
        )
      );

      try {
        // Read file as base64
        const buffer = await previewFile.file.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');

        const result = await window.electron.invoke(IpcChannel.UPLOAD_INVENTORY_IMAGE, {
          sku,
          isVariant,
          fileData: base64,
          fileName: previewFile.file.name,
          mimeType: previewFile.file.type,
          isPrimary: i === 0 && successCount === 0, // First successful upload is primary
        });

        if (result.success) {
          successCount++;
          setFiles((prev) =>
            prev.map((f, idx) =>
              idx === i ? { ...f, status: 'success' as const } : f
            )
          );
        } else {
          errorCount++;
          setFiles((prev) =>
            prev.map((f, idx) =>
              idx === i
                ? { ...f, status: 'error' as const, error: result.error }
                : f
            )
          );
        }
      } catch (error) {
        errorCount++;
        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i
              ? {
                  ...f,
                  status: 'error' as const,
                  error: error instanceof Error ? error.message : 'Upload failed',
                }
              : f
          )
        );
      }

      setUploadProgress(((i + 1) / totalFiles) * 100);
    }

    setIsUploading(false);

    // Invalidate cache for this SKU
    imageCache.invalidate(sku, isVariant);

    if (successCount > 0) {
      notifications.show({
        title: 'Upload Complete',
        message: `Successfully uploaded ${successCount} image${successCount > 1 ? 's' : ''}`,
        color: 'green',
      });
      onUploadComplete?.();
    }

    if (errorCount > 0) {
      notifications.show({
        title: 'Upload Errors',
        message: `${errorCount} image${errorCount > 1 ? 's' : ''} failed to upload`,
        color: 'red',
      });
    }

    // Clear successful files after a delay
    setTimeout(() => {
      setFiles((prev) => prev.filter((f) => f.status === 'error'));
    }, 2000);
  }, [files, sku, isVariant, onUploadComplete]);

  const handleClose = useCallback(() => {
    // Clean up object URLs
    files.forEach((f) => URL.revokeObjectURL(f.preview));
    setFiles([]);
    setUploadProgress(0);
    onClose();
  }, [files, onClose]);

  const pendingCount = files.filter((f) => f.status === 'pending').length;
  const hasErrors = files.some((f) => f.status === 'error');

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <Group gap="xs">
          <IconUpload size={20} />
          <Text fw={600}>Upload Images</Text>
        </Group>
      }
      size="lg"
      centered
    >
      <Stack gap="md">
        <Dropzone
          onDrop={handleDrop}
          onReject={(rejections) => {
            rejections.forEach((rejection) => {
              notifications.show({
                title: 'File Rejected',
                message: `${rejection.file.name}: ${rejection.errors[0]?.message || 'Invalid file'}`,
                color: 'red',
              });
            });
          }}
          maxSize={MAX_FILE_SIZE}
          accept={IMAGE_MIME_TYPE}
          disabled={isUploading}
          openRef={openRef}
        >
          <Group
            justify="center"
            gap="xl"
            mih={150}
            style={{ pointerEvents: 'none' }}
          >
            <Dropzone.Accept>
              <IconUpload
                size={52}
                color="var(--mantine-color-blue-6)"
                stroke={1.5}
              />
            </Dropzone.Accept>
            <Dropzone.Reject>
              <IconX
                size={52}
                color="var(--mantine-color-red-6)"
                stroke={1.5}
              />
            </Dropzone.Reject>
            <Dropzone.Idle>
              <IconPhoto
                size={52}
                color="var(--mantine-color-dimmed)"
                stroke={1.5}
              />
            </Dropzone.Idle>

            <div>
              <Text size="lg" inline>
                Drag images here or click to select
              </Text>
              <Text size="sm" c="dimmed" inline mt={7}>
                Attach up to 10 images, each file should not exceed 10MB
              </Text>
            </div>
          </Group>
        </Dropzone>

        {/* Preview Grid */}
        {files.length > 0 && (
          <Box>
            <Text size="sm" fw={500} mb="xs">
              Selected Images ({files.length})
            </Text>
            <Group gap="sm" wrap="wrap">
              {files.map((previewFile, index) => (
                <Paper
                  key={`${previewFile.file.name}-${index}`}
                  withBorder
                  p="xs"
                  style={{ position: 'relative', width: 100 }}
                >
                  <Image
                    src={previewFile.preview}
                    alt={previewFile.file.name}
                    width={80}
                    height={80}
                    fit="cover"
                    radius="sm"
                  />

                  {/* Status overlay */}
                  {previewFile.status === 'uploading' && (
                    <Box
                      style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 'var(--mantine-radius-sm)',
                      }}
                    >
                      <Progress
                        value={100}
                        animated
                        size="xs"
                        style={{ width: '80%' }}
                      />
                    </Box>
                  )}

                  {previewFile.status === 'success' && (
                    <Box
                      style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundColor: 'rgba(0,128,0,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 'var(--mantine-radius-sm)',
                      }}
                    >
                      <IconCheck size={32} color="white" />
                    </Box>
                  )}

                  {previewFile.status === 'error' && (
                    <Box
                      style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundColor: 'rgba(255,0,0,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 'var(--mantine-radius-sm)',
                      }}
                    >
                      <IconX size={32} color="white" />
                    </Box>
                  )}

                  {/* Remove button (only for pending files) */}
                  {previewFile.status === 'pending' && !isUploading && (
                    <Button
                      size="compact-xs"
                      color="red"
                      variant="filled"
                      style={{
                        position: 'absolute',
                        top: 2,
                        right: 2,
                        padding: 2,
                        minWidth: 'auto',
                      }}
                      onClick={() => handleRemoveFile(index)}
                    >
                      <IconX size={12} />
                    </Button>
                  )}

                  <Text size="xs" c="dimmed" truncate mt={4}>
                    {previewFile.file.name}
                  </Text>
                </Paper>
              ))}
            </Group>
          </Box>
        )}

        {/* Error messages */}
        {hasErrors && (
          <Alert color="red" icon={<IconAlertCircle size={16} />}>
            Some files failed to upload. Check the files marked in red.
          </Alert>
        )}

        {/* Upload Progress */}
        {isUploading && (
          <Stack gap="xs">
            <Text size="sm">Uploading...</Text>
            <Progress value={uploadProgress} animated />
          </Stack>
        )}

        {/* Action Buttons */}
        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" onClick={handleClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            loading={isUploading}
            disabled={pendingCount === 0}
            leftSection={<IconUpload size={16} />}
          >
            Upload {pendingCount > 0 ? `(${pendingCount})` : ''}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
