import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import crypto from "crypto";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL; // 例: https://pub-xxxxx.r2.dev

// 画像の統一サイズ
const ICON_SIZE = 128;

// R2クライアントを初期化（S3互換）
const getR2Client = () => {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error("Missing R2 credentials");
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
};

export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!R2_BUCKET_NAME || !R2_PUBLIC_URL) {
      return NextResponse.json(
        { error: "Missing R2 configuration" },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "画像ファイルを選択してください" }, { status: 400 });
    }

    if (file.size > 1_000_000) {
      return NextResponse.json({ error: "画像は1MB以下にしてください" }, { status: 400 });
    }

    // ファイル名にハッシュ化したメールアドレスを使用（セキュリティ対策）
    const email = session.user.email;
    const hashedEmail = crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
    const fileName = `${hashedEmail}.jpg`; // 統一してJPG形式で保存

    // ファイルをArrayBufferに変換
    const arrayBuffer = await file.arrayBuffer();
    
    // Sharp で画像をリサイズ（128x128px、正方形、JPEGに変換）
    const resizedBuffer = await sharp(Buffer.from(arrayBuffer))
      .resize(ICON_SIZE, ICON_SIZE, {
        fit: "cover", // アスペクト比を維持しつつトリミング
        position: "center",
      })
      .jpeg({ quality: 85 }) // JPEG 品質85%
      .toBuffer();

    // R2にアップロード
    const r2Client = getR2Client();
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: fileName,
      Body: resizedBuffer,
      ContentType: "image/jpeg",
      Metadata: {
        uploader: email,
        uploadedAt: Date.now().toString(),
      },
    });

    await r2Client.send(command);

    // 画像URLを構築（同一キー更新時のキャッシュ回避用に version を付与）
    const imageUrl = `${R2_PUBLIC_URL}/${fileName}?v=${Date.now()}`;

    return NextResponse.json({ success: true, imageUrl });
  } catch (error: any) {
    console.error("R2 upload error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to upload image" },
      { status: 500 }
    );
  }
}
