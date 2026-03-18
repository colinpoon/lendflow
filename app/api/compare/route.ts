import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { extractFinancialData } from '@/utils/aiProcessor';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_LABEL } from '@/lib/constants';
import { checkRateLimit } from '@/lib/rate-limiter';

export const maxDuration = 150;

export async function POST(req: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { allowed, retryAfterSeconds } = checkRateLimit(userId);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please wait before submitting another extraction.' },
      {
        status: 429,
        headers: { 'Retry-After': String(retryAfterSeconds) },
      }
    );
  }

  let tempFilePath: string | null = null;

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE_LABEL}.` },
        { status: 400 }
      );
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json(
        { error: 'Only PDF files are supported' },
        { status: 400 }
      );
    }

    const tempDir = join(tmpdir(), 'lendflow-compare');
    await mkdir(tempDir, { recursive: true });
    tempFilePath = join(tempDir, `${randomUUID()}.pdf`);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate PDF magic bytes (%PDF) before writing to disk
    if (buffer.length < 4 || buffer[0] !== 0x25 || buffer[1] !== 0x50 || buffer[2] !== 0x44 || buffer[3] !== 0x46) {
      return NextResponse.json(
        { error: 'File does not appear to be a valid PDF.' },
        { status: 400 }
      );
    }

    await writeFile(tempFilePath, buffer);

    try {
      const extracted = await extractFinancialData(tempFilePath);
      return NextResponse.json({
        filename: file.name,
        extracted,
        extracted_error: null,
      });
    } catch (extractionError) {
      return NextResponse.json({
        filename: file.name,
        extracted: null,
        extracted_error:
          extractionError instanceof Error
            ? extractionError.message
            : 'Extraction failed',
      });
    }
  } catch (error) {
    console.error('Compare API error:', error);
    const errorMessage =
      error instanceof Error
        ? error.message.replace(/\/[^\s]+/g, '[path]')
        : 'An unexpected error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  } finally {
    if (tempFilePath) {
      try {
        await unlink(tempFilePath);
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}
