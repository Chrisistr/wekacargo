const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const { auth } = require('../middleware/auth');

function resolveMpesaCallbackUrl() {
  const explicit = (process.env.MPESA_CALLBACK_URL || '').trim().replace(/\s+/g, '');
  if (explicit) {
    return explicit.replace(/\/+$/, '');
  }
  const base = (process.env.BACKEND_URL || '').trim().replace(/\/+$/, '');
  if (!base) return '';
  try {
    const u = new URL(base);
    if (
      u.protocol === 'https:' &&
      u.hostname !== 'localhost' &&
      u.hostname !== '127.0.0.1'
    ) {
      return `${base}/api/payments/callback`.replace(/\s+/g, '').replace(/\/+$/, '');
    }
  } catch {
    /* ignore */
  }
  return '';
}

function validateMpesaCallbackUrl(urlString) {
  if (!urlString || !String(urlString).trim()) {
    return {
      ok: false,
      message:
        'Set MPESA_CALLBACK_URL in backend/.env to a public HTTPS URL. Local dev: run "ngrok http 5001" (use your PORT), then set MPESA_CALLBACK_URL=https://YOUR-SUBDOMAIN.ngrok-free.app/api/payments/callback — restart the backend after saving.',
    };
  }
  let url;
  try {
    url = new URL(urlString);
  } catch {
    return {
      ok: false,
      message:
        'MPESA_CALLBACK_URL must be a full URL, e.g. https://YOUR-NGROK.ngrok-free.app/api/payments/callback',
    };
  }
  if (url.protocol !== 'https:') {
    return {
      ok: false,
      message:
        'M-Pesa requires an HTTPS CallBackURL. Use ngrok (https) or your deployed API URL in MPESA_CALLBACK_URL.',
    };
  }
  const host = url.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '[::1]' ||
    host === '::1' ||
    host.startsWith('192.168.') ||
    /^10\.\d+\.\d+\.\d+$/.test(host) ||
    host.endsWith('.local')
  ) {
    return {
      ok: false,
      message:
        'M-Pesa cannot use localhost or private networks as CallBackURL. Run: ngrok http <your backend port>, then set MPESA_CALLBACK_URL=https://YOUR-SUBDOMAIN.ngrok-free.app/api/payments/callback in backend/.env',
    };
  }
  return { ok: true, url: urlString };
}

function mpesaTimestampNairobi() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const g = (type) => parts.find((p) => p.type === type)?.value ?? '';
  return `${g('year')}${g('month')}${g('day')}${g('hour')}${g('minute')}${g('second')}`;
}

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
    const auth = Buffer.from(`${cleanConsumerKey}:${cleanConsumerSecret}`).toString('base64');
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
    return response.data.access_token;
  } catch (error) {
    if (error.response) {
      console.error('M-Pesa OAuth failed:', error.response.status, error.response.data);
      const errorData = error.response.data;
      const errorMessage = errorData?.error_description || errorData?.error || errorData?.errorMessage || 'Invalid credentials';
      if (errorMessage.toLowerCase().includes('wrong credentials') || 
          errorMessage.toLowerCase().includes('invalid') ||
          errorData?.errorCode === '500.001.1001') {
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
    const timestamp = mpesaTimestampNairobi();
    if (timestamp.length !== 14) {
      return res.status(500).json({ 
        message: 'Internal error: Invalid timestamp format',
        error: 'Timestamp generation failed'
      });
    }
    const passwordString = `${shortcode}${passkey}${timestamp}`;
    const password = Buffer.from(passwordString).toString('base64');
    const callbackURL = resolveMpesaCallbackUrl();
    const callbackCheck = validateMpesaCallbackUrl(callbackURL);
    if (!callbackCheck.ok) {
      console.error('M-Pesa CallBackURL invalid:', callbackURL, callbackCheck.message);
      return res.status(400).json({
        message: callbackCheck.message,
        error: 'Invalid CallBackURL',
      });
    }
    const cleanCallbackURL = callbackCheck.url.trim().replace(/\s+/g, '');
    let accessToken;
    try {
      accessToken = await getAccessToken();
    } catch (tokenError) {
      console.error('M-Pesa token error:', tokenError.message);
      return res.status(500).json({ 
        message: 'Failed to authenticate with M-Pesa. Please check your Consumer Key and Consumer Secret.',
        error: tokenError.message
      });
    }
    const businessShortCode = String(shortcode);
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
    if (response.data.ResponseCode !== '0') {
      const errorMessage = response.data.CustomerMessage || response.data.errorMessage || 'STK Push failed';
      console.error('STK Push failed:', response.data.ResponseCode, errorMessage);
      let userFriendlyMessage = errorMessage;
      if (response.data.ResponseCode === '1032' || response.data.ResponseCode === '1037') {
        userFriendlyMessage = 'Request cancelled by user or timeout. Please try again.';
      } else if (response.data.ResponseCode === '1031' || response.data.ResponseCode === '1034') {
        userFriendlyMessage = 'Request cancelled. Please check your phone and try again.';
      } else if (response.data.ResponseCode === '2001' || response.data.ResponseCode === '2002') {
        userFriendlyMessage = 'Invalid phone number or amount. Please check and try again.';
      } else if (response.data.ResponseCode === '400.002.02') {
        userFriendlyMessage =
          'Invalid CallBackURL (must be public HTTPS). Set MPESA_CALLBACK_URL in backend/.env — use ngrok for local dev.';
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
    let httpStatus = 500;
    if (error.response) {
      const data = error.response.data;
      errorDetails = data;
      errorMessage =
        data?.errorMessage ||
        data?.CustomerMessage ||
        data?.message ||
        'M-Pesa API error';
      if (data?.errorCode === '400.002.02' || String(errorMessage).includes('Invalid CallBackURL')) {
        errorMessage =
          'Invalid M-Pesa CallBackURL. Set MPESA_CALLBACK_URL in backend/.env to a public HTTPS URL, e.g. https://xxxx.ngrok-free.app/api/payments/callback (run: ngrok http <backend port>).';
      }
      const reqUrl = error.config?.url || '';
      if (
        reqUrl.includes('stkpush') &&
        (data?.errorCode === '500.001.1001' ||
          String(data?.errorMessage || '').toLowerCase().includes('wrong credentials'))
      ) {
        errorMessage =
          'M-Pesa rejected the STK security password (shortcode + passkey + timestamp). Your Consumer Key/Secret are OK. Fix MPESA_PASSKEY: in developer.safaricom.co.ke open the same sandbox app you use for the key/secret → Lipa Na M-Pesa / M-Pesa Express test credentials → copy the Online Passkey for shortcode ' +
          (process.env.MPESA_SHORTCODE?.replace(/\s+/g, '').trim() || '174379') +
          ' exactly into backend/.env as MPESA_PASSKEY (no quotes unless the whole value is quoted). MPESA_SHORTCODE must match that same credential row. Restart the backend after saving.';
      }
      if (error.response.status >= 400 && error.response.status < 500) {
        httpStatus = error.response.status;
      }
      console.error('M-Pesa API Error Response:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      errorMessage = 'No response from M-Pesa. Please check your internet connection and try again.';
      console.error('No response from M-Pesa API');
    } else {
      errorMessage = error.message || 'Failed to initiate payment';
      console.error('Request setup error:', error.message);
    }
    res.status(httpStatus).json({
      message: errorMessage,
      details: errorDetails,
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
