const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const { auth } = require('../middleware/auth');
const getAccessToken = async () => {
  try {
    const consumerKey = process.env.MPESA_CONSUMER_KEY;
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    if (!consumerKey || !consumerSecret) {
      throw new Error('M-Pesa Consumer Key or Secret is missing. Please check your .env file.');
    }
    const cleanConsumerKey = consumerKey.replace(/\s+/g, '').trim();
    const cleanConsumerSecret = consumerSecret.replace(/\s+/g, '').trim();
    if (!cleanConsumerKey || cleanConsumerKey.length < 10) {
      throw new Error('Consumer Key appears to be invalid (too short or empty)');
    }
    if (!cleanConsumerSecret || cleanConsumerSecret.length < 10) {
      throw new Error('Consumer Secret appears to be invalid (too short or empty)');
    }
    console.log('M-Pesa Credentials Check:');
    console.log('  Consumer Key length:', cleanConsumerKey.length);
    console.log('  Consumer Key preview:', cleanConsumerKey.substring(0, 8) + '...' + cleanConsumerKey.substring(cleanConsumerKey.length - 4));
    console.log('  Consumer Secret length:', cleanConsumerSecret.length);
    console.log('  Consumer Secret preview:', cleanConsumerSecret.substring(0, 8) + '...' + cleanConsumerSecret.substring(cleanConsumerSecret.length - 4));
    console.log('  Has whitespace issues:', consumerKey !== cleanConsumerKey || consumerSecret !== cleanConsumerSecret);
    console.log('  Original Consumer Key length:', consumerKey.length);
    console.log('  Original Consumer Secret length:', consumerSecret.length);
    const auth = Buffer.from(`${cleanConsumerKey}:${cleanConsumerSecret}`).toString('base64');
    console.log('Getting M-Pesa access token from: https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials');
    console.log('Auth header length:', auth.length);
    console.log('Auth header preview:', auth.substring(0, 20) + '...');
    const response = await axios.get(
      'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
      {
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000 
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
      console.error('M-Pesa OAuth Error Response:', JSON.stringify(error.response.data, null, 2));
      console.error('M-Pesa OAuth Error Status:', error.response.status);
      const errorData = error.response.data;
      const errorMessage = errorData?.error_description || errorData?.error || errorData?.errorMessage || 'Invalid credentials';
      if (errorMessage.toLowerCase().includes('wrong credentials') || 
          errorMessage.toLowerCase().includes('invalid') ||
          errorData?.errorCode === '500.001.1001') {
        console.error('⚠️ CREDENTIALS ERROR DETECTED');
        console.error('   This usually means:');
        console.error('   1. Consumer Key or Secret is incorrect');
        console.error('   2. Credentials don\'t match your Daraja app');
        console.error('   3. Credentials are for production but using sandbox (or vice versa)');
        console.error('   4. Credentials have been regenerated in Daraja dashboard');
        throw new Error(`M-Pesa authentication failed: ${errorMessage}. Please verify your Consumer Key and Consumer Secret in the Daraja dashboard (https://developer.safaricom.co.ke/)`);
      }
      throw new Error(`M-Pesa authentication failed: ${errorMessage}`);
    } else if (error.request) {
      console.error('No response received from M-Pesa API');
      throw new Error('No response from M-Pesa API. Please check your internet connection.');
    } else {
      console.error('Request setup error:', error.message);
      throw new Error(`Failed to authenticate with M-Pesa: ${error.message}`);
    }
  }
};
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
    if (!phoneNumber) {
      return res.status(400).json({ message: 'Phone number is required' });
    }
    let formattedPhone = phoneNumber.replace(/\D/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '254' + formattedPhone.substring(1);
    } else if (formattedPhone.startsWith('254')) {
      formattedPhone = formattedPhone;
    } else if (formattedPhone.length === 9) {
      formattedPhone = '254' + formattedPhone;
    } else {
      if (!formattedPhone.startsWith('254')) {
        formattedPhone = '254' + formattedPhone;
      }
    }
    if (!/^254\d{9}$/.test(formattedPhone)) {
      return res.status(400).json({ 
        message: 'Invalid phone number format. Please use format: 0712345678 or 254712345678',
        received: phoneNumber,
        formatted: formattedPhone
      });
    }
    const amount = Math.round(booking.pricing.estimatedAmount); 
    let shortcode = process.env.MPESA_SHORTCODE?.replace(/\s+/g, '').trim();
    const passkey = process.env.MPESA_PASSKEY?.replace(/\s+/g, '').trim();
    if (!shortcode || shortcode === 'your-mpesa-shortcode' || shortcode.toLowerCase().includes('your') || shortcode.toLowerCase().includes('example')) {
      return res.status(500).json({ 
        message: 'M-Pesa Shortcode is not configured. Please set MPESA_SHORTCODE in your backend/.env file. For sandbox testing, use: 174379',
        error: 'Shortcode not configured',
        help: 'Add this to your backend/.env file: MPESA_SHORTCODE=174379 (for sandbox)'
      });
    }
    if (!shortcode || !passkey || passkey === 'your-mpesa-passkey' || passkey.toLowerCase().includes('your') || passkey.toLowerCase().includes('example')) {
      console.error('Missing M-Pesa credentials:', {
        hasShortcode: !!shortcode && shortcode !== 'your-mpesa-shortcode',
        hasPasskey: !!passkey && passkey !== 'your-mpesa-passkey',
        shortcodeValue: shortcode?.substring(0, 10) + '...',
        passkeyValue: passkey ? '***' : 'missing'
      });
      return res.status(500).json({ 
        message: 'M-Pesa configuration error. Shortcode or Passkey is missing or not properly configured. Please check your backend/.env file.',
        error: 'Missing M-Pesa credentials',
        help: 'You need to configure MPESA_SHORTCODE and MPESA_PASSKEY in your backend/.env file. Get these from your M-Pesa Daraja dashboard.'
      });
    }
    if (!/^\d+$/.test(shortcode)) {
      return res.status(500).json({ 
        message: `Invalid M-Pesa Shortcode format. Should be numeric only (e.g., 174379 for sandbox). Current value: "${shortcode.substring(0, 20)}..."`,
        error: 'Invalid shortcode format',
        help: 'The shortcode must contain only numbers. Remove any spaces, letters, or special characters.'
      });
    }
    const now = new Date();
    const timestamp = now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0') +
      String(now.getHours()).padStart(2, '0') +
      String(now.getMinutes()).padStart(2, '0') +
      String(now.getSeconds()).padStart(2, '0');
    if (timestamp.length !== 14) {
      return res.status(500).json({ 
        message: 'Internal error: Invalid timestamp format',
        error: 'Timestamp generation failed'
      });
    }
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
    const callbackURL = process.env.MPESA_CALLBACK_URL || `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/payments/callback`;
    if (callbackURL.includes('localhost') || callbackURL.includes('127.0.0.1')) {
      console.warn('⚠️ WARNING: Callback URL uses localhost.');
      console.warn('⚠️ STK Push will still work, but payment confirmation callback won\'t be received.');
      console.warn('⚠️ For full functionality, use ngrok: ngrok http 5000');
      console.warn('⚠️ Then set: MPESA_CALLBACK_URL=https://your-ngrok-url.ngrok.io/api/payments/callback');
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
    const businessShortCode = String(shortcode);
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
    if (response.data.ResponseCode !== '0') {
      const errorMessage = response.data.CustomerMessage || response.data.errorMessage || 'STK Push failed';
      console.error('STK Push failed:', errorMessage);
      console.error('Response Code:', response.data.ResponseCode);
      console.error('Full Response:', JSON.stringify(response.data, null, 2));
      let userFriendlyMessage = errorMessage;
      if (response.data.ResponseCode === '1032' || response.data.ResponseCode === '1037') {
        userFriendlyMessage = 'Request cancelled by user or timeout. Please try again.';
      } else if (response.data.ResponseCode === '1031' || response.data.ResponseCode === '1034') {
        userFriendlyMessage = 'Request cancelled. Please check your phone and try again.';
      } else if (response.data.ResponseCode === '2001' || response.data.ResponseCode === '2002') {
        userFriendlyMessage = 'Invalid phone number or amount. Please check and try again.';
      } else if (response.data.ResponseCode === '400.002.02') {
        userFriendlyMessage = 'Invalid shortcode or passkey. Please check your M-Pesa credentials.';
      }
      return res.status(400).json({ 
        message: userFriendlyMessage,
        errorCode: response.data.ResponseCode,
        originalMessage: errorMessage,
        details: response.data
      });
    }
    if (!response.data.CheckoutRequestID) {
      console.error('No CheckoutRequestID in response:', response.data);
      return res.status(400).json({ 
        message: 'Failed to initiate payment. Please try again.',
        details: response.data
      });
    }
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
    booking.payment.paymentId = payment._id;
    booking.payment.status = 'processing'; 
    await booking.save();
    res.json({
      message: 'Payment initiated successfully. Please check your phone for the M-Pesa prompt.',
      checkoutRequestID: response.data.CheckoutRequestID,
      customerMessage: response.data.CustomerMessage
    });
  } catch (error) {
    console.error('Payment initiation error:', error);
    let errorMessage = 'Failed to initiate payment';
    let errorDetails = null;
    if (error.response) {
      errorMessage = error.response.data?.errorMessage || 
                    error.response.data?.CustomerMessage || 
                    error.response.data?.message || 
                    'M-Pesa API error';
      errorDetails = error.response.data;
      console.error('M-Pesa API Error Response:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      errorMessage = 'No response from M-Pesa. Please check your internet connection and try again.';
      console.error('No response from M-Pesa API');
    } else {
      errorMessage = error.message || 'Failed to initiate payment';
      console.error('Request setup error:', error.message);
    }
    res.status(500).json({ 
      message: errorMessage,
      details: errorDetails
    });
  }
});
router.post('/callback', async (req, res) => {
  try {
    const result = req.body.Body.stkCallback;
    if (result.ResultCode === 0) {
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
    if (req.user.role !== 'admin' && payment.customer.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to refund this payment' });
    }
    if (payment.status === 'refunded') {
      return res.status(400).json({ message: 'Payment has already been refunded' });
    }
    if (payment.status === 'pending' || payment.status === 'failed') {
      return res.status(400).json({ message: 'Payment cannot be refunded (not completed)' });
    }
    payment.status = 'refunded';
    payment.escrowStatus = 'refunded';
    payment.refundedAt = new Date();
    if (refundReason) {
      payment.refundReason = refundReason;
    }
    await payment.save();
    if (booking.payment && booking.payment.paymentId && booking.payment.paymentId.toString() === payment._id.toString()) {
      booking.payment.status = 'refunded';
      await booking.save();
    }
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
