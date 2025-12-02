const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const { auth } = require('../middleware/auth');

// Get Daraja access token
const getAccessToken = async () => {
  try {
    const consumerKey = process.env.MPESA_CONSUMER_KEY;
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    
    // Validate credentials exist
    if (!consumerKey || !consumerSecret) {
      throw new Error('M-Pesa Consumer Key or Secret is missing. Please check your .env file.');
    }
    
    // Remove any whitespace from credentials
    const cleanConsumerKey = consumerKey.trim();
    const cleanConsumerSecret = consumerSecret.trim();
    
    // Log credential info for debugging (without exposing full secrets)
    console.log('M-Pesa Credentials Check:');
    console.log('  Consumer Key length:', cleanConsumerKey.length);
    console.log('  Consumer Key preview:', cleanConsumerKey.substring(0, 8) + '...' + cleanConsumerKey.substring(cleanConsumerKey.length - 4));
    console.log('  Consumer Secret length:', cleanConsumerSecret.length);
    console.log('  Consumer Secret preview:', cleanConsumerSecret.substring(0, 8) + '...' + cleanConsumerSecret.substring(cleanConsumerSecret.length - 4));
    console.log('  Has whitespace issues:', consumerKey !== cleanConsumerKey || consumerSecret !== cleanConsumerSecret);
    
    const auth = Buffer.from(`${cleanConsumerKey}:${cleanConsumerSecret}`).toString('base64');

    console.log('Getting M-Pesa access token from: https://sandbox.safaricom.co.ke/oauth/v1/generate');
    const response = await axios.get(
      'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
      {
        headers: {
          Authorization: `Basic ${auth}`
        }
      }
    );

    if (!response.data || !response.data.access_token) {
      throw new Error('Failed to get access token from M-Pesa. Check your Consumer Key and Secret.');
    }

    console.log('✓ M-Pesa access token obtained successfully');
    return response.data.access_token;
  } catch (error) {
    console.error('Failed to get access token:', error);
    if (error.response) {
      console.error('M-Pesa OAuth Error:', error.response.data);
      throw new Error(`M-Pesa authentication failed: ${error.response.data?.error_description || error.response.data?.error || 'Invalid credentials'}`);
    }
    throw new Error('Failed to authenticate with M-Pesa. Please check your credentials.');
  }
};

