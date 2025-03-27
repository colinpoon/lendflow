import { readFileSync } from 'fs';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const extractFinancialData = async (filePath: string) => {
  try {
    // Validate if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      throw new Error(
        'OpenAI API key is missing. Please configure it in the environment variables.'
      );
    }
    const fileContent = readFileSync(filePath, 'utf-8');

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
    });

    const extractedText =
      response?.choices?.[0]?.message?.content || '{}';
    try {
      return JSON.parse(extractedText);
    } catch (jsonError) {
      console.error('Failed to parse AI response:', jsonError);
      throw new Error(
        'Error parsing AI response. Check the response format.'
      );
    }
  } catch (error: any) {
    console.error(
      'OpenAI API Error:',
      error.message || 'Unknown error'
    );
    throw new Error(
      'AI processing failed: ' + (error?.message || 'Unknown error')
    );
  }
};
