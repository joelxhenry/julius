import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import sharp from 'sharp';
import crypto from 'node:crypto';

const THUMBNAIL_SIZE = 150;
const IMAGES_DIR = 'inventory-images';
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export interface SaveImageResult {
  filePath: string;
  thumbnailPath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export class ImageStorageService {
  private basePath: string;

  constructor() {
    // Get base path for image storage
    if (app && app.isReady && app.isReady()) {
      this.basePath = path.join(app.getPath('userData'), IMAGES_DIR);
    } else {
      // CLI/test mode - use local directory
      this.basePath = path.join(process.cwd(), IMAGES_DIR);
    }

    // Ensure base directory exists
    this.ensureDirectory(this.basePath);
  }

  /**
   * Ensure a directory exists, creating it if necessary
   */
  private ensureDirectory(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
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
      return {
        filePath: path.join(safeSku, fileName),
        thumbnailPath: path.join(safeSku, thumbnailFileName),
        fileName: originalFileName,
        fileSize: processedBuffer.length,
        mimeType,
      };
    } catch (error) {
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
