import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import sharp from 'sharp';
import crypto from 'node:crypto';
import { SystemSettingsService, SystemSettingKeys } from './SystemSettingsService';

const THUMBNAIL_SIZE = 150;
const IMAGES_DIR = 'inventory-images';
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export type StorageType = 'local' | 'lan';

export interface SaveImageResult {
  filePath: string;
  thumbnailPath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export interface StorageInfo {
  type: StorageType;
  path: string;
  accessible: boolean;
}

export interface ValidateStorageResult {
  valid: boolean;
  error?: string;
}

export class ImageStorageService {
  private basePath: string;
  private storageType: StorageType = 'local';

  constructor() {
    // Get default base path for image storage (local)
    this.basePath = this.getDefaultLocalPath();

    // Ensure base directory exists
    this.ensureDirectory(this.basePath);
  }

  /**
   * Get the default local storage path
   */
  private getDefaultLocalPath(): string {
    if (app && app.isReady && app.isReady()) {
      return path.join(app.getPath('userData'), IMAGES_DIR);
    } else {
      // CLI/test mode - use local directory
      return path.join(process.cwd(), IMAGES_DIR);
    }
  }

  /**
   * Initialize storage from system settings
   */
  public async initializeFromSettings(settingsService: SystemSettingsService): Promise<void> {
    const type = await settingsService.getValue(SystemSettingKeys.FILE_STORAGE_TYPE);
    const customPath = await settingsService.getValue(SystemSettingKeys.FILE_STORAGE_PATH);

    this.storageType = (type as StorageType) || 'local';

    if (this.storageType === 'lan' && customPath) {
      this.basePath = path.join(customPath, IMAGES_DIR);
    } else {
      // Default to local
      this.basePath = this.getDefaultLocalPath();
    }

    // Ensure base directory exists
    this.ensureDirectory(this.basePath);
  }

