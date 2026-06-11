# Steakz Backend API

Restaurant management backend API built with Express, TypeScript, Prisma, and Socket.IO.

## Features

- 🔐 JWT Authentication & Authorization
- 🎭 Role-based access control (Admin, HQ Manager, Branch Manager, Chef, Cashier, Customer)
- 📡 Real-time updates via Socket.IO
- 📁 File upload support
- 🗄️ PostgreSQL database with Prisma ORM
- 🐳 Docker-ready for production deployment

## Tech Stack

- **Runtime:** Node.js 18+
- **Language:** TypeScript
- **Framework:** Express.js
- **Database ORM:** Prisma
- **Real-time:** Socket.IO
- **Authentication:** JWT (jsonwebtoken)

## Getting Started

### Prerequisites

- Node.js 18 or higher
- PostgreSQL database (or SQLite for development)
- npm or yarn

### Installation

1. Clone the repository and navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Copy the environment example file and configure:
```bash
cp .env.example .env
```

4. Update the `.env` file with your database credentials and other settings.

5. Generate Prisma client:
```bash
npm run postinstall
```

6. Run database migrations:
```bash
npm run db:migrate
```

7. (Optional) Seed the database with initial data:
```bash
npm run db:seed
```

### Development

Start the development server with hot reload:
```bash
npm run dev
```

The API will be available at `http://localhost:3001`

### Production Build

1. Build the TypeScript code:
```bash
npm run build
```

2. Run database migrations:
```bash
npm run db:migrate
```

3. Start the production server:
```bash
npm start
```

## Docker Deployment

### Build and Run with Docker

```bash
# Build the Docker image
docker build -t steakz-backend .

# Run the container
docker run -d \
  -p 3001:3001 \
  --env-file .env \
  --name steakz-backend \
  steakz-backend
```

### Docker Compose (with PostgreSQL)

Create a `docker-compose.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: steakz
      POSTGRES_PASSWORD: your_secure_password
      POSTGRES_DB: steakz_db
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  backend:
    build: .
    ports:
      - "3001:3001"
    environment:
      DATABASE_URL: postgresql://steakz:your_secure_password@postgres:5432/steakz_db
      JWT_SECRET: your-production-jwt-secret
      FRONTEND_URL: https://your-frontend-domain.com
    depends_on:
      - postgres

volumes:
  postgres_data:
```

Run with:
```bash
docker-compose up -d
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 3001) |
| `NODE_ENV` | No | Environment (development/production) |
| `DATABASE_URL` | Yes | Database connection string |
| `JWT_SECRET` | Yes | Secret key for JWT tokens |
| `JWT_EXPIRES_IN` | No | Token expiration time (default: 7d) |
| `FRONTEND_URL` | No | Frontend URL for CORS (default: http://localhost:5173) |
| `ADMIN_EMAIL` | No | Default admin email |
| `ADMIN_PASSWORD` | No | Default admin password |

## API Endpoints

### Health Check
- `GET /health` - Server health status
- `GET /ready` - Readiness probe
- `GET /live` - Liveness probe

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### Admin
- `GET /api/admin/users` - List all users
- `PUT /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Delete user

### Menu
- `GET /api/menu` - Get menu items
- `POST /api/menu` - Create menu item
- `PUT /api/menu/:id` - Update menu item
- `DELETE /api/menu/:id` - Delete menu item

### Orders
- `GET /api/orders` - List orders
- `POST /api/orders` - Create order
- `PUT /api/orders/:id` - Update order status

*(See individual route files for complete endpoint documentation)*

## Database Migrations

After modifying the Prisma schema:

```bash
# Create a new migration
npx prisma migrate dev --name description

# Deploy migrations to production
npm run db:migrate
```

## Logs

The application logs to stdout. In production, consider using a log management service or configure log rotation.

## Security Considerations

1. **Always set a strong `JWT_SECRET`** in production (minimum 32 characters)
2. **Use HTTPS** in production
3. **Set `NODE_ENV=production`** to enable production optimizations
4. **Keep `.env` file secure** and never commit it to version control
5. **Change default admin credentials** immediately after deployment

## Troubleshooting

### Database Connection Issues
- Verify `DATABASE_URL` is correct
- Ensure PostgreSQL is running and accessible
- Check database user permissions

### Port Already in Use
- Change `PORT` in `.env` or pass as environment variable
- Kill the process using the port: `lsof -ti:3001 | xargs kill -9`

### Prisma Client Errors
- Run `npm run postinstall` to regenerate the client
- Delete `node_modules` and reinstall

## License

Proprietary - Steakz Restaurant Management System