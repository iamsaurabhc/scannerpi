import { OpenAI } from 'openai';
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function POST(request: Request) {
  try {
    const { image, projectId, receiptId } = await request.json();
    console.log('Received request:', {
      hasImage: !!image,
      projectId,
      receiptId
    });
    if (!image) {
      return NextResponse.json(
        { error: 'Image data is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // If receiptId is provided, fetch the existing receipt
    if (receiptId) {
      const { data: existingReceipt, error: fetchError } = await supabase
        .from('receipts')
        .select('*')
        .eq('id', receiptId)
        .single();

      if (fetchError || !existingReceipt) {
        throw new Error('Receipt not found');
      }

      // Use the project_id from the existing receipt
      return processReceipt(existingReceipt.raw_image_url, existingReceipt.project_id);
    }

    // For direct image upload flow
    if (!image) {
      return NextResponse.json(
        { error: 'Image is required' },
        { status: 400 }
      );
    }

    // Only validate projectId if not in preview mode
    if (!projectId && process.env.NODE_ENV !== 'development') {
      return NextResponse.json(
        { error: 'ProjectId is required' },
        { status: 400 }
      );
    }

    return processReceipt(image, projectId);
  } catch (error: any) {
    console.error('API Error:', {
      message: error.message,
      stack: error.stack,
      error
    });
    return NextResponse.json(
      { error: (error as Error).message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to process the receipt
async function processReceipt(image: string, projectId: string) {
  const supabase = await createClient();
  
  // Validate image data
  if (!image.startsWith('data:image/')) {
    throw new Error('Invalid image format');
  }

  // Extract base64 data - handle both with and without data URI prefix
  const base64Data = image.includes('base64,') 
    ? image.split('base64,')[1] 
    : image;

  try {
    // 1. Upload image to Supabase Storage
    const fileName = `receipts/${projectId}/${Date.now()}.jpg`;
    const { data: fileData, error: uploadError } = await supabase.storage
      .from('receipts')
      .upload(fileName, Buffer.from(base64Data, 'base64'), {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error(`Failed to upload image: ${uploadError.message}`);
    }

    // 2. Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from('receipts')
      .getPublicUrl(fileName);

    // 3. Create initial receipt record
    const { data: receipt, error: insertError } = await supabase
      .from('receipts')
      .insert([
        {
          project_id: projectId,
          status: 'processing',
          raw_image_url: publicUrl
        }
      ])
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      throw new Error('Failed to create receipt record');
    }

    // 4. Process with OpenAI
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
                    "telephone": ["XXX-XXX-XXXX"]
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
                }`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Data}`
              }
            }
          ]
        }
      ],
      max_tokens: 1000,
      response_format: { type: "json_object" }
    });

    // 5. Parse the response and update the receipt record
    const extractedData = JSON.parse(response.choices[0].message.content || '{}');
    
    await updateReceiptData(supabase, receipt, extractedData);

    return NextResponse.json({ success: true, data: extractedData });
  } catch (error) {
    console.error('Error processing receipt:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

async function updateReceiptData(supabase: any, receipt: any, extractedData: any) {
  try {
    // 1. Update or create merchant
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .upsert({
        name: extractedData.merchant?.name || 'Unknown Merchant',
        store_number: extractedData.merchant?.store_number,
        address: extractedData.merchant?.address,
        // Parse city, state, postal from address if available
        city: extractedData.merchant?.address?.split(',')[1]?.trim(),
        state: extractedData.merchant?.address?.split(',')[2]?.split(' ')[1],
        postal_code: extractedData.merchant?.address?.split(',')[2]?.split(' ')[2]
      }, {
        onConflict: 'name,store_number',
        returning: true
      })
      .select()
      .single();

    if (merchantError) throw merchantError;

    // 2. Add merchant phone numbers if available
    if (extractedData.merchant?.telephone?.length > 0) {
      const phoneNumbers = extractedData.merchant.telephone.map((phone: string) => ({
        merchant_id: merchant.id,
        phone_number: phone
      }));

      const { error: phonesError } = await supabase
        .from('merchant_phones')
        .upsert(phoneNumbers, {
          onConflict: 'merchant_id,phone_number'
        });

      if (phonesError) throw phonesError;
    }

    // 3. Link receipt to merchant
    const { error: receiptMerchantError } = await supabase
      .from('receipt_merchants')
      .upsert({
        receipt_id: receipt.id,
        merchant_id: merchant.id
      });

    if (receiptMerchantError) throw receiptMerchantError;

    // 4. Update receipt details
    const { error: receiptError } = await supabase
      .from('receipts')
      .update({
        status: 'completed',
        receipt_date: extractedData.date,
        receipt_time: extractedData.time,
        subtotal: extractedData.subtotal?.replace('$', ''),
        tax: extractedData.tax?.replace('$', ''),
        total: extractedData.total?.replace('$', ''),
        updated_at: new Date().toISOString()
      })
      .eq('id', receipt.id);

    if (receiptError) throw receiptError;

    // 5. Add line items
    if (extractedData.items?.length > 0) {
      const lineItems = extractedData.items.map((item: any) => ({
        receipt_id: receipt.id,
        category: item.category,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price?.replace('$', ''),
        total: item.total?.replace('$', '')
      }));

      const { error: lineItemsError } = await supabase
        .from('line_items')
        .insert(lineItems);

      if (lineItemsError) throw lineItemsError;
    }

    // 6. Add payment method if available
    if (extractedData.payment) {
      const { error: paymentError } = await supabase
        .from('payment_methods')
        .insert({
          receipt_id: receipt.id,
          method: extractedData.payment.method,
          card_last4: extractedData.payment.card_last4
        });

      if (paymentError) throw paymentError;
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating receipt data:', error);
    throw error;
  }
} 