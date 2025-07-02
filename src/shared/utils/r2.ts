import { S3Client, PutObjectCommand, GetObjectCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import type { Logger } from 'pino';

export type R2Config = {
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  accountId: string;
};

export type R2Client = {
  testConnection: () => Promise<boolean>;
  uploadFile: (file: Buffer, fileName: string, contentType?: string) => Promise<string>;
  getFileUrl: (key: string) => Promise<string>;
  deleteFile: (key: string) => Promise<void>;
};

export function createR2Client(config: R2Config, logger: Logger): R2Client {
  const s3Client = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  async function testConnection(): Promise<boolean> {
    try {
      logger.info({ bucketName: config.bucketName }, 'Testing R2 connection');

      const command = new HeadBucketCommand({
        Bucket: config.bucketName,
      });

      await s3Client.send(command);
      
      logger.info({ bucketName: config.bucketName }, 'R2 connection test successful');
      return true;
    } catch (error) {
      logger.error({ 
        bucketName: config.bucketName,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 'R2 connection test failed');
      return false;
    }
  }

  async function uploadFile(file: Buffer, fileName: string, contentType?: string): Promise<string> {
    try {
      const key = `${randomUUID()}-${fileName}`;
      
      const command = new PutObjectCommand({
        Bucket: config.bucketName,
        Key: key,
        Body: file,
        ContentType: contentType || 'application/octet-stream',
      });

      await s3Client.send(command);
      
      const fileUrl = `https://${config.bucketName}.${config.accountId}.r2.cloudflarestorage.com/${key}`;
      
      logger.info({ 
        fileName, 
        key, 
        fileSize: file.length 
      }, 'File uploaded to R2 successfully');
      
      return fileUrl;
    } catch (error) {
      logger.error({ 
        fileName, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 'Failed to upload file to R2');
      throw error;
    }
  }

  async function getFileUrl(key: string): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: config.bucketName,
        Key: key,
      });

      const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      
      logger.debug({ key }, 'Generated signed URL for R2 file');
      
      return signedUrl;
    } catch (error) {
      logger.error({ 
        key, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 'Failed to generate signed URL for R2 file');
      throw error;
    }
  }

  async function deleteFile(key: string): Promise<void> {
    try {
      const command = new PutObjectCommand({
        Bucket: config.bucketName,
        Key: key,
      });

      await s3Client.send(command);
      
      logger.info({ key }, 'File deleted from R2 successfully');
    } catch (error) {
      logger.error({ 
        key, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 'Failed to delete file from R2');
      throw error;
    }
  }

  return {
    testConnection,
    uploadFile,
    getFileUrl,
    deleteFile,
  };
} 