// Initiate payment (STK Push)
router.post('/initiate', auth, async (req, res) => {
  try {
    const { bookingId, phoneNumber } = req.body;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.customer.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Validate and format phone number for M-Pesa
    if (!phoneNumber) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    // Remove all non-digit characters
    let formattedPhone = phoneNumber.replace(/\D/g, '');
    
    // Convert to M-Pesa format (254XXXXXXXXX - 12 digits total)
    if (formattedPhone.startsWith('0')) {
      // Remove leading 0 and add 254
      formattedPhone = '254' + formattedPhone.substring(1);
    } else if (formattedPhone.startsWith('254')) {
      // Already in correct format, keep as is
      formattedPhone = formattedPhone;
    } else if (formattedPhone.length === 9) {
      // 9 digits without country code, add 254
      formattedPhone = '254' + formattedPhone;
    } else {
      // Try to add 254 if it doesn't start with it
      if (!formattedPhone.startsWith('254')) {
        formattedPhone = '254' + formattedPhone;
      }
    }

    // Validate final format: must be exactly 12 digits starting with 254
    if (!/^254\d{9}$/.test(formattedPhone)) {
      return res.status(400).json({ 
        message: 'Invalid phone number format. Please use format: 0712345678 or 254712345678',
        received: phoneNumber,
        formatted: formattedPhone
      });
    }

    const amount = Math.round(booking.pricing.estimatedAmount); // Amount must be an integer
    const shortcode = process.env.MPESA_SHORTCODE?.trim();
    const passkey = process.env.MPESA_PASSKEY?.trim();
    
    // Validate M-Pesa credentials
    if (!shortcode || !passkey) {
      console.error('Missing M-Pesa credentials:', {
        hasShortcode: !!shortcode,
        hasPasskey: !!passkey
      });
      return res.status(500).json({ 
        message: 'M-Pesa configuration error. Shortcode or Passkey is missing. Please check your .env file.',
        error: 'Missing M-Pesa credentials'
      });
    }
    
    // Validate shortcode format (should be numeric)
    if (!/^\d+$/.test(shortcode)) {
      return res.status(500).json({ 
        message: 'Invalid M-Pesa Shortcode format. Should be numeric (e.g., 174379 for sandbox).',
        error: 'Invalid shortcode format'
      });
    }
    
    // Format timestamp: YYYYMMDDHHmmss (must be exactly 14 digits)
    const now = new Date();
    const timestamp = now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0') +
      String(now.getHours()).padStart(2, '0') +
      String(now.getMinutes()).padStart(2, '0') +
      String(now.getSeconds()).padStart(2, '0');
    
    // Validate timestamp format (must be 14 digits)
    if (timestamp.length !== 14) {
      return res.status(500).json({ 
        message: 'Internal error: Invalid timestamp format',
        error: 'Timestamp generation failed'
      });
    }
    
    // Generate password: Base64(Shortcode + Passkey + Timestamp)
    const passwordString = `${shortcode}${passkey}${timestamp}`;
    const password = Buffer.from(passwordString).toString('base64');
    
    console.log('Password Generation Details:');
    console.log('  Shortcode:', shortcode, '(type:', typeof shortcode + ')');
    console.log('  Passkey length:', passkey.length);
    console.log('  Passkey preview:', passkey.substring(0, 8) + '...' + passkey.substring(passkey.length - 4));
    console.log('  Timestamp:', timestamp);
    console.log('  Password string (first 50 chars):', passwordString.substring(0, 50) + '...');
    console.log('  Password (base64) length:', password.length);
    console.log('  Has all components:', !!(shortcode && passkey && timestamp));
    console.log('  ⚠️ IMPORTANT: Shortcode and Passkey must match the same app/shortcode in Daraja dashboard!');
    
    // Validate callback URL
    const callbackURL = process.env.MPESA_CALLBACK_URL || `${process.env.BACKEND_URL || 'https://your-domain.com'}/api/payments/callback`;
    
    // For sandbox, if no public URL is set, use a placeholder (but this will fail in production)
    if (callbackURL.includes('localhost') || callbackURL.includes('127.0.0.1')) {
      console.warn('⚠️ WARNING: Callback URL uses localhost. M-Pesa requires a publicly accessible URL.');
      console.warn('⚠️ For local testing, use ngrok or set MPESA_CALLBACK_URL to a public URL.');
      console.warn('⚠️ Example: ngrok http 5000, then set MPESA_CALLBACK_URL=https://your-ngrok-url.ngrok.io/api/payments/callback');
    }
    
    console.log('Payment Details:', {
      amount,
      originalPhoneNumber: phoneNumber,
      formattedPhoneNumber: formattedPhone,
      shortcode,
      timestamp,
      callbackURL,
      hasPasskey: !!passkey
    });

    let accessToken;
    try {
      accessToken = await getAccessToken();
      console.log('✓ Access token obtained successfully');
    } catch (tokenError) {
      console.error('✗ Failed to get access token:', tokenError.message);
      return res.status(500).json({ 
        message: 'Failed to authenticate with M-Pesa. Please check your Consumer Key and Consumer Secret.',
        error: tokenError.message
      });
    }

    // Ensure shortcode is a string (M-Pesa requires string, not number)
    const businessShortCode = String(shortcode);
    
    // Clean callback URL (remove any line breaks or extra spaces)
    const cleanCallbackURL = callbackURL.trim().replace(/\s+/g, '');
    
    const stkPushPayload = {
      BusinessShortCode: businessShortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: formattedPhone,
      PartyB: businessShortCode,
      PhoneNumber: formattedPhone,
      CallBackURL: cleanCallbackURL,
      AccountReference: bookingId.toString(),
      TransactionDesc: 'WekaCargo Booking Payment'
    };

    console.log('=== STK Push Request Details ===');
    console.log('Business ShortCode:', businessShortCode);
    console.log('Transaction Type: CustomerPayBillOnline');
    console.log('Amount:', amount);
    console.log('Customer Phone:', formattedPhone);
    console.log('Callback URL:', cleanCallbackURL);
    console.log('STK Push Payload:', JSON.stringify(stkPushPayload, null, 2));
    console.log('Phone Number Validation:', {
      original: phoneNumber,
      formatted: formattedPhone,
      isValid: /^254\d{9}$/.test(formattedPhone),
      length: formattedPhone.length
    });
    
    const response = await axios.post(
      'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      stkPushPayload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('M-Pesa STK Push Response:', JSON.stringify(response.data, null, 2));

    // Check if STK Push was successful
    if (response.data.ResponseCode !== '0') {
      const errorMessage = response.data.CustomerMessage || response.data.errorMessage || 'STK Push failed';
      console.error('STK Push failed:', errorMessage);
      return res.status(400).json({ 
        message: errorMessage,
        errorCode: response.data.ResponseCode,
        details: response.data
      });
    }

    // Check if we got a CheckoutRequestID
    if (!response.data.CheckoutRequestID) {
      console.error('No CheckoutRequestID in response:', response.data);
      return res.status(400).json({ 
        message: 'Failed to initiate payment. Please try again.',
        details: response.data
      });
    }

    // Create payment record
    const payment = new Payment({
      booking: bookingId,
      customer: req.user.id,
      trucker: booking.trucker,
      amount,
      mpesaDetails: response.data,
      status: 'processing',
      escrowStatus: 'held'
    });

    await payment.save();

    // Update booking payment status
    booking.payment.paymentId = payment._id;
    booking.payment.status = 'processing'; // Changed from 'paid' to 'processing' until confirmed
    await booking.save();

    res.json({
      message: 'Payment initiated successfully. Please check your phone for the M-Pesa prompt.',
      checkoutRequestID: response.data.CheckoutRequestID,
      customerMessage: response.data.CustomerMessage
    });
  } catch (error) {
    console.error('Payment initiation error:', error);
    
    // Provide more detailed error information
    let errorMessage = 'Failed to initiate payment';
    let errorDetails = null;
    
    if (error.response) {
      // M-Pesa API returned an error
      errorMessage = error.response.data?.errorMessage || 
                    error.response.data?.CustomerMessage || 
                    error.response.data?.message || 
                    'M-Pesa API error';
      errorDetails = error.response.data;
      console.error('M-Pesa API Error Response:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      // Request was made but no response received
      errorMessage = 'No response from M-Pesa. Please check your internet connection and try again.';
      console.error('No response from M-Pesa API');
    } else {
      // Error in setting up the request
      errorMessage = error.message || 'Failed to initiate payment';
      console.error('Request setup error:', error.message);
    }
    
    res.status(500).json({ 
      message: errorMessage,
      details: errorDetails
    });
  }
});

// Payment callback (webhook)
router.post('/callback', async (req, res) => {
  try {
    const result = req.body.Body.stkCallback;

    if (result.ResultCode === 0) {
      // Payment successful
      const payment = await Payment.findOne({
        'mpesaDetails.CheckoutRequestID': result.CheckoutRequestID
      });

      if (payment) {
        payment.status = 'completed';
        payment.transactionReference = result.MerchantRequestID;
        payment.paidAt = new Date();
        await payment.save();
      }
    }

    res.json({ message: 'Callback received' });
  } catch (error) {
    console.error('Callback error:', error);
    res.status(500).json({ message: 'Callback processing failed' });
  }
});

// Release payment to trucker (escrow release)
router.post('/release/:paymentId', auth, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.paymentId);
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    const booking = await Booking.findById(payment.booking);
    if (booking.status !== 'completed') {
      return res.status(400).json({ message: 'Booking must be completed first' });
    }

    if (req.user.role !== 'admin' && req.user.role !== 'customer') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    payment.escrowStatus = 'released';
    payment.releasedAt = new Date();
    await payment.save();

    res.json({ message: 'Payment released successfully' });
  } catch (error) {
    console.error('Release payment error:', error);
    res.status(500).json({ message: 'Failed to release payment' });
  }
});

