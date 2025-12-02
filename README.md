# WekaCargo - Logistics Platform for Kenya

A full-stack logistics platform connecting truckers and customers for efficient cargo transportation services in Kenya.

## 🚀 Features

- **User Management**: Separate registration for customers and truckers
- **Truck Listings**: Truckers can list their vehicles with details
- **Booking System**: Customers can search and book available trucks
- **Real-time Tracking**: Track deliveries in real-time
- **Payment Integration**: M-Pesa payment integration for seamless transactions
- **Rating System**: Rate and review service quality
- **Admin Dashboard**: Manage users, bookings, and analytics

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v14 or higher) - [Download](https://nodejs.org/)
- **MongoDB** (local installation) or **MongoDB Atlas** account
- **npm** or **yarn** package manager
- **Git** (optional)

## 🛠️ Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd "wekacargo 2.0"
```

### 2. Install Backend Dependencies

```bash
cd backend
npm install
```

### 3. Install Frontend Dependencies

```bash
cd ../frontend
npm install
```

### 4. Environment Configuration

#### Backend Environment Variables

Create a `.env` file in the `backend` directory:

```env
# Server Configuration
PORT=5000

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/wekacargo

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000

# JWT Secret (use a strong secret in production)
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# M-Pesa Configuration (optional)
MPESA_CONSUMER_KEY=your-mpesa-consumer-key
MPESA_CONSUMER_SECRET=your-mpesa-consumer-secret
MPESA_SHORTCODE=your-mpesa-shortcode
MPESA_PASSKEY=your-mpesa-passkey

# Routing & distance calculation (no Google Maps required)
# OpenRouteService: Free tier available at https://openrouteservice.org/
OPENROUTESERVICE_API_KEY=your-openrouteservice-api-key

# OSRM Base URL (optional - defaults to public instance)
# OSRM_BASE_URL=https://router.project-osrm.org

# Environment
NODE_ENV=development
```

#### Frontend Environment Variables (Optional)

Create a `.env` file in the `frontend` directory if needed:

```env
# API URL (leave empty to use proxy)
REACT_APP_API_URL=

# Google Maps API Key
REACT_APP_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
```

### 5. Start MongoDB

**Local MongoDB:**
```bash
mongod
```

**Or use MongoDB Atlas:**
- Create a free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
- Create a cluster and get your connection string
- Update `MONGODB_URI` in `.env` with your Atlas connection string

## 🚀 Running the Application

### Option 1: Manual Start (Recommended for Development)

**Terminal 1 - Start Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Start Frontend:**
```bash
cd frontend
npm start
```

### Option 2: Using Startup Scripts

**Windows:**
- Double-click `start-dev.bat` or run in PowerShell:
  ```powershell
  .\start-dev.ps1
  ```

**Linux/Mac:**
```bash
chmod +x start-dev.sh
./start-dev.sh
```

### Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **Health Check**: http://localhost:5000/api/health

## 📁 Project Structure

```
wekacargo 2.0/
├── backend/                 # Express.js Backend
│   ├── models/             # MongoDB schemas (User, Truck, Booking, etc.)
│   ├── routes/             # API route handlers
│   │   ├── auth.js         # Authentication routes
│   │   ├── trucks.js       # Truck management routes
│   │   ├── bookings.js     # Booking routes
│   │   ├── payments.js     # Payment routes
│   │   ├── ratings.js      # Rating routes
│   │   ├── admin.js        # Admin routes
│   │   └── users.js        # User routes
│   ├── middleware/         # Custom middleware
│   │   └── auth.js         # JWT authentication middleware
│   ├── server.js           # Express server entry point
│   └── package.json        # Backend dependencies
│
├── frontend/               # React Frontend
│   ├── public/            # Static files
│   ├── src/
│   │   ├── components/    # Reusable React components
│   │   │   └── Header.tsx
│   │   ├── pages/         # Page components
│   │   │   ├── Homepage.tsx
│   │   │   ├── Login.tsx
│   │   │   ├── Register.tsx
│   │   │   ├── CustomerDashboard.tsx
│   │   │   ├── TruckerDashboard.tsx
│   │   │   ├── AdminDashboard.tsx
│   │   │   ├── BookingDetails.tsx
│   │   │   └── TrackingPage.tsx
│   │   ├── services/      # API service layer
│   │   │   └── api.ts     # Centralized API client
│   │   ├── store/         # Redux store
│   │   │   ├── index.ts
│   │   │   └── authSlice.ts
│   │   ├── App.tsx        # Main App component
│   │   └── index.tsx      # Entry point
│   └── package.json       # Frontend dependencies
│
├── README.md              # This file
├── QUICK_START.md         # Quick start guide
├── CONNECTION_GUIDE.md    # Frontend-Backend connection guide
└── start-dev.*            # Startup scripts
```

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Trucks
- `GET /api/trucks` - Get all trucks (with filters)
- `GET /api/trucks/:id` - Get truck by ID
- `POST /api/trucks` - Create truck (trucker only)
- `PUT /api/trucks/:id` - Update truck (trucker only)
- `DELETE /api/trucks/:id` - Delete truck (trucker only)

### Bookings
- `GET /api/bookings/my-bookings` - Get user's bookings
- `GET /api/bookings/:id` - Get booking by ID
- `POST /api/bookings` - Create booking
- `PUT /api/bookings/:id` - Update booking status

### Payments
- `POST /api/payments/initiate` - Initiate M-Pesa payment
- `POST /api/payments/release/:id` - Release payment

### Ratings
- `GET /api/ratings/user/:userId` - Get user ratings
- `POST /api/ratings` - Submit rating

### Admin
- `GET /api/admin/users` - Get all users (admin only)
- `PUT /api/admin/users/:id` - Update user (admin only)
- `GET /api/admin/analytics` - Get analytics (admin only)

## 👥 User Roles

### Customer
- Search and browse available trucks
- Book trucks for cargo transportation
- Track deliveries in real-time
- Make payments via M-Pesa
- Rate and review truckers

### Trucker
- Register trucks with details
- Manage truck availability
- Accept/reject booking requests
- Update booking status (confirmed, in-transit, completed)
- View earnings and ratings

### Admin
- Manage all users
- View platform analytics
- Monitor bookings and payments
- Suspend/activate user accounts

## 🔒 Security Features

- JWT-based authentication
- Password hashing with bcrypt
- CORS protection
- Rate limiting on API endpoints
- Input validation and sanitization
- Protected routes (authentication required)

## 🧪 Testing

### Backend
```bash
cd backend
npm test
```

### Frontend
```bash
cd frontend
npm test
```

## 🐛 Troubleshooting

### Common Issues

**Backend won't start:**
- ✅ Check MongoDB is running
- ✅ Verify `MONGODB_URI` in `.env`
- ✅ Check port 5000 isn't in use
- ✅ Ensure all dependencies are installed

**Frontend won't load:**
- ✅ Verify backend is running on port 5000
- ✅ Check browser console for errors
- ✅ Clear browser cache and localStorage
- ✅ Ensure all dependencies are installed

**CORS errors:**
- ✅ Backend has CORS enabled for `http://localhost:3000`
- ✅ Check proxy setting in `frontend/package.json`
- ✅ Ensure backend is running

**MongoDB connection errors:**
- ✅ Verify MongoDB is running (local) or connection string is correct (Atlas)
- ✅ Check network access for Atlas
- ✅ Verify credentials in `.env`

**Authentication issues:**
- ✅ Check `JWT_SECRET` is set in backend `.env`
- ✅ Verify token is stored in localStorage
- ✅ Check browser console for errors

## 📝 Development Scripts

### Backend
```bash
cd backend
npm start          # Start server
npm run dev        # Start with nodemon (auto-reload)
```

### Frontend
```bash
cd frontend
npm start          # Start dev server
npm run build      # Build for production
npm test           # Run tests
```

## 🚢 Production Deployment

### Backend
1. Set `NODE_ENV=production` in `.env`
2. Use a strong `JWT_SECRET`
3. Configure production MongoDB URI
4. Set proper CORS origins
5. Deploy to Heroku, AWS, or your preferred hosting

### Frontend
1. Build the app: `npm run build`
2. Set `REACT_APP_API_URL` to your production backend URL
3. Deploy the `build` folder to Vercel, Netlify, or your preferred hosting

## 📚 Documentation

- [Quick Start Guide](./QUICK_START.md) - Get started in 5 minutes
- [Connection Guide](./CONNECTION_GUIDE.md) - Frontend-Backend integration details
- [Backend Setup](./backend/BACKEND_SETUP_COMPLETE.md) - Backend documentation
- [Frontend Setup](./frontend/FRONTEND_SETUP.md) - Frontend documentation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License.

## 👨‍💻 Author

WekaCargo Development Team

## 🙏 Acknowledgments

- React Community
- Express.js
- MongoDB
- Bootstrap
- React Bootstrap
- React Router
- Redux Toolkit

---

**Made with ❤️ for Kenya's logistics industry**

#   w e k a c a r g o  
 