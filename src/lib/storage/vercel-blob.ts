/**
 * VERCEL BLOB STORAGE SERVICE
 * File storage solution for Vercel deployment
 * Handles strategy exports, backtest results, and reports
 */

import { put, del, list, head } from '@vercel/blob';
import { NextRequest } from 'next/server';

export interface BlobFile {
  url: string;
  pathname: string;
  size: number;
  uploadedAt: Date;
  contentType?: string;
}

/**
 * Upload file to Vercel Blob storage
 */
export async function uploadFile(
  filename: string,
  content: string | Buffer | ReadableStream,
  options?: {
    contentType?: string;
    cacheControl?: string;
    addRandomSuffix?: boolean;
  }
): Promise<BlobFile> {
  try {
    // Default options
    const uploadOptions = {
      access: 'public' as const,
      contentType: options?.contentType || 'application/octet-stream',
      cacheControlMaxAge: options?.cacheControl ? parseInt(options.cacheControl) : 31536000,
      addRandomSuffix: options?.addRandomSuffix !== false, // Default true for unique URLs
    };

    const blob = await put(filename, content, uploadOptions);

    return {
      url: blob.url,
      pathname: blob.pathname,
      size: blob.size,
      uploadedAt: new Date(blob.uploadedAt),
      contentType: options?.contentType,
    };
  } catch (error) {
    console.error('Failed to upload file to Vercel Blob:', error);
    throw new Error('File upload failed');
  }
}

/**
 * Upload JSON data as file
 */
export async function uploadJSON(
  filename: string,
  data: any,
  options?: {
    prettify?: boolean;
    addRandomSuffix?: boolean;
  }
): Promise<BlobFile> {
  const content = options?.prettify 
    ? JSON.stringify(data, null, 2)
    : JSON.stringify(data);

  return uploadFile(filename, content, {
    contentType: 'application/json',
    addRandomSuffix: options?.addRandomSuffix,
  });
}

/**
 * Upload CSV data
 */
export async function uploadCSV(
  filename: string,
  data: string[][],
  options?: {
    headers?: string[];
    addRandomSuffix?: boolean;
  }
): Promise<BlobFile> {
  let csvContent = '';
  
  // Add headers if provided
  if (options?.headers) {
    csvContent += options.headers.join(',') + '\n';
  }
  
  // Add data rows
  csvContent += data.map(row => row.join(',')).join('\n');

  return uploadFile(filename, csvContent, {
    contentType: 'text/csv',
    addRandomSuffix: options?.addRandomSuffix,
  });
}

/**
 * Delete file from Vercel Blob storage
 */
export async function deleteFile(url: string): Promise<void> {
  try {
    await del(url);
  } catch (error) {
    console.error('Failed to delete file from Vercel Blob:', error);
    throw new Error('File deletion failed');
  }
}

/**
 * Delete multiple files
 */
export async function deleteFiles(urls: string[]): Promise<void> {
  try {
    await del(urls);
  } catch (error) {
    console.error('Failed to delete files from Vercel Blob:', error);
    throw new Error('Files deletion failed');
  }
}

/**
 * List files in a directory
 */
export async function listFiles(options?: {
  prefix?: string;
  limit?: number;
  cursor?: string;
}): Promise<{
  files: BlobFile[];
  hasMore: boolean;
  cursor?: string;
}> {
  try {
    const response = await list({
      prefix: options?.prefix,
      limit: options?.limit || 100,
      cursor: options?.cursor,
    });

    const files: BlobFile[] = response.blobs.map(blob => ({
      url: blob.url,
      pathname: blob.pathname,
      size: blob.size,
      uploadedAt: new Date(blob.uploadedAt),
    }));

    return {
      files,
      hasMore: response.hasMore,
      cursor: response.cursor,
    };
  } catch (error) {
    console.error('Failed to list files from Vercel Blob:', error);
    throw new Error('File listing failed');
  }
}

/**
 * Get file metadata
 */
export async function getFileMetadata(url: string): Promise<BlobFile | null> {
  try {
    const metadata = await head(url);
    
    return {
      url: metadata.url,
      pathname: metadata.pathname,
      size: metadata.size,
      uploadedAt: new Date(metadata.uploadedAt),
      contentType: metadata.contentType,
    };
  } catch (error) {
    console.error('Failed to get file metadata:', error);
    return null;
  }
}

