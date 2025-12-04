const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
dotenv.config();
const createAdminUser = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wekacargo', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');
    const existingAdmin = await User.findOne({ email: 'admin@admin.com' });
    if (existingAdmin) {
      console.log('Admin user already exists');
      await mongoose.connection.close();
      return;
    }
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
    console.log('Admin user created successfully!');
    console.log('Username: Admin (or admin@admin.com)');
    console.log('Password: Admin');
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error creating admin user:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};
createAdminUser();
