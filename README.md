# Meeting Management System

A comprehensive, full-stack enterprise meeting management solution. This application streamlines the entire lifecycle of corporate and academic meetings—from scheduling, sending invitations, and tracking RSVPs, to drafting Minutes of Meetings (MoMs), generating professional PDF/Excel reports, and managing post-meeting Action Items.

## Features

- **Dashboard & Oversight:** Role-based access control (SuperAdmin, Admin, User). Dedicated dashboard tabs for Organized, Invited, and Public meetings.
- **Advanced Scheduling:** Support for Offline, Online, and Hybrid meetings. Automated physical venue conflict detection.
- **Participant Workflows:** RSVPs (Accept/Decline). Integrated Nominee (Substitute) request and approval system.
- **MoM Generation:** Real-time collaborative meeting notes, drag-and-drop agenda structuring, and attendance tracking.
- **Action Item Tracking:** Assign tasks with deadlines. Track task completion statuses independently from meetings.
- **Professional Exports:** Generate branded, highly-structured PDF and Excel exports for agendas and MoMs.
- **Real-Time Updates:** WebSockets power instant in-app notifications and real-time collaboration.
- **Automated Emails:** Automated Gmail-integrated notifications for meeting invites, cancellations, and nominee approvals.

## Tech Stack

**Frontend**
- **Framework:** [Next.js (v16)](https://nextjs.org/) & React (v19)
- **Styling:** [Tailwind CSS (v4)](https://tailwindcss.com/)
- **Language:** TypeScript
- **Icons:** [Lucide React](https://lucide.dev/)
- **PDF/Excel Generation:** jsPDF, jspdf-autotable, xlsx
- **Drag & Drop:** @dnd-kit
- **Rich Text Editing:** React Quill
- **Real-time:** Socket.IO Client

**Backend**
- **Framework:** Node.js with [Express (v5)](https://expressjs.com/)
- **Database:** MongoDB via [Mongoose](https://mongoosejs.com/)
- **Language:** TypeScript
- **Authentication:** JSON Web Tokens (JWT) & Passport
- **Real-time:** Socket.IO Server
- **File Uploads:** Multer
- **Email Delivery:** Nodemailer
- **Task Scheduling:** Node-cron

---

## Step-by-Step Setup Guide

Follow these instructions to run the project locally on your machine.

### Prerequisites
1. **Node.js**: Ensure you have Node.js (v18 or higher recommended) installed.
2. **MongoDB**: You need a running MongoDB database (either a local instance or a cloud MongoDB Atlas URI).
3. **Git**: To clone the repository.

### 1. Clone the Repository
Clone the project to your local machine and navigate into the directory:
```bash
git clone https://github.com/absharabi/meeting-management-system.git
cd meeting-management-system
```

### 2. Backend Setup
Navigate to the `server` directory, install dependencies, and configure your environment:
```bash
cd server
npm install
```

**Configure Backend Environment Variables:**
Create a `.env` file in the `server` directory and configure the following variables:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/meeting-system
JWT_SECRET=your_super_secret_jwt_key
FRONTEND_URL=http://localhost:3000

# Email Configuration (For Sending Invites/Notifications)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_gmail_app_password
```

**Run the Backend Server:**
```bash
npm run dev
```
*The server will start on `http://localhost:5000`.*

### 3. Frontend Setup
Open a new terminal window, navigate to the `client` directory, install dependencies, and configure your environment:
```bash
cd client
npm install
```

**Configure Frontend Environment Variables:**
Create a `.env.local` file in the `client` directory:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

**Run the Frontend Development Server:**
```bash
npm run dev
```
*The application will be accessible at `http://localhost:3000`.*

### 4. Optional: Database Seeding
If you want to pre-populate your database with dummy users and test data, you can run the seed script from the server directory:
```bash
cd server
npm run seed
```

## Contributing
Please ensure you are pushing your code to the designated branches (e.g., `frontend-setup1`). Before committing, run your TypeScript compiler checks (`npm run build`) to ensure type safety is maintained.
