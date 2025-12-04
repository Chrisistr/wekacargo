const originalEmitWarning = process.emitWarning;
process.emitWarning = function(warning, ...args) {
  if (typeof warning === 'string' && warning.includes('util._extend')) {
    return; 
  }
  if (typeof warning === 'object' && warning.name === 'DeprecationWarning' && warning.code === 'DEP0060') {
    return; 
  }
  return originalEmitWarning.apply(process, [warning, ...args]);
};
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');
dotenv.config({ path: require('path').join(__dirname, '.env') });
if (!process.env.JWT_SECRET) {
  console.error('ERROR: JWT_SECRET is not set in .env file. Please configure it before starting the server.');
  process.exit(1);
}
const app = express();
app.set('trust proxy', 1);
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://wekacargo.netlify.app',
  'http://localhost:3000'
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all origins in development
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100 
});
app.use('/api/', limiter);
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/wekacargo';
console.log('Attempting to connect to MongoDB...');
console.log(`Connection string: ${MONGODB_URI.replace(/\/\/.*@/, '//***@')}`);
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000, 
  socketTimeoutMS: 45000, 
})
.then(async () => {
  console.log('✓ MongoDB connected successfully');
  console.log(`  Database: ${mongoose.connection.name}`);
  console.log(`  Host: ${mongoose.connection.host}:${mongoose.connection.port}`);
  try {
    const User = require('./models/User');
    const adminExists = await User.findOne({ email: 'admin@admin.com' });
    if (!adminExists) {
      const adminUser = new User({
        name: 'Admin',
        email: 'admin@admin.com',
        phone: '+254700000000',
        password: 'Admin',
        role: 'admin',
        status: 'active',
        verification: {
          emailVerified: true,
          phoneVerified: true,
          identityVerified: true
        }
      });
      await adminUser.save();
      console.log('✓ Admin user created: email=admin@admin.com, password=Admin');
    } else {
      console.log('✓ Admin user already exists');
    }
  } catch (error) {
    console.error('Error setting up admin user:', error.message);
  }
})
.catch(err => {
  console.error('✗ MongoDB connection error:');
  console.error(`  Error: ${err.message}`);
  if (err.name === 'MongoServerSelectionError') {
    console.error('\n  Possible causes:');
    console.error('  1. MongoDB is not running');
    console.error('  2. Incorrect connection string in .env file');
    console.error('  3. Network connectivity issues');
    console.error('\n  Solutions:');
    console.error('  - Start MongoDB: mongod (for local)');
    console.error('  - Check MONGODB_URI in backend/.env');
    console.error('  - Verify MongoDB Atlas connection string (if using cloud)');
  }
  process.exit(1);
});
mongoose.connection.on('disconnected', () => {
  console.warn('⚠ MongoDB disconnected. Attempting to reconnect...');
});
mongoose.connection.on('reconnected', () => {
  console.log('✓ MongoDB reconnected successfully');
});
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});
app.use('/api/auth', require('./routes/auth'));
app.use('/api/trucks', require('./routes/trucks'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/ratings', require('./routes/ratings'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/users', require('./routes/users'));
app.use('/api/alerts', require('./routes/alerts'));
app.use('/api/notifications', require('./routes/notifications'));
app.get('/api/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  const dbStates = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  res.json({ 
    status: dbStatus === 1 ? 'OK' : 'WARNING',
    message: 'WekaCargo API is running',
    database: {
      status: dbStates[dbStatus] || 'unknown',
      connected: dbStatus === 1,
      name: mongoose.connection.name,
      host: mongoose.connection.host
    }
  });
});
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!', error: err.message });
});
const PORT = process.env.PORT || 5000;
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!', error: err.message });
});
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
