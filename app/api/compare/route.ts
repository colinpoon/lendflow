import { NextRequest, NextResponse } from 'next/server';
import { extractFinancialData } from '@/utils/aiProcessor';
import { extractVisionData } from '@/utils/visionProcessor';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

// Vercel timeout: 5 minutes for running both extractions
export const maxDuration = 300;

export async function POST(req: NextRequest) {
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

    // Only support PDF for vision comparison
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json(
        { error: 'Only PDF files are supported for comparison' },
        { status: 400 }
      );
    }

    // Write to temp file (text extraction needs file path)
    const tempDir = join(tmpdir(), 'lendflow-compare');
    await mkdir(tempDir, { recursive: true });
    tempFilePath = join(tempDir, `${randomUUID()}.pdf`);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await writeFile(tempFilePath, buffer);

    // Run both extractions concurrently
    const [textResult, visionResult] = await Promise.allSettled([
      extractFinancialData(tempFilePath),
      extractVisionData(buffer),
    ]);

    return NextResponse.json({
      filename: file.name,
      text: textResult.status === 'fulfilled' ? textResult.value : null,
      text_error: textResult.status === 'rejected' ? textResult.reason?.message : null,
      vision: visionResult.status === 'fulfilled' ? visionResult.value : null,
      vision_error: visionResult.status === 'rejected' ? visionResult.reason?.message : null,
    });
  } catch (error) {
    console.error('Comparison error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  } finally {
    // Clean up temp file
    if (tempFilePath) {
      try {
        await unlink(tempFilePath);
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}
