# CourseCone 🎓

> A VIT course management platform for seamless interaction, collaboration, and peer learning

[![Apache License 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/outside-rocket/coursecone)](https://github.com/outside-rocket/coursecone/stargazers)

## Overview

CourseCone is a modern course management and collaboration platform designed specifically for VIT (Vellore Institute of Technology) students. It enables seamless interaction with classmates, peer-to-peer learning, and efficient course management all in one place.

### Key Features

- 📚 **Course Management** - Organize and track courses, assignments, and deadlines
- 👥 **Peer Collaboration** - Connect with classmates and collaborate on projects
- 💬 **Discussion Forums** - Class-specific discussion boards and study groups
- 📅 **Schedule Sync** - Centralized timetable and event management
- 📝 **Assignment Tracking** - Submit, review, and track assignments
- 🔔 **Real-time Notifications** - Stay updated on course activities
- 🤝 **Study Groups** - Form and manage study groups with peers

---

## Tech Stack

### Frontend
<div>
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/Vue.js-35495E?style=for-the-badge&logo=vue.js&logoColor=4FC08D" alt="Vue.js" />
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Redux-764ABC?style=for-the-badge&logo=redux&logoColor=white" alt="Redux" />
  <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Material_UI-007FFF?style=for-the-badge&logo=material-ui&logoColor=white" alt="Material UI" />
</div>

**Tools:**
- **Framework**: React 18+ / Vue 3 / Angular
- **Styling**: Tailwind CSS / Material UI
- **State Management**: Redux Toolkit / Pinia / Context API
- **Build Tool**: Vite / Webpack
- **Language**: TypeScript / JavaScript

### Backend
<div>
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express.js" />
  <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/Django-092E20?style=for-the-badge&logo=django&logoColor=white" alt="Django" />
  <img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB" />
  <img src="https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=json-web-tokens&logoColor=white" alt="JWT" />
</div>

**Tools:**
- **Runtime**: Node.js / Python / Java
- **Framework**: Express.js / Django / Spring Boot
- **Database**: PostgreSQL / MongoDB
- **Authentication**: JWT / OAuth 2.0
- **API**: RESTful API / GraphQL

### DevOps & Tools
<div>
  <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/GitHub_Actions-2088FF?style=for-the-badge&logo=github-actions&logoColor=white" alt="GitHub Actions" />
  <img src="https://img.shields.io/badge/Git-F05032?style=for-the-badge&logo=git&logoColor=white" alt="Git" />
  <img src="https://img.shields.io/badge/Jest-C21325?style=for-the-badge&logo=jest&logoColor=white" alt="Jest" />
  <img src="https://img.shields.io/badge/ESLint-4B3A82?style=for-the-badge&logo=eslint&logoColor=white" alt="ESLint" />
  <img src="https://img.shields.io/badge/Swagger-85EA2D?style=for-the-badge&logo=swagger&logoColor=white" alt="Swagger" />
</div>

**Tools:**
- **Version Control**: Git
- **Containerization**: Docker / Docker Compose
- **CI/CD**: GitHub Actions
- **Testing**: Jest / Pytest / JUnit
- **Linting**: ESLint / Pylint
- **Documentation**: Swagger / OpenAPI

---

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v16 or higher) - [Download](https://nodejs.org/)
- **npm** or **yarn** (v7+ or v1.22+)
- **Git** (v2.0 or higher) - [Download](https://git-scm.com/)
- **Docker** (optional, for containerized development) - [Download](https://www.docker.com/)

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/outside-rocket/coursecone.git
cd coursecone
```

### 2. Install Dependencies

**Using npm:**
```bash
npm install
```

**Using yarn:**
```bash
yarn install
```

### 3. Environment Setup

Create a `.env.local` file in the root directory and add the following variables:

```env
# API Configuration
VITE_API_URL=http://localhost:3001
VITE_API_TIMEOUT=30000

# Authentication
VITE_AUTH_PROVIDER=google
VITE_GOOGLE_CLIENT_ID=your_google_client_id

# Feature Flags
VITE_ENABLE_BETA_FEATURES=false
```

### 4. Start Development Server

**Frontend:**
```bash
npm run dev
# or
yarn dev
```

The application will be available at `http://localhost:5173`

**Backend (if applicable):**
```bash
npm run server
# or
yarn server
```

Backend API will run on `http://localhost:3001`

---

## Project Structure

```
coursecone/
├── public/                 # Static assets
├── src/
│   ├── components/        # Reusable React/Vue components
│   ├── pages/             # Page components
│   ├── store/             # State management
│   ├── services/          # API services
│   ├── hooks/             # Custom hooks
│   ├── utils/             # Utility functions
│   ├── styles/            # Global styles
│   └── App.jsx            # Root component
├── server/                # Backend code (if applicable)
│   ├── routes/
│   ├── controllers/
│   ├── models/
│   └── config/
├── tests/                 # Test files
├── .env.example           # Environment variables template
├── .gitignore             # Git ignore rules
├── package.json           # Project dependencies
├── vite.config.js         # Vite configuration
└── README.md              # This file
```

---

## Available Scripts

### Development
```bash
npm run dev              # Start development server
npm run build            # Build for production
npm run preview          # Preview production build locally
```

### Testing
```bash
npm run test             # Run test suite
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Generate coverage report
```

### Linting & Formatting
```bash
npm run lint             # Run ESLint
npm run format           # Format code with Prettier
npm run lint:fix         # Fix linting errors
```

### Backend (if applicable)
```bash
npm run server           # Start backend server
npm run server:dev       # Start backend in development mode
npm run db:migrate       # Run database migrations
```

---

## Development Workflow

### Creating a Feature Branch
```bash
git checkout -b feature/your-feature-name
```

### Making Changes
1. Make your changes
2. Run tests: `npm run test`
3. Format code: `npm run format`
4. Commit with clear messages:
   ```bash
   git commit -m "feat: add user authentication"
   ```

### Creating a Pull Request
1. Push your branch: `git push origin feature/your-feature-name`
2. Open a pull request on GitHub
3. Ensure all checks pass
4. Request review from maintainers

---

## API Documentation

### Base URL
```
http://localhost:3001/api/v1
```

### Key Endpoints

#### Courses
- `GET /courses` - List all courses
- `GET /courses/:id` - Get course details
- `POST /courses` - Create a new course
- `PUT /courses/:id` - Update course
- `DELETE /courses/:id` - Delete course

#### Users
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `GET /users/:id` - Get user profile
- `PUT /users/:id` - Update user profile

#### Assignments
- `GET /assignments` - List assignments
- `POST /assignments` - Create assignment
- `GET /assignments/:id` - Get assignment details
- `POST /assignments/:id/submit` - Submit assignment

For detailed API documentation, see [API_DOCS.md](./docs/API_DOCS.md) or visit `/api/docs` when running the server.

---

## Testing

### Running Tests
```bash
npm run test
```

### Writing Tests
Create test files with `.test.js` or `.spec.js` extension:

```javascript
describe('User Authentication', () => {
  it('should login user with valid credentials', () => {
    // test code
  });
});
```

### Coverage Report
```bash
npm run test:coverage
```

---

## Building for Production

### Build
```bash
npm run build
```

### Preview
```bash
npm run preview
```

### Docker Build (if applicable)
```bash
docker build -t coursecone:latest .
docker run -p 3000:3000 coursecone:latest
```

---

## Deployment

### Deployment Platforms
- **Vercel** (recommended for frontend)
- **Netlify** (frontend)
- **Heroku** (full-stack)
- **AWS** (scalable)
- **DigitalOcean** (VPS)

### Pre-deployment Checklist
- [ ] All tests passing
- [ ] Build completes without errors
- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] Security headers configured
- [ ] CORS properly configured
- [ ] Rate limiting enabled

---

## Contributing

We welcome contributions! Please follow these steps:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/AmazingFeature`)
3. **Make** your changes
4. **Commit** with clear messages (`git commit -m 'Add AmazingFeature'`)
5. **Push** to your branch (`git push origin feature/AmazingFeature`)
6. **Open** a Pull Request

### Contribution Guidelines
- Follow existing code style
- Add tests for new features
- Update documentation
- Use clear commit messages
- Reference issues in PRs

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines.

---

## License

This project is licensed under the **Apache License 2.0**. See the [LICENSE](LICENSE) file for details.

---

## Support & Community

- **Issues**: [GitHub Issues](https://github.com/outside-rocket/coursecone/issues)
- **Discussions**: [GitHub Discussions](https://github.com/outside-rocket/coursecone/discussions)
- **Email**: [support@coursecone.dev](mailto:support@coursecone.dev)
- **Discord**: [Join Community](https://discord.gg/coursecone) (if applicable)

---

## Roadmap

### v1.0 (MVP)
- [ ] User authentication & authorization
- [ ] Course management (CRUD)
- [ ] Assignment submission system
- [ ] Basic messaging system

### v1.1
- [ ] Real-time notifications
- [ ] Discussion forums
- [ ] Grade tracking
- [ ] File upload system

### v1.2
- [ ] Study groups
- [ ] Schedule synchronization
- [ ] Mobile app
- [ ] Advanced analytics

See [ROADMAP.md](./docs/ROADMAP.md) for detailed plans.

---

## Troubleshooting

### Port Already in Use
```bash
# Find process on port 5173
lsof -i :5173

# Kill the process
kill -9 <PID>
```

### Dependencies Issues
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Build Fails
```bash
# Clear build cache
rm -rf dist
npm run build
```

---

## FAQ

**Q: How do I report a bug?**  
A: Create an issue on [GitHub Issues](https://github.com/outside-rocket/coursecone/issues) with a clear description and reproduction steps.

**Q: Can I use this for non-VIT institutions?**  
A: Yes! While built for VIT, it can be adapted for any educational institution.

**Q: How do I contribute?**  
A: See the [Contributing](#contributing) section above.

---

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history and release notes.

---

## Authors

- **Creator**: [@outside-rocket](https://github.com/outside-rocket)

---

## Acknowledgments

- [Vellore Institute of Technology](https://vit.ac.in/) (VIT)
- Community contributors
- Open source libraries and frameworks

---

**A VVK project**

⭐ If you find this project helpful, please consider giving it a star!