// Refund payment (manual refund - for admin or when payment was already released)
router.post('/refund/:paymentId', auth, async (req, res) => {
  try {
    const { refundReason } = req.body;
    const payment = await Payment.findById(req.params.paymentId);
    
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    const booking = await Booking.findById(payment.booking);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Authorization: Admin can refund any payment, customer can refund their own
    if (req.user.role !== 'admin' && payment.customer.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to refund this payment' });
    }

    // Check if payment can be refunded
    if (payment.status === 'refunded') {
      return res.status(400).json({ message: 'Payment has already been refunded' });
    }

    if (payment.status === 'pending' || payment.status === 'failed') {
      return res.status(400).json({ message: 'Payment cannot be refunded (not completed)' });
    }

    // Update payment status
    payment.status = 'refunded';
    payment.escrowStatus = 'refunded';
    payment.refundedAt = new Date();
    if (refundReason) {
      payment.refundReason = refundReason;
    }
    await payment.save();

    // Update booking payment status
    if (booking.payment && booking.payment.paymentId && booking.payment.paymentId.toString() === payment._id.toString()) {
      booking.payment.status = 'refunded';
      await booking.save();
    }

    // Create notification for customer
    try {
      const Notification = require('../models/Notification');
      await Notification.create({
        user: payment.customer,
        type: 'system',
        title: 'Payment Refunded',
        message: `Your payment of KES ${payment.amount.toLocaleString()} has been refunded. ${refundReason ? `Reason: ${refundReason}` : ''}`,
        relatedBooking: booking._id
      });
    } catch (notifError) {
      console.error('Failed to create refund notification:', notifError);
    }

    console.log(`✓ Payment refunded manually: Payment ${payment._id}, Amount: KES ${payment.amount}`);

    res.json({ 
      message: 'Payment refunded successfully',
      payment: {
        id: payment._id,
        amount: payment.amount,
        status: payment.status,
        refundedAt: payment.refundedAt
      }
    });
  } catch (error) {
    console.error('Refund payment error:', error);
    res.status(500).json({ message: 'Failed to refund payment' });
  }
});

module.exports = router;

