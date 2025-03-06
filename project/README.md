# Emergency Response Network (ERN)

A comprehensive emergency response management system that connects civilians, responders, and administrators to streamline emergency response operations.

## Features

- **Real-time Emergency Reporting**: Civilians can report emergencies with location tracking
- **Responder Management**: Assign and track emergency responders
- **Live Updates**: Real-time status updates and communication
- **Admin Dashboard**: Comprehensive overview of all emergencies and responders
- **Location Tracking**: Map-based visualization of emergencies and responders

## Tech Stack

### Frontend
- React with TypeScript
- React Router for navigation
- Tailwind CSS for styling
- Socket.io for real-time updates
- Leaflet for maps and location tracking

### Backend
- Node.js with Express
- MongoDB with Mongoose ODM
- JWT for authentication
- Socket.io for real-time communication

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- MongoDB connection

### Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm run install:all
   ```

3. Set up environment variables:
   - Create a `.env` file in the backend directory with the following variables:
     ```
     PORT=5000
     MONGODB_URI=your_mongodb_connection_string
     JWT_SECRET=your_jwt_secret
     JWT_EXPIRE=30d
     ```

4. Start the development server:
   ```
   npm run dev
   ```

## Project Structure

```
emergency-response-network/
├── frontend/             # React frontend
│   ├── public/           # Static files
│   └── src/              # Source files
│       ├── components/   # Reusable components
│       ├── context/      # Context providers
│       ├── pages/        # Page components
│       └── layouts/      # Layout components
└── backend/              # Node.js backend
    ├── config/           # Configuration files
    ├── controllers/      # Request handlers
    ├── middleware/       # Express middleware
    ├── models/           # Mongoose models
    └── routes/           # API routes
```

## User Roles

1. **Civilian (User)**
   - Report emergencies
   - Track status of reported emergencies
   - Receive updates

2. **Responder**
   - Receive emergency assignments
   - Update emergency status
   - Provide real-time updates

3. **Administrator**
   - Manage all emergencies
   - Assign responders
   - View analytics and reports

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login a user
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/updateprofile` - Update user profile

### Emergencies
- `GET /api/emergencies` - Get all emergencies
- `POST /api/emergencies` - Create a new emergency
- `GET /api/emergencies/:id` - Get a specific emergency
- `PUT /api/emergencies/:id` - Update an emergency
- `POST /api/emergencies/:id/updates` - Add an update to an emergency
- `PUT /api/emergencies/:id/assign` - Assign responders to an emergency
- `PUT /api/emergencies/:id/status` - Update emergency status

### Responders
- `GET /api/responders` - Get all responders
- `GET /api/responders/available` - Get available responders
- `GET /api/responders/specialization/:type` - Get responders by specialization
- `GET /api/responders/nearby` - Get nearby responders
- `PUT /api/responders/availability` - Update responder availability
- `GET /api/responders/emergencies` - Get responder's assigned emergencies
- `PUT /api/responders/location` - Update responder location

## License

This project is licensed under the MIT License.