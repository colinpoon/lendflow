import { NextRequest, NextResponse } from 'next/server';
import formidable, { File } from 'formidable';
import fs from 'fs';
import path from 'path';
import { extractFinancialData } from '@/utils/aiProcessor';
import { Readable } from 'stream';

// Disable default body parsing for formidable to handle file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(req: NextRequest) {
  console.log('✅ API Hit: /api/extractData');

  try {
    console.log('🚀 Initializing form parsing...');
    const uploadDir = path.join(process.cwd(), 'uploads');

    if (!fs.existsSync(uploadDir)) {
      console.log('📂 Creating uploads directory...');
      fs.mkdirSync(uploadDir);
    }

    // Correct usage for formidable@3.5.2
    const form = formidable({
      uploadDir: uploadDir,
      keepExtensions: true,
      maxFileSize: 20 * 1024 * 1024, // Increased to 20 MB limit for testing
      allowEmptyFiles: false,
      multiples: false,
    });

    // Convert req to a readable stream
    console.log('📚 Converting request to readable stream...');
    const arrayBuffer = await req.arrayBuffer();
    console.log(`📏 Buffer size: ${arrayBuffer.byteLength} bytes`);
    const reqStream = Readable.from(Buffer.from(arrayBuffer));

    // Manually add headers required by formidable
    (reqStream as any).headers = Object.fromEntries(
      req.headers.entries()
    );
    console.log('📝 Request headers added to reqStream.');

    // Handle potential errors in the request stream
    reqStream.on('error', (err) => {
      console.error('❗ Error in reqStream:', err);
    });

    // Handle aborted requests
    reqStream.on('aborted', () => {
      console.error('❗ Request was aborted before completion');
    });

    // Parse form data and handle errors
    const parseForm = (req: any) =>
      new Promise<{
        fields: formidable.Fields;
        files: formidable.Files;
      }>((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.error(
            '⏰ Request timed out before parsing completion'
          );
          reject(new Error('Request timed out'));
        }, 300000); // 5 minutes timeout

        console.log('🔍 Parsing started...');
        // Correctly parse using form.parse
        form.parse(req, (err, fields, files) => {
          clearTimeout(timeout); // Clear timeout on success or error
          if (err) {
            console.error(
              '❗ Error parsing file with formidable:',
              err
            );
            reject(err);
          } else {
            console.log('✅ Form parsed successfully. Files:', files);
            resolve({ fields, files });
          }
        });
      });

    const { files } = await parseForm(reqStream);
    console.log('🎉 File parsing completed successfully.');

    // Check if a file was uploaded
    const file = Array.isArray(files.file)
      ? files.file[0]
      : files.file;
    if (!file || !(file as File).filepath) {
      console.error('❗ No valid file uploaded. File data:', file);
      return NextResponse.json(
        { error: 'No file uploaded.' },
        { status: 400 }
      );
    }

    // ✅ Resolve and verify the file path before sending to AI
    const resolvedPath = path.resolve(file.filepath as string);
    console.log('📂 Resolved file path:', resolvedPath);

    // ✅ Check if the file exists before sending to AI
    if (!fs.existsSync(resolvedPath)) {
      console.error(
        '❗ File not found at resolved path:',
        resolvedPath
      );
      return NextResponse.json(
        { error: 'File not found. Please try again.' },
        { status: 404 }
      );
    }

    // ✅ Log file path before sending to AI
    console.log(
      '🤖 Sending file to AI for extraction. File path:',
      resolvedPath
    );

    // ✅ Send file to AI for extraction with correct file path
    console.log('⚡ Starting AI data extraction...');
    const extractedData = await extractFinancialData(resolvedPath);
    console.log('✅ AI data extraction completed successfully.');

    console.log('📊 Extracted data:', extractedData);

    // Return successful response
    console.log('✅ Returning successful response...');
    return NextResponse.json({
      message: 'File processed successfully',
      filename: file.originalFilename || file.newFilename,
      financialMetrics: extractedData,
    });
  } catch (error: any) {
    console.error(
      '❗ Error processing file:',
      error.message || error,
      '\nStack trace:',
      error.stack || 'No stack trace available'
    );

    console.log('❗ Returning error response...');
    return NextResponse.json(
      {
        error: 'Internal server error. Please try again.',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