  /**
   * Validate a storage path before saving settings
   */
  public validateStoragePath(storagePath: string): ValidateStorageResult {
    try {
      // Check if path is empty
      if (!storagePath || storagePath.trim() === '') {
        return { valid: false, error: 'Storage path cannot be empty' };
      }

      const fullPath = path.join(storagePath, IMAGES_DIR);

      // Check if parent directory exists
      if (!fs.existsSync(storagePath)) {
        return { valid: false, error: `Path does not exist: ${storagePath}` };
      }

      // Try to create the images directory if it doesn't exist
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }

      // Test write permission by creating a test file
      const testFile = path.join(fullPath, '.write-test');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: `Cannot write to path: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get current storage information
   */
  public getStorageInfo(): StorageInfo {
    let accessible = false;
    try {
      accessible = fs.existsSync(this.basePath);
      if (accessible) {
        // Test write permission
        const testFile = path.join(this.basePath, '.access-test');
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
      }
    } catch {
      accessible = false;
    }

    return {
      type: this.storageType,
      path: this.basePath,
      accessible,
    };
  }

  /**
   * Reinitialize storage with new settings (used when settings change)
   */
  public reinitialize(type: StorageType, customPath?: string): void {
    this.storageType = type;

    if (type === 'lan' && customPath) {
      this.basePath = path.join(customPath, IMAGES_DIR);
    } else {
      this.basePath = this.getDefaultLocalPath();
    }

    this.ensureDirectory(this.basePath);
  }

  /**
   * Ensure a directory exists, creating it if necessary
   */
  private ensureDirectory(dirPath: string): void {
    try {
      if (!fs.existsSync(dirPath)) {
        console.log(`[ImageStorageService] Creating directory: ${dirPath}`);
        fs.mkdirSync(dirPath, { recursive: true });
      }
    } catch (error) {
      console.error(`[ImageStorageService] Failed to create directory ${dirPath}:`, error);
      throw error;
    }
  }

  /**
   * Get the directory path for a specific SKU
   */
  private getSkuDirectory(sku: string): string {
    // Sanitize SKU for filesystem (replace special chars)
    const safeSku = sku.replace(/[^a-zA-Z0-9-_]/g, '_');
    return path.join(this.basePath, safeSku);
  }

  /**
   * Generate a unique filename
   */
  private generateFileName(originalName: string): string {
    const ext = path.extname(originalName).toLowerCase();
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(4).toString('hex');
    return `${timestamp}-${randomId}${ext}`;
  }

  /**
   * Get the absolute path from a relative path
   */
  public getAbsolutePath(relativePath: string): string {
    return path.join(this.basePath, relativePath);
  }

  /**
   * Get relative path from absolute path
   */
  public getRelativePath(absolutePath: string): string {
    return path.relative(this.basePath, absolutePath);
  }

  /**
   * Save an image file and generate thumbnail
   * @param sku The inventory or variant SKU
   * @param buffer The image file buffer
   * @param originalFileName The original filename
   * @param mimeType The MIME type of the image
   */
  public async saveImage(
    sku: string,
    buffer: Buffer,
    originalFileName: string,
    mimeType: string
  ): Promise<SaveImageResult> {
    console.log(`[ImageStorageService] Saving image for SKU: ${sku}, file: ${originalFileName}, size: ${buffer.length}, type: ${mimeType}`);
    console.log(`[ImageStorageService] Current base path: ${this.basePath}`);

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      throw new Error(`Invalid file type: ${mimeType}. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`);
    }

    // Validate file size
    if (buffer.length > MAX_FILE_SIZE) {
      throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    // Ensure SKU directory exists
    const skuDir = this.getSkuDirectory(sku);
    console.log(`[ImageStorageService] SKU directory: ${skuDir}`);
    this.ensureDirectory(skuDir);

    // Generate unique filename
    const fileName = this.generateFileName(originalFileName);
    const filePath = path.join(skuDir, fileName);

    // Generate thumbnail filename
    const ext = path.extname(fileName);
    const thumbnailFileName = `${path.basename(fileName, ext)}_thumb${ext}`;
    const thumbnailPath = path.join(skuDir, thumbnailFileName);

    try {
      // Process and save the original image (optimize if needed)
      const processedBuffer = await sharp(buffer)
        .rotate() // Auto-rotate based on EXIF
        .toBuffer();

      fs.writeFileSync(filePath, processedBuffer);

      // Generate and save thumbnail
      await sharp(buffer)
        .rotate()
        .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
          fit: 'cover',
          position: 'center',
        })
        .toFile(thumbnailPath);

      // Return relative paths
      const safeSku = sku.replace(/[^a-zA-Z0-9-_]/g, '_');
      console.log(`[ImageStorageService] Image saved successfully: ${filePath}`);
      return {
        filePath: path.join(safeSku, fileName),
        thumbnailPath: path.join(safeSku, thumbnailFileName),
        fileName: originalFileName,
        fileSize: processedBuffer.length,
        mimeType,
      };
    } catch (error) {
      console.error(`[ImageStorageService] Failed to save image:`, error);
      // Clean up any partial files
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      if (fs.existsSync(thumbnailPath)) {
        fs.unlinkSync(thumbnailPath);
      }
      throw new Error(`Failed to process image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete an image and its thumbnail
   * @param relativePath The relative path to the image file
   */
  public deleteImage(relativePath: string): void {
    const absolutePath = this.getAbsolutePath(relativePath);

    // Delete the main image
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }

    // Try to delete the thumbnail (same name with _thumb)
    const ext = path.extname(absolutePath);
    const thumbnailPath = absolutePath.replace(ext, `_thumb${ext}`);
    if (fs.existsSync(thumbnailPath)) {
      fs.unlinkSync(thumbnailPath);
    }
  }

  /**
   * Delete all images for a SKU
   * @param sku The inventory or variant SKU
   */
  public deleteAllImagesForSku(sku: string): void {
    const skuDir = this.getSkuDirectory(sku);

    if (fs.existsSync(skuDir)) {
      // Remove all files in the directory
      const files = fs.readdirSync(skuDir);
      for (const file of files) {
        fs.unlinkSync(path.join(skuDir, file));
      }
      // Remove the directory
      fs.rmdirSync(skuDir);
    }
  }

  /**
   * Read an image file as base64
   * @param relativePath The relative path to the image
   */
  public readImageAsBase64(relativePath: string): string | null {
    const absolutePath = this.getAbsolutePath(relativePath);

    if (!fs.existsSync(absolutePath)) {
      return null;
    }

    const buffer = fs.readFileSync(absolutePath);
    const ext = path.extname(absolutePath).toLowerCase().slice(1);
    const mimeType = ext === 'jpg' ? 'jpeg' : ext;
    return `data:image/${mimeType};base64,${buffer.toString('base64')}`;
  }

  /**
   * Check if an image exists
   * @param relativePath The relative path to check
   */
  public imageExists(relativePath: string): boolean {
    return fs.existsSync(this.getAbsolutePath(relativePath));
  }
}
