import express from 'express'
import 'dotenv/config'
import { MongoClient } from 'mongodb';
import cors from 'cors'

const PORT = 5000;

const app = express();
app.use(express.json());
app.use(cors());


const client = new MongoClient(process.env.MONGODB_URI);
export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}

connectToMongoDB()



app.get("/",(req,res)=>{
    res.send('Hello Najmul!')
})

app.listen(PORT ,()=>{
    console.log(`Server is running on port ${PORT}`);
})