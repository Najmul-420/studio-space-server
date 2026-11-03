#StudioSpace Backend Server 

🎬🎧StudioSpace Server is the RESTful API backend for the StudioSpace platform. It handles user authentication, studio listing management (CRUD operations), and booking workflows with double-booking prevention logic. Built with Node.js, Express.js, MongoDB, and JWT (via HttpOnly cookies).

Key FeaturesJWT Authentication & Security: Secure cookie-based HTTP-Only JWT authentication mechanism for user logins and protected routes.Google & Local Auth Integration: Endpoint routes for traditional email/password and Google sign-in methods.Studio Listings (CRUD):Public access to fetch featured studios or filter listings by category.Single studio details retrieval.Protected routes to create, update, and delete host listings.Booking System with Overlap Prevention:Double-booking check logic before confirming a slot (Confirmed or Pending).Cancel existing bookings.Retrieve bookings specific to authenticated users.


🛠️ Tech Stack & DependenciesRuntime: Node.jsFramework: Express.jsDatabase: MongoDB (Official Native Driver)Authentication: JSON Web Token (jsonwebtoken) & cookie-parserCross-Origin Resource Sharing: corsEnvironment Variables: dotenv📁 Project Structurestudio-space-server/


├── index.js             # Main server entry file & API endpoints
├── package.json         # Dependencies & scripts
├── .env                 # Environment variables configuration (ignored by git)
└── .gitignore           # Git ignore settings



⚙️ Environment Variables SetupCreate a .env file in the root directory of the project and add the following variables:PORT=5000
MONGODB_URI=mongodb+sandbox_connection_string
JWT_SECRET=your_jwt_secret_key_here
NODE_ENV=development


📦 Getting Started1. PrerequisitesEnsure you have the following installed on your local machine:Node.js (v16.x or higher)npm2. InstallationClone the repository and install dependencies:git clone <your-repository-url>
cd studio-space-server
npm install

3. Running the ServerDevelopment mode (using Nodemon):npm run dev


# or
nodemon index.js
Production mode:npm start

# or

node index.js
The server should start running at http://localhost:5000.

📡 API Endpoints Summary🔑 Authentication & UsersMethodEndpointAccessDescriptionPOST/jwtPublicIssue JWT token saved into HttpOnly cookiePOST/logoutPublicClear JWT token cookiePOST/usersPublicRegister a new userPOST/auth/googlePublicAuthenticate via Google OAuth & issue tokenPOST/auth/loginPublicAuthenticate user via email/password🎙️ Studio Listings (CRUD)MethodEndpointAccessDescriptionGET/studiosPublicGet all studios (supports category query & limit)GET/studios/:idPublicGet specific studio details by IDPOST/studiosPrivateCreate a new studio listingGET/my-listingsPrivateFetch listings created by the logged-in hostPUT/studios/:idPrivateUpdate studio details by IDDELETE/studios/:idPrivateDelete studio listing by ID📅 

BookingsMethodEndpointAccessDescriptionPOST/bookingsPrivateCreate booking with collision checkingGET/my-bookingsPrivateFetch bookings of the logged-in userPATCH/bookings/cancel/:idPrivateCancel a booking by ID🔒 


Security PracticesHttpOnly Cookies: JWT is passed using httpOnly: true cookies to prevent XSS attacks.CORS Configuration: Strictly limited to defined frontend origins (localhost:3000 & localhost:5173).Double-Booking Validation: Prevents multi-booking conflicts for overlapping time slots on identical dates.

📄 LicenseThis project is licensed under the ISC License.