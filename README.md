# EmailPro - Email Campaign Management Platform

A powerful, beautiful email sending platform for cold email campaigns with tracking, analytics, and reply detection.

## Features

- ✅ **Multi-Inbox Support** - Connect multiple Gmail accounts
- ✅ **CSV Import** - Upload leads with custom fields
- ✅ **Email Personalization** - Use {{first_name}}, {{company}}, etc.
- ✅ **Send Rate Limiting** - 20/day, 100/week limits
- ✅ **Email Tracking** - Track opens and replies automatically
- ✅ **Beautiful Dashboard** - Real-time analytics and metrics
- ✅ **Campaign Management** - Create, send, and monitor campaigns

## Prerequisites

- Python 3.9+
- Node.js 16+
- PostgreSQL 12+
- Git

## Quick Start (Using PostgreSQL Locally)

### 1. Clone/Setup Project

```bash
cd email_platform
```

### 2. Set Up Database

#### Option A: Using Docker (Recommended)

```bash
# Start PostgreSQL
docker-compose up -d

# Verify PostgreSQL is running
docker-compose logs postgres
```

#### Option B: Using Local PostgreSQL

Make sure PostgreSQL is running and create database:

```bash
psql -U postgres
CREATE DATABASE email_platform;
\q
```

### 3. Set Up Backend (FastAPI)

```bash
# Create Python virtual environment
cd backend
python3 -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Backend will be available at: http://localhost:8000

### 4. Set Up Frontend (React)

In a new terminal:

```bash
# Go to frontend directory
cd frontend

# Install dependencies
npm install

# Start development server
npm start
```

Frontend will be available at: http://localhost:3000

## First Time Setup

### 1. Add Gmail Account

1. Go to https://myaccount.google.com
2. Click "Security" on the left
3. Enable "2-Step Verification" (if not already)
4. Search for "App passwords"
5. Select "Mail" and "Windows Computer"
6. Copy the 16-character password

In EmailPro:
1. Go to "Inboxes" tab
2. Click "Add New Inbox"
3. Paste the password and your email
4. Click "Add Inbox"

### 2. Create Your First Campaign

1. Go to "New Campaign" tab
2. Upload CSV with leads (See CSV Format below)
3. Create email template with {{variables}}
4. Review and send

## CSV Format

Your CSV file should have these columns (required minimum):

```csv
first_name,last_name,company,email,job_title,custom_field_1,custom_field_2,custom_field_3
John,Doe,Acme Inc,john@acme.com,CEO,tech_stack,budget,other_info
Jane,Smith,Tech Corp,jane@tech.com,CTO,python,large,ai_interested
```

**Required Columns:**
- first_name
- last_name
- company
- email

**Optional Columns:**
- job_title
- custom_field_1
- custom_field_2
- custom_field_3

## Email Template Variables

Use these in your email templates for personalization:

- `{{first_name}}` - Lead's first name
- `{{last_name}}` - Lead's last name
- `{{company}}` - Company name
- `{{email}}` - Email address
- `{{job_title}}` - Job title
- `{{custom_field_1}}` - Custom field 1
- `{{custom_field_2}}` - Custom field 2
- `{{custom_field_3}}` - Custom field 3

**Example Template:**

Subject: `{{first_name}}, quick question about {{company}}`

Body:
```
Hi {{first_name}},

I noticed {{company}} is using {{custom_field_1}}. 

Would you be interested in discussing {{custom_field_2}}?

Best regards,
John
```

## API Endpoints

### Inboxes
- `GET /api/inboxes` - Get all inboxes
- `POST /api/inboxes` - Add new inbox

### Campaigns
- `GET /api/campaigns` - List all campaigns
- `POST /api/campaigns` - Create campaign
- `GET /api/campaigns/{id}` - Get campaign details
- `POST /api/campaigns/{id}/send` - Send campaign

### Analytics
- `GET /api/analytics` - Get overall analytics
- `GET /api/track/open/{tracking_id}` - Track email open

### Tracking
- `POST /api/check-replies` - Check for new replies

## Limits

**Daily Limit:** 20 emails per inbox per day
**Weekly Limit:** 100 emails per inbox per week

To change limits, edit `EmailService.DAILY_LIMIT` and `EmailService.WEEKLY_LIMIT` in `backend/main.py`

## Email Tracking

### How Open Tracking Works

When you send an email, a tiny 1x1 tracking pixel is added at the end. When the recipient opens the email, their email client loads this pixel, and we log an open event.

**Note:** Tracking only works if recipients have images enabled in their email client (most do).

### Reply Detection

The system automatically checks for new replies by monitoring your Gmail inbox via IMAP. Replies are logged and linked to the original sent email.

## Troubleshooting

### "Invalid Gmail credentials"

- Make sure you're using an **App Password**, not your regular Gmail password
- Generate new app password at myaccount.google.com/apppasswords
- Make sure 2-Step Verification is enabled

### Database Connection Error

```
postgresql://postgres:postgres@localhost:5432/email_platform
```

If using Docker:
```bash
docker-compose ps
docker-compose logs postgres
```

If using local PostgreSQL:
```bash
psql -U postgres -d email_platform
```

### Frontend won't load

Make sure both backend and frontend are running:
- Backend: http://localhost:8000/api/health (should return `{"status":"ok"}`)
- Frontend: http://localhost:3000

### Emails not sending

1. Check Gmail inbox and verify it's the correct account
2. Check that App Password is correct
3. Ensure daily/weekly limits haven't been reached
4. Check backend logs for errors

## Development

### Backend Structure

```
backend/
├── main.py          # FastAPI app with all endpoints
├── models.py        # SQLAlchemy database models
└── requirements.txt # Python dependencies
```

### Frontend Structure

```
frontend/
├── src/
│   ├── App.js       # Main app component
│   ├── App.css      # Global styles
│   └── pages/       # Page components
│       ├── Dashboard.js
│       ├── Inboxes.js
│       ├── Campaigns.js
│       ├── CreateCampaign.js
│       └── CampaignDetail.js
├── package.json
└── public/
    └── index.html
```

## Database Schema

### Key Tables

- `inbox_configs` - Gmail accounts
- `campaigns` - Email campaigns
- `leads` - Recipients from CSV
- `emails` - Individual sent emails
- `open_tracking` - Email open events
- `replies` - Email reply messages
- `daily_limits` - Daily send counters
- `weekly_limits` - Weekly send counters

## Security Notes

- App Passwords are encrypted in database (production only)
- All SMTP connections use TLS
- Tracking pixel is anonymous
- No personal data is logged except email address

## Future Roadmap

- [ ] Email scheduling (send at specific times)
- [ ] A/B testing
- [ ] Reply AI categorization
- [ ] Outlook/Microsoft 365 support
- [ ] Advanced analytics
- [ ] Multi-user support
- [ ] Custom domain tracking
- [ ] Email template builder

## Support

For issues or questions:
1. Check Troubleshooting section
2. Review backend logs: `docker-compose logs postgres`
3. Check browser console for frontend errors
4. Verify database connection

## License

MIT License - Use freely for personal or commercial projects.

---

**Happy cold emailing!** 🚀
