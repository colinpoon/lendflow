import { readFileSync, existsSync } from 'fs';
import path from 'path';
import OpenAI from 'openai';
import pdfParse from 'pdf-parse';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const extractFinancialData = async (filePath: string) => {
  try {
    // Resolve the absolute path of the file
    const resolvedPath = path.resolve(filePath);
    console.log('📂 Attempting to read file at path:', resolvedPath);

    // Check if the file exists before proceeding
    if (!existsSync(resolvedPath)) {
      throw new Error(`❗ File not found at path: ${resolvedPath}`);
    }
    // Validate if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      throw new Error(
        'OpenAI API key is missing. Please configure it in the environment variables.'
      );
    }

    console.log('📚 Checking file type before reading...');
    let fileContent: string;

    // Check if the file is a PDF by checking its extension
    if (filePath.endsWith('.pdf')) {
      console.log(
        '📄 Detected PDF file. Extracting text with pdf-parse...'
      );
      const dataBuffer = readFileSync(resolvedPath);
      const pdfData = await pdfParse(dataBuffer);
      fileContent = pdfData.text; // Extracted text from PDF
      console.log('✅ PDF content extracted successfully.');
    } else {
      console.log('📚 Reading non-PDF file as text...');
      fileContent = readFileSync(resolvedPath, 'utf-8');
    }

    console.log(
      '📚 File content read successfully. Sending to AI...'
    );

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        {
          role: 'system',
          content:
            'Extract financial metrics from the provided text, including Net Income, Expenses, Profit Margins, Interest, Taxes, Depreciation, and Amortization. Also, compute EBITDA.',
        },
        {
          role: 'user',
          content: fileContent,
        },
      ],
      max_tokens: 1000, // Increase token limit to handle larger responses
      temperature: 0.3, // Lower temperature for more structured responses
    });

    const extractedText =
      response?.choices?.[0]?.message?.content || '{}';

    // Log the raw AI response for debugging
    console.log('🤖 Raw AI response:', extractedText);

    // Check if the response is a valid JSON string or a plain error message
    if (
      typeof extractedText === 'string' &&
      (extractedText.startsWith('The provided') ||
        extractedText.includes('error'))
    ) {
      throw new Error('OpenAI API Error: ' + extractedText);
    }

    try {
      // Attempt to parse JSON response
      return JSON.parse(extractedText);
    } catch (jsonError) {
      console.error('Failed to parse AI response:', jsonError);
      throw new Error(
        'Error parsing AI response. Check the response format.'
      );
    }
  } catch (error: any) {
    console.error(
      '❗ OpenAI API Error:',
      error.message || 'Unknown error'
    );
    throw new Error(
      'AI processing failed: ' + (error?.message || 'Unknown error')
    );
  }
};
