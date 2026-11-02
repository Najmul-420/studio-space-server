
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

// 3. MongoDB Connection & Collections Setup
const client = new MongoClient(process.env.MONGODB_URI);

let studioCollection;
let bookingCollection;
let userCollection; // নতুন: ইউজার কালেকশন ভ্যারিয়েবল

async function run() {
    try {
        await client.connect();
        const db = client.db("studioSpaceDB");
        studioCollection = db.collection("studios");
        bookingCollection = db.collection("bookings");
        userCollection = db.collection("users"); // নতুন: ইউজার কালেকশন ইনিশিয়ালাইজেশন
        
        console.log("You successfully connected to MongoDB!");
    } catch (error) {
        console.error("MongoDB Connection Failed:", error);
    }
}
run();

// ================= AUTHENTICATION & USER APIs =================
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

// নতুন: রেজিস্টার করা ইউজারদের ডাটা MongoDB তে সেভ করার API
app.post('/users', async (req, res) => {
    try {
        const newUser = req.body;
        
        // চেক করা ইউজার ইতিমধ্যে ডাটাবেজে আছে কি না
        const existingUser = await userCollection.findOne({ email: newUser.email });
        if (existingUser) {
            return res.status(400).send({ message: 'User already exists!' });
        }

        const result = await userCollection.insertOne(newUser);
        res.send(result);
    } catch (error) {
        res.status(500).send({ message: "Failed to register user" });
    }
});


// Login Route: Authenticate user and send token cookie
app.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // ১. ডাটাবেজ থেকে ইউজার খুঁজে দেখা
        const user = await userCollection.findOne({ email });
        if (!user) {
            return res.status(401).send({ message: 'Invalid email or password.' });
        }

        // ২. পাসওয়ার্ড চেক (যদি পাসওয়ার্ড ডাটাবেজে স্টোর করা থাকে)
        if (user.password && user.password !== password) {
            return res.status(401).send({ message: 'Invalid email or password.' });
        }

        // ৩. JWT টোকেন তৈরি করা
        const token = jwt.sign(
            { email: user.email }, 
            process.env.JWT_SECRET || 'secretkey', 
            { expiresIn: '7d' }
        );
        
        // ৪. কুকিতে টোকেন সেট করে ইউজার ডাটা পাঠানো
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        }).send({ 
            success: true, 
            user: { name: user.name, email: user.email, photoUrl: user.photoUrl } 
        });
    } catch (error) {
        res.status(500).send({ message: "Failed to sign in" });
    }
});

// ================= STUDIOS APIs (CRUD) =================

// Public Route: Get Featured Studios or All Studios with optional Category Filter
app.get('/studios', async (req, res) => {
    try {
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
    } catch (error) {
        res.status(500).send({ message: "Failed to fetch studios" });
    }
});

// Public Route: Get Single Studio Details
app.get('/studios/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await studioCollection.findOne(query);
        res.send(result);
    } catch (error) {
        res.status(500).send({ message: "Failed to fetch studio details" });
    }
});

// Protected Route: Add New Studio
app.post('/studios', verifyToken, async (req, res) => {
    try {
        const newStudio = req.body;
        const result = await studioCollection.insertOne(newStudio);
        res.send(result);
    } catch (error) {
        res.status(500).send({ message: "Failed to add studio" });
    }
});

// Protected Route: Get My Studio Listings
app.get('/my-listings', verifyToken, async (req, res) => {
    try {
        const email = req.query.email;
        if (req.user.email !== email) {
            return res.status(403).send({ message: 'Forbidden access' });
        }
        const query = { hostEmail: email };
        const result = await studioCollection.find(query).toArray();
        res.send(result);
    } catch (error) {
        res.status(500).send({ message: "Failed to fetch user listings" });
    }
});

// Protected Route: Update Studio

// Protected Route: Update Studio
app.put('/studios/:id', verifyToken, async (req, res) => {
    try {
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
                thumbnail: updatedStudio.thumbnail, // imageUrl এর পরিবর্তে thumbnail দেওয়া হলো
                images: updatedStudio.images,       // গ্যালারি ছবিগুলোর জন্য এটিও যোগ করে দিতে পারো
                overview: updatedStudio.overview,
                amenities: updatedStudio.amenities
            },
        };
        const result = await studioCollection.updateOne(filter, updateDoc);
        res.send(result);
    } catch (error) {
        res.status(500).send({ message: "Failed to update studio" });
    }
});


// app.put('/studios/:id', verifyToken, async (req, res) => {
//     try {
//         const id = req.params.id;
//         const filter = { _id: new ObjectId(id) };
//         const updatedStudio = req.body;
//         const updateDoc = {
//             $set: {
//                 title: updatedStudio.title,
//                 category: updatedStudio.category,
//                 hourlyRate: updatedStudio.hourlyRate,
//                 securityDeposit: updatedStudio.securityDeposit,
//                 maxCapacity: updatedStudio.maxCapacity,
//                 location: updatedStudio.location,
//                 imageUrl: updatedStudio.imageUrl,
//                 overview: updatedStudio.overview,
//                 amenities: updatedStudio.amenities
//             },
//         };
//         const result = await studioCollection.updateOne(filter, updateDoc);
//         res.send(result);
//     } catch (error) {
//         res.status(500).send({ message: "Failed to update studio" });
//     }
// });

// Protected Route: Delete Studio
app.delete('/studios/:id', verifyToken, async (req, res) => {
    try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await studioCollection.deleteOne(query);
        res.send(result);
    } catch (error) {
        res.status(500).send({ message: "Failed to delete studio" });
    }
});

// ================= BOOKING APIs =================

// Protected Route: Create Booking (Double-Booking Prevention)
app.post('/bookings', verifyToken, async (req, res) => {
    try {
        const booking = req.body; 

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
    } catch (error) {
        res.status(500).send({ message: "Failed to create booking" });
    }
});

// Protected Route: Get My Bookings
app.get('/my-bookings', verifyToken, async (req, res) => {
    try {
        const email = req.query.email;
        if (req.user.email !== email) {
            return res.status(403).send({ message: 'Forbidden access' });
        }
        const query = { userEmail: email };
        const result = await bookingCollection.find(query).toArray();
        res.send(result);
    } catch (error) {
        res.status(500).send({ message: "Failed to fetch bookings" });
    }
});

// Protected Route: Cancel Booking
app.patch('/bookings/cancel/:id', verifyToken, async (req, res) => {
    try {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
            $set: { status: 'Cancelled' }
        };
        const result = await bookingCollection.updateOne(filter, updateDoc);
        res.send(result);
    } catch (error) {
        res.status(500).send({ message: "Failed to cancel booking" });
    }
});

// Root Endpoint
app.get("/", (req, res) => {
    res.send('StudioSpace Backend Server is Running...');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});







