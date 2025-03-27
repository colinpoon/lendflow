import { NextApiRequest, NextApiResponse } from 'next';
import formidable, { IncomingForm, File } from 'formidable';
import fs from 'fs';
import path from 'path';
import { extractFinancialData } from '@/utils/aiProcessor';

export const config = {
  api: {
    bodyParser: false,
  },
};

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Configure formidable to store files in 'uploads' directory
  const uploadDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
  }

  const form = new formidable.IncomingForm({
    uploadDir: uploadDir, // Correct way to set upload directory
    keepExtensions: true, // Correctly configured
    maxFileSize: 5 * 1024 * 1024, // Optional: Set max file size (5 MB)
    allowEmptyFiles: false,
    multiples: false,
    // debug: true, // Enable debugging for more info
  });

  // Track file upload progress and errors
  form.on('fileBegin', (name, file) => {
    console.log(`Starting file upload: ${file.originalFilename}`);
  });

  form.on('progress', (bytesReceived, bytesExpected) => {
    console.log(
      `Upload progress: ${(bytesReceived / bytesExpected) * 100}%`
    );
  });

  form.on('error', (err) => {
    console.error('Formidable error:', err);
  });

  const parseForm = (req: NextApiRequest) =>
    new Promise<{
      fields: formidable.Fields;
      files: formidable.Files;
    }>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) {
          console.error('Error parsing file with formidable:', err);
          reject(err);
        } else {
          console.log('File parsed successfully:', files);
          resolve({ fields, files });
        }
      });
    });

  try {
    console.log('Starting file parse...');
    const { files } = await parseForm(req);
    console.log('File parsing completed. Files:', files);

    const file = files.file as File | File[] | undefined;

    // Handle case where file is undefined or an array
    if (!file || Array.isArray(file)) {
      console.error('No valid file uploaded. File data:', file);
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    console.log('Sending file to AI:', file.filepath);

    // Extract data using OpenAI or other processors
    const extractedData = await extractFinancialData(
      file.filepath as string
    );

    // Return success response with extracted data
    return res.status(200).json({
      message: 'File processed successfully',
      filename: file.originalFilename || file.newFilename, // Corrected usage
      financialMetrics: extractedData,
    });
  } catch (error: any) {
    console.error('Error processing file:', error.message);
    console.error('Error processing file:', error);

    // Log detailed error information
    if (error.response) {
      console.error('API Response Error:', error.response.data);
    } else if (error.request) {
      console.error('No Response from API:', error.request);
    } else {
      console.error('Error Message:', error.message);
    }

    return res
      .status(500)
      .json({ error: 'Internal server error. Please try again.' });
  }
};

export default handler;