/**
 * Upload strategy export
 */
export async function uploadStrategyExport(
  strategyId: string,
  strategyData: any
): Promise<BlobFile> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `exports/strategies/${strategyId}/strategy-${timestamp}.json`;
  
  return uploadJSON(filename, strategyData, { prettify: true });
}

/**
 * Upload backtest results
 */
export async function uploadBacktestResults(
  backtestId: string,
  results: any
): Promise<BlobFile> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `exports/backtests/${backtestId}/results-${timestamp}.json`;
  
  return uploadJSON(filename, results, { prettify: true });
}

/**
 * Upload trade history CSV
 */
export async function uploadTradeHistory(
  userId: string,
  trades: any[]
): Promise<BlobFile> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `exports/trades/${userId}/history-${timestamp}.csv`;
  
  const headers = ['Date', 'Symbol', 'Type', 'Volume', 'Entry', 'Exit', 'Profit', 'Result'];
  const data = trades.map(trade => [
    new Date(trade.openTime).toISOString(),
    trade.symbol,
    trade.type,
    trade.volume.toString(),
    trade.openPrice.toString(),
    trade.closePrice?.toString() || '',
    trade.profit?.toString() || '',
    trade.profit > 0 ? 'WIN' : 'LOSS',
  ]);
  
  return uploadCSV(filename, data, { headers });
}

/**
 * Generate temporary download URL
 * Note: Vercel Blob URLs are already public, but this can add auth/expiry
 */
export function generateDownloadUrl(blobUrl: string): string {
  // Vercel Blob URLs are already publicly accessible
  // You can add your own auth/expiry logic here if needed
  return blobUrl;
}

/**
 * Clean old exports (maintenance task)
 */
export async function cleanOldExports(
  prefix: string,
  daysToKeep: number = 30
): Promise<number> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    let deletedCount = 0;
    let cursor: string | undefined;
    let hasMore = true;
    
    while (hasMore) {
      const { files, hasMore: more, cursor: nextCursor } = await listFiles({
        prefix,
        cursor,
        limit: 100,
      });
      
      const filesToDelete = files
        .filter(file => file.uploadedAt < cutoffDate)
        .map(file => file.url);
      
      if (filesToDelete.length > 0) {
        await deleteFiles(filesToDelete);
        deletedCount += filesToDelete.length;
      }
      
      hasMore = more;
      cursor = nextCursor;
    }
    
    return deletedCount;
  } catch (error) {
    console.error('Failed to clean old exports:', error);
    return 0;
  }
}

/**
 * Handle file upload from form data
 */
export async function handleFormUpload(
  request: NextRequest,
  options?: {
    maxSize?: number; // bytes
    allowedTypes?: string[];
    prefix?: string;
  }
): Promise<BlobFile> {
  const formData = await request.formData();
  const file = formData.get('file') as File;
  
  if (!file) {
    throw new Error('No file provided');
  }
  
  // Validate file size
  if (options?.maxSize && file.size > options.maxSize) {
    throw new Error(`File size exceeds ${options.maxSize} bytes`);
  }
  
  // Validate file type
  if (options?.allowedTypes && !options.allowedTypes.includes(file.type)) {
    throw new Error(`File type ${file.type} not allowed`);
  }
  
  // Generate filename with prefix
  const prefix = options?.prefix || 'uploads';
  const timestamp = Date.now();
  const filename = `${prefix}/${timestamp}-${file.name}`;
  
  // Convert file to buffer
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  
  return uploadFile(filename, buffer, {
    contentType: file.type,
  });
}

/**
 * Check if Vercel Blob is configured
 */
export function isBlobStorageConfigured(): boolean {
  return !!(process.env.BLOB_READ_WRITE_TOKEN);
}

/**
 * Get storage status
 */
export function getStorageStatus(): {
  configured: boolean;
  provider: 'vercel-blob' | 'local' | 'none';
} {
  if (isBlobStorageConfigured()) {
    return {
      configured: true,
      provider: 'vercel-blob',
    };
  }
  
  return {
    configured: false,
    provider: process.env.NODE_ENV === 'development' ? 'local' : 'none',
  };
}
