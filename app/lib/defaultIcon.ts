import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";

const ICON_SIZE = 128;
const DEFAULT_ICON_SOURCE_PATH = path.join(process.cwd(), "images", "images.png");

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

let r2Client: S3Client | null = null;
let defaultIconBufferPromise: Promise<Buffer> | null = null;

function getR2Client(): S3Client {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error("Missing R2 credentials");
  }

  if (!r2Client) {
    r2Client = new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });
  }

  return r2Client;
}

function getHashedEmail(email: string): string {
  return crypto.createHash("sha256").update(email.toLowerCase().trim()).digest("hex");
}

async function getDefaultIconBuffer(): Promise<Buffer> {
  if (!defaultIconBufferPromise) {
    defaultIconBufferPromise = fs.readFile(DEFAULT_ICON_SOURCE_PATH).then((buffer) =>
      sharp(buffer)
        .resize(ICON_SIZE, ICON_SIZE, {
          fit: "cover",
          position: "center",
        })
        .jpeg({ quality: 85 })
        .toBuffer(),
    );
  }

  return defaultIconBufferPromise;
}

export async function ensureDefaultUserIcon(email: string): Promise<string | null> {
  const normalizedEmail = email.toLowerCase().trim();
  if (!normalizedEmail) {
    return null;
  }

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME || !R2_PUBLIC_URL) {
    return null;
  }

  const fileName = `${getHashedEmail(normalizedEmail)}.jpg`;

  try {
    const buffer = await getDefaultIconBuffer();
    await getR2Client().send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: fileName,
        Body: buffer,
        ContentType: "image/jpeg",
        Metadata: {
          source: "images/images.png",
          uploadedFor: normalizedEmail,
        },
      }),
    );

    return `${R2_PUBLIC_URL}/${fileName}`;
  } catch (error) {
    console.error("Failed to seed default user icon:", error);
    return null;
  }
}
