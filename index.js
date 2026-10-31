

import express from 'express';
import 'dotenv/config';
import { MongoClient, ObjectId } from 'mongodb';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';

const PORT = process.env.PORT || 5000;
const app = express();

// 1. Middlewares Setup (CORS for cookies support)
app.use(express.json());
app.use(cookieParser());
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:5173'], // Frontend URLs
    credentials: true
}));

// 2. JWT Verification Middleware (Challenge 1)
const verifyToken = (req, res, next) => {
    const token = req.cookies?.token;
    if (!token) {
        return res.status(401).send({ message: 'Unauthorized access: No token provided' });
    }
    jwt.verify(token, process.env.JWT_SECRET || 'secretkey', (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: 'Unauthorized access: Invalid token' });
        }
        req.user = decoded;
        next();
    });
};

// 3. MongoDB Connection Setup
const client = new MongoClient(process.env.MONGODB_URI);

async function run() {
    try {
        await client.connect();
        console.log("You successfully connected to MongoDB!");

        const db = client.db("studioSpaceDB");
        const studioCollection = db.collection("studios");
        const bookingCollection = db.collection("bookings");

        // ================= AUTHENTICATION APIs (JWT & Cookies) =================
        app.post('/jwt', async (req, res) => {
            const user = req.body; // { email: 'user@gmail.com' }
            const token = jwt.sign(user, process.env.JWT_SECRET || 'secretkey', { expiresIn: '7d' });
            
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            }).send({ success: true });
        });

        app.post('/logout', async (req, res) => {
            res.clearCookie('token', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            }).send({ success: true });
        });

        // ================= STUDIOS APIs (CRUD) =================
        // Get Featured Studios (Limit 6) or All Studios with optional Category Filter
        app.get('/studios', async (req, res) => {
            const category = req.query.category;
            const limit = parseInt(req.query.limit);
            let query = {};
            
            if (category && category !== 'All') {
                query = { category: category };
            }

            let cursor = studioCollection.find(query);
            if (limit) {
                cursor = cursor.limit(limit);
            }
            const result = await cursor.toArray();
            res.send(result);
        });

        // Get Single Studio Details
        app.get('/studios/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await studioCollection.findOne(query);
            res.send(result);
        });

        // Add New Studio (Protected Route)
        app.post('/studios', verifyToken, async (req, res) => {
            const newStudio = req.body;
            const result = await studioCollection.insertOne(newStudio);
            res.send(result);
        });

        // Get My Studio Listings (Protected Route)
        app.get('/my-listings', verifyToken, async (req, res) => {
            const email = req.query.email;
            if (req.user.email !== email) {
                return res.status(403).send({ message: 'Forbidden access' });
            }
            const query = { hostEmail: email };
            const result = await studioCollection.find(query).toArray();
            res.send(result);
        });

        // Update Studio (Protected Route)
        app.put('/studios/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedStudio = req.body;
            const updateDoc = {
                $set: {
                    title: updatedStudio.title,
                    category: updatedStudio.category,
                    hourlyRate: updatedStudio.hourlyRate,
                    securityDeposit: updatedStudio.securityDeposit,
                    maxCapacity: updatedStudio.maxCapacity,
                    location: updatedStudio.location,
                    imageUrl: updatedStudio.imageUrl,
                    overview: updatedStudio.overview,
                    amenities: updatedStudio.amenities
                },
            };
            const result = await studioCollection.updateOne(filter, updateDoc);
            res.send(result);
        });

        // Delete Studio (Protected Route)
        app.delete('/studios/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await studioCollection.deleteOne(query);
            res.send(result);
        });

        // ================= BOOKING APIs =================
        // Create Booking (Challenge 2: Double-Booking Prevention)
        app.post('/bookings', verifyToken, async (req, res) => {
            const booking = req.body; 
            // booking Structure: { studioId, userEmail, bookingDate, startTime, endTime, totalPrice, status: 'Pending' }

            // Check overlap for existing Confirmed/Pending bookings for the same studio on the same date
            const existingBooking = await bookingCollection.findOne({
                studioId: booking.studioId,
                bookingDate: booking.bookingDate,
                status: { $in: ['Confirmed', 'Pending'] },
                $or: [
                    { startTime: { $lt: booking.endTime, $gte: booking.startTime } },
                    { endTime: { $gt: booking.startTime, $lte: booking.endTime } }
                ]
            });

            if (existingBooking) {
                return res.status(400).send({ 
                    message: 'Time slot collision! This studio is already booked for the selected time.' 
                });
            }

            const result = await bookingCollection.insertOne(booking);
            res.send(result);
        });

        // Get My Bookings (Protected Route)
        app.get('/my-bookings', verifyToken, async (req, res) => {
            const email = req.query.email;
            if (req.user.email !== email) {
                return res.status(403).send({ message: 'Forbidden access' });
            }
            const query = { userEmail: email };
            const result = await bookingCollection.find(query).toArray();
            res.send(result);
        });

        // Cancel Booking (Protected Route)
        app.patch('/bookings/cancel/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: { status: 'Cancelled' }
            };
            const result = await bookingCollection.updateOne(filter, updateDoc);
            res.send(result);
        });

    } finally {
        // Keeps connection alive for express API calls
    }
}
run().catch(console.dir);

// Root Endpoint
app.get("/", (req, res) => {
    res.send('StudioSpace Backend Server is Running...');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
















// import express from 'express'
// import 'dotenv/config'
// import { MongoClient } from 'mongodb';
// import cors from 'cors'

// const PORT = 5000;

// const app = express();
// app.use(express.json());
// app.use(cors());


// const client = new MongoClient(process.env.MONGODB_URI);
// export async function connectToMongoDB() {
//   try {
//     await client.connect();
//     console.log("You successfully connected to MongoDB!");
//     return client;
//   } catch (err) {
//     console.dir(err);
//   }
// }

// connectToMongoDB()



// app.get("/",(req,res)=>{
//     res.send('Hello Najmul!')
// })

// app.listen(PORT ,()=>{
//     console.log(`Server is running on port ${PORT}`);
// })