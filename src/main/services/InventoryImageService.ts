import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, asc, desc, sql } from 'drizzle-orm';
import * as schema from '../database/schema';
import { ImageStorageService, SaveImageResult } from './ImageStorageService';

export interface UploadImageParams {
  sku: string;
  isVariant: boolean;
  buffer: Buffer;
  originalFileName: string;
  mimeType: string;
  isPrimary?: boolean;
}

export interface UploadImageResult extends schema.InventoryImage {
  thumbnailBase64?: string;
}

export interface ImageWithBase64 extends schema.InventoryImage {
  imageBase64?: string;
  thumbnailBase64?: string;
}

export class InventoryImageService {
  constructor(
    private db: NodePgDatabase<typeof schema>,
    private imageStorage: ImageStorageService
  ) {}

  /**
   * Upload and save a new image for an inventory item or variant
   */
  async uploadImage(params: UploadImageParams): Promise<UploadImageResult> {
    const { sku, isVariant, buffer, originalFileName, mimeType, isPrimary } = params;

    // Save the image to filesystem
    const saveResult = await this.imageStorage.saveImage(sku, buffer, originalFileName, mimeType);

    // If this is marked as primary, unset any existing primary
    if (isPrimary) {
      await this.db
        .update(schema.inventoryImages)
        .set({ isPrimary: false })
        .where(and(
          eq(schema.inventoryImages.sku, sku),
          eq(schema.inventoryImages.isVariant, isVariant)
        ));
    }

    // Check if this is the first image for this SKU (make it primary by default)
    const existingImages = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.inventoryImages)
      .where(and(
        eq(schema.inventoryImages.sku, sku),
        eq(schema.inventoryImages.isVariant, isVariant)
      ));

    const isFirstImage = existingImages[0]?.count === 0;
    const shouldBePrimary = isPrimary ?? isFirstImage;

    // Get the next sort order
    const maxSortOrder = await this.db
      .select({ max: sql<number>`COALESCE(MAX(sort_order), -1)` })
      .from(schema.inventoryImages)
      .where(and(
        eq(schema.inventoryImages.sku, sku),
        eq(schema.inventoryImages.isVariant, isVariant)
      ));

    const nextSortOrder = (maxSortOrder[0]?.max ?? -1) + 1;

    // Insert the image record
    const [image] = await this.db
      .insert(schema.inventoryImages)
      .values({
        sku,
        isVariant,
        filePath: saveResult.filePath,
        thumbnailPath: saveResult.thumbnailPath,
        fileName: saveResult.fileName,
        fileSize: saveResult.fileSize,
        mimeType: saveResult.mimeType,
        isPrimary: shouldBePrimary,
        sortOrder: nextSortOrder,
      })
      .returning();

    // Return with thumbnail base64 for immediate display
    const thumbnailBase64 = this.imageStorage.readImageAsBase64(saveResult.thumbnailPath) || undefined;

    return {
      ...image,
      thumbnailBase64,
    };
  }

  /**
   * Get all images for a SKU
   */
  async getImagesForSku(sku: string, isVariant: boolean): Promise<schema.InventoryImage[]> {
    return this.db
      .select()
      .from(schema.inventoryImages)
      .where(and(
        eq(schema.inventoryImages.sku, sku),
        eq(schema.inventoryImages.isVariant, isVariant)
      ))
      .orderBy(asc(schema.inventoryImages.sortOrder));
  }

  /**
   * Get all images for a SKU with base64 data
   */
  async getImagesWithBase64(sku: string, isVariant: boolean): Promise<ImageWithBase64[]> {
    const images = await this.getImagesForSku(sku, isVariant);

    console.log(`[InventoryImageService] getImagesWithBase64 for SKU: ${sku}, found ${images.length} images`);
    images.forEach((img, idx) => {
      console.log(`[InventoryImageService] Image ${idx}: id=${img.id}, filePath=${img.filePath}, thumbnailPath=${img.thumbnailPath}`);
    });

    return images.map(image => ({
      ...image,
      imageBase64: image.filePath ? this.imageStorage.readImageAsBase64(image.filePath) || undefined : undefined,
      thumbnailBase64: image.thumbnailPath ? this.imageStorage.readImageAsBase64(image.thumbnailPath) || undefined : undefined,
    }));
  }

  /**
   * Get the primary image for a SKU
   */
  async getPrimaryImage(sku: string, isVariant: boolean): Promise<schema.InventoryImage | null> {
    const [image] = await this.db
      .select()
      .from(schema.inventoryImages)
      .where(and(
        eq(schema.inventoryImages.sku, sku),
        eq(schema.inventoryImages.isVariant, isVariant),
        eq(schema.inventoryImages.isPrimary, true)
      ))
      .limit(1);

    return image || null;
  }

  /**
   * Get primary thumbnail base64 for a SKU (used in tables)
   */
  async getPrimaryThumbnail(sku: string, isVariant: boolean): Promise<string | null> {
    const primaryImage = await this.getPrimaryImage(sku, isVariant);

    if (!primaryImage?.thumbnailPath) {
      return null;
    }

    return this.imageStorage.readImageAsBase64(primaryImage.thumbnailPath);
  }

  /**
   * Get primary thumbnails for multiple SKUs (batch operation for tables)
   */
  async getPrimaryThumbnailsBatch(
    skus: Array<{ sku: string; isVariant: boolean }>
  ): Promise<Map<string, string>> {
    const result = new Map<string, string>();

    if (skus.length === 0) {
      return result;
    }

    // Get all primary images in one query
    const primaryImages = await this.db
      .select()
      .from(schema.inventoryImages)
      .where(eq(schema.inventoryImages.isPrimary, true));

    // Filter to only requested SKUs and read thumbnails
    for (const { sku, isVariant } of skus) {
      const image = primaryImages.find(
        img => img.sku === sku && img.isVariant === isVariant
      );

      if (image?.thumbnailPath) {
        const base64 = this.imageStorage.readImageAsBase64(image.thumbnailPath);
        if (base64) {
          const key = `${isVariant ? 'variant' : 'inventory'}:${sku}`;
          result.set(key, base64);
        }
      }
    }

    return result;
  }

  /**
   * Set an image as the primary image
   */
  async setPrimaryImage(imageId: number): Promise<schema.InventoryImage | null> {
    // Get the image first
    const [image] = await this.db
      .select()
      .from(schema.inventoryImages)
      .where(eq(schema.inventoryImages.id, imageId))
      .limit(1);

    if (!image) {
      throw new Error('Image not found');
    }

    // Unset any existing primary for this SKU
    await this.db
      .update(schema.inventoryImages)
      .set({ isPrimary: false })
      .where(and(
        eq(schema.inventoryImages.sku, image.sku),
        eq(schema.inventoryImages.isVariant, image.isVariant)
      ));

    // Set this image as primary
    const [updated] = await this.db
      .update(schema.inventoryImages)
      .set({ isPrimary: true })
      .where(eq(schema.inventoryImages.id, imageId))
      .returning();

    return updated || null;
  }

  /**
   * Reorder images for a SKU
   */
  async reorderImages(imageIds: number[]): Promise<void> {
    // Update sort_order for each image
    for (let i = 0; i < imageIds.length; i++) {
      await this.db
        .update(schema.inventoryImages)
        .set({ sortOrder: i })
        .where(eq(schema.inventoryImages.id, imageIds[i]));
    }
  }

  /**
   * Delete an image by ID
   */
  async deleteImage(imageId: number): Promise<boolean> {
    // Get the image first
    const [image] = await this.db
      .select()
      .from(schema.inventoryImages)
      .where(eq(schema.inventoryImages.id, imageId))
      .limit(1);

    if (!image) {
      return false;
    }

    // Delete from filesystem
    if (image.filePath) {
      this.imageStorage.deleteImage(image.filePath);
    }

    // Delete from database
    await this.db
      .delete(schema.inventoryImages)
      .where(eq(schema.inventoryImages.id, imageId));

    // If this was the primary, make the first remaining image primary
    if (image.isPrimary) {
      const [nextImage] = await this.db
        .select()
        .from(schema.inventoryImages)
        .where(and(
          eq(schema.inventoryImages.sku, image.sku),
          eq(schema.inventoryImages.isVariant, image.isVariant)
        ))
        .orderBy(asc(schema.inventoryImages.sortOrder))
        .limit(1);

      if (nextImage) {
        await this.db
          .update(schema.inventoryImages)
          .set({ isPrimary: true })
          .where(eq(schema.inventoryImages.id, nextImage.id));
      }
    }

    return true;
  }

  /**
   * Delete all images for a SKU (used when deleting inventory/variant)
   */
  async deleteAllImagesForSku(sku: string, isVariant: boolean): Promise<void> {
    // Get all images for this SKU
    const images = await this.getImagesForSku(sku, isVariant);

    // Delete from filesystem
    this.imageStorage.deleteAllImagesForSku(sku);

    // Delete from database
    await this.db
      .delete(schema.inventoryImages)
      .where(and(
        eq(schema.inventoryImages.sku, sku),
        eq(schema.inventoryImages.isVariant, isVariant)
      ));
  }

  /**
   * Get image file as base64 (for gallery display)
   */
  getImageBase64(relativePath: string): string | null {
    return this.imageStorage.readImageAsBase64(relativePath);
  }

  /**
   * Get image by ID
   */
  async findById(id: number): Promise<schema.InventoryImage | null> {
    const [image] = await this.db
      .select()
      .from(schema.inventoryImages)
      .where(eq(schema.inventoryImages.id, id))
      .limit(1);

    return image || null;
  }

  /**
   * Get image count for a SKU
   */
  async getImageCount(sku: string, isVariant: boolean): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.inventoryImages)
      .where(and(
        eq(schema.inventoryImages.sku, sku),
        eq(schema.inventoryImages.isVariant, isVariant)
      ));

    return result[0]?.count ?? 0;
  }

  /**
   * Get all images for a product and its variants (for gallery tab)
   */
  async getAllProductImages(
    mainSku: string,
    variantSkus: string[]
  ): Promise<{
    main: schema.InventoryImage[];
    variants: Record<string, schema.InventoryImage[]>;
  }> {
    // Get main product images
    const main = await this.getImagesForSku(mainSku, false);

    // Get variant images
    const variants: Record<string, schema.InventoryImage[]> = {};
    for (const variantSku of variantSkus) {
      variants[variantSku] = await this.getImagesForSku(variantSku, true);
    }

    return { main, variants };
  }
}
