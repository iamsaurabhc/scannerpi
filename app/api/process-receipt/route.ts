import { OpenAI } from 'openai';
import { NextResponse } from 'next/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function POST(request: Request) {
  try {
    console.log('Starting receipt processing...');
    const { image } = await request.json();
    
    if (!image || !image.startsWith('data:image')) {
      return NextResponse.json({ error: 'Invalid image data' }, { status: 400 });
    }

    console.log('Sending request to OpenAI...');
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extract information from this receipt image and return it in the following JSON format ONLY (no other text):
                {
                "merchant": {
                    "name": "Store Name",
                    "store_number": "Store #XXX",
                    "address": "Full Street Address, City, State ZIP",
                    "telephone": ["XXX-XXX-XXXX", "XXX-XXX-XXXX"]
                },
                "date": "MM/DD/YYYY",
                "time": "HH:MM AM/PM",
                "total": "$XX.XX",
                "items": [
                    {
                    "category": "Department/Category name if available",
                    "description": "Item name/description",
                    "quantity": "X",
                    "unit_price": "$XX.XX",
                    "total": "$XX.XX"
                    }
                ],
                "subtotal": "$XX.XX",
                "tax": "$XX.XX",
                "payment": {
                    "method": "Payment method if available",
                    "card_last4": "Last 4 digits if available"
                }
                }`,
            },
            {
              type: "image_url",
              image_url: {
                url: image
              }
            }
          ]
        }
      ],
      max_tokens: 1000,
      response_format: { type: "json_object" }
    });

    console.log('OpenAI response received');
    
    let extractedData;
    try {
      // Clean the response content of any markdown formatting
      const content = response.choices[0].message.content?.trim().replace(/```json\n?|\n?```/g, '') || '{}';
      extractedData = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response as JSON:', parseError);
      console.error('Raw response:', response.choices[0].message.content);
      return NextResponse.json(
        { error: 'Failed to parse receipt data' },
        { status: 422 }
      );
    }

    console.log('Extracted data:', extractedData);
    return NextResponse.json(extractedData);
  } catch (error) {
    console.error('Error processing receipt:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to process receipt' },
      { status: 500 }
    );
  }
} 