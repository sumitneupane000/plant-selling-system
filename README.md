# 🌱 Plant Selling System

A full-stack **multi-vendor e-commerce platform for buying and selling plants online**. The system provides separate functionalities for customers, vendors, and administrators, allowing users to browse plants, manage products, place orders, and manage the overall marketplace.

## 📌 Project Overview

The **Plant Selling System** is designed to provide a convenient online marketplace where customers can discover and purchase plants from different vendors.

Vendors can manage their plant products and orders, while administrators can manage users, products, vendors, and other activities of the platform.

The system aims to make plant shopping easier by providing a centralized, user-friendly, and responsive e-commerce platform.

## ✨ Features

### 👤 Customer

* User registration and login
* Secure authentication
* Browse available plants
* View plant/product details
* Add products to cart
* Update cart quantities
* Remove products from cart
* Place orders
* View order information
* Manage personal profile
* Online payment integration support
* Responsive user interface

### 🌿 Vendor

* Vendor registration and authentication
* Vendor dashboard
* Add new plant products
* Edit product information
* Delete products
* Manage product images
* View customer orders
* Manage vendor products

### 🛠️ Administrator

* Admin authentication
* Admin dashboard
* Manage users
* Manage vendors
* Manage products
* Manage orders
* Monitor marketplace activities
* Administrative control over the platform

## 🏗️ System Architecture

The project follows a client-server architecture:

```text
┌───────────────────────┐
│     React Frontend    │
│       Vite + CSS      │
└───────────┬───────────┘
            │
            │ REST API
            ▼
┌───────────────────────┐
│   Node.js + Express   │
│       Backend API     │
└───────────┬───────────┘
            │
            │ Prisma ORM
            ▼
┌───────────────────────┐
│      PostgreSQL       │
│       Database        │
└───────────────────────┘

External Services:
- Cloudinary → Product image storage
- Nodemailer → Email services
- eSewa → Payment integration
```

## 🧰 Technologies Used

### Frontend

* React.js
* Vite
* HTML5
* CSS3
* JavaScript
* Axios

### Backend

* Node.js
* Express.js
* REST API
* JavaScript

### Database

* PostgreSQL
* Prisma ORM

### Authentication & Security

* JWT
* Password hashing
* Protected routes
* Role-based access control

### External Services

* Cloudinary
* Nodemailer
* eSewa Sandbox

### Development Tools

* Visual Studio Code
* Git
* GitHub
* Postman
* npm

## 📂 Project Structure

```text
Plant-Market/
│
├── backend/
│   ├── prisma/
│   │   ├── migrations/
│   │   ├── schema.prisma
│   │   └── seed.js
│   │
│   ├── public/
│   │   └── uploads/
│   │
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── utils/
│   │   ├── validators/
│   │   └── app.js
│   │
│   ├── .env.example
│   ├── package.json
│   └── package-lock.json
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── api/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── context/
│   │   ├── pages/
│   │   ├── styles/
│   │   └── App.jsx
│   │
│   ├── package.json
│   ├── package-lock.json
│   └── vite.config.js
│
└── .gitignore
```

## ⚙️ Installation and Setup

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR-USERNAME/plant-selling-system.git
```

Move into the project directory:

```bash
cd plant-selling-system
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file based on `.env.example`.

Example:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/plant_selling_db"

PORT=5000

JWT_SECRET=your_jwt_secret

CLIENT_URL=http://localhost:5173
```

Add your required Cloudinary, email, and payment configuration to the `.env` file.

### 3. Database Setup

Make sure PostgreSQL is installed and running.

Then run:

```bash
npx prisma migrate dev
```

Generate the Prisma client:

```bash
npx prisma generate
```

If the project contains seed data:

```bash
node prisma/seed.js
```

### 4. Start the Backend

From the `backend` folder:

```bash
npm run dev
```

The backend will normally run on:

```text
http://localhost:5000
```

### 5. Frontend Setup

Open another terminal:

```bash
cd frontend
npm install
```

Start the frontend:

```bash
npm run dev
```

The frontend will normally be available at:

```text
http://localhost:5173
```

## 🔐 Environment Variables

For security reasons, sensitive environment variables should **not** be committed to GitHub.

Use:

```text
.env.example
```

as a template and create your own:

```text
.env
```

Never upload:

```text
.env
```

to GitHub.

## 🗄️ Database

The system uses **PostgreSQL** as the relational database and **Prisma ORM** for database interaction.

The database manages information such as:

* Users
* Vendors
* Products
* Categories
* Cart items
* Orders
* Payments
* Other application data

## 💳 Payment

The project includes support for payment processing and can be configured with **eSewa Sandbox** for development and testing.

Cash on Delivery can also be supported as an order payment method.

## ☁️ Image Management

Product images can be managed using **Cloudinary**, providing cloud-based image storage and delivery.

## 📧 Email Service

**Nodemailer** is used to support email-related functionality such as sending application emails and notifications.

## 🔒 Security

The application implements several security mechanisms, including:

* JWT-based authentication
* Password hashing
* Protected API routes
* Role-based authorization
* Environment variables for sensitive configuration
* Input validation
* Authentication middleware

## 🎯 Project Objectives

* Develop a complete plant-selling e-commerce platform.
* Provide separate interfaces for customers, vendors, and administrators.
* Make plant shopping convenient and accessible online.
* Allow vendors to manage their products and orders.
* Provide secure authentication and authorization.
* Implement an organized database using PostgreSQL.
* Provide a responsive and user-friendly interface.
* Integrate online payment and external services.

## 🚀 Future Enhancements

Possible future improvements include:

* Product reviews and ratings
* Wishlist functionality
* Advanced product search and filtering
* Delivery tracking
* Discount and coupon management
* Real-time order notifications
* Advanced sales analytics
* Mobile application
* Improved recommendation system
* Multiple payment gateway support

## 👨‍💻 Development Team

**Plant Selling System**

Developed as an academic e-commerce project using modern web technologies.

## 📄 License

This project is developed for **educational and academic purposes**.

---

⭐ If you find this project useful, consider giving the repository a star.
