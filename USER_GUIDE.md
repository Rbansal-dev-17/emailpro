# EmailPro User Guide

## Getting Started with EmailPro

### Step 1: Add Your Gmail Account

1. Go to https://myaccount.google.com
2. Click "Security" in the left menu
3. Scroll down and click "App passwords"
   - If you don't see this, enable 2-Step Verification first
4. Select "Mail" and "Windows Computer" (or your device)
5. Google will generate a 16-character password
6. Copy this password

**In EmailPro:**
1. Click "Inboxes" in the top navigation
2. Click "Add New Inbox"
3. Fill in the form:
   - **Inbox Name**: e.g., "Sales Outreach"
   - **Gmail Address**: your-email@gmail.com
   - **App Password**: Paste the 16-character password
4. Click "Add Inbox"

✅ Your inbox is now connected!

---

## Creating Your First Campaign

### Step 2: Prepare Your CSV File

Create a CSV file (in Excel, Google Sheets, or any text editor) with your leads:

**Minimum columns (required):**
```
first_name,last_name,company,email
John,Doe,Acme Inc,john@acme.com
Jane,Smith,Tech Corp,jane@tech.com
```

**Complete example with optional fields:**
```
first_name,last_name,company,email,job_title,custom_field_1,custom_field_2,custom_field_3
John,Doe,Acme Inc,john@acme.com,CEO,Python,Large,AI-Interested
Jane,Smith,Tech Corp,jane@tech.com,CTO,JavaScript,Medium,API-Integration
```

### Step 3: Create Campaign (3-Step Wizard)

**Step 1: Upload Leads**
1. Click "New Campaign" in the top navigation
2. Drag & drop your CSV file (or click to select)
3. You should see: "✓ Loaded X leads"
4. Review the preview table
5. Click "Next: Email Template"

**Step 2: Create Template**
1. Enter **Campaign Name**: e.g., "Q1 Outreach"
2. Select **Inbox**: Choose which Gmail account to send from
3. Enter **Email Subject**: 
   ```
   Hi {{first_name}}, quick question about {{company}}
   ```
4. Enter **Email Body**:
   ```
   Hi {{first_name}},

   I noticed {{company}} and thought you might be interested in {{custom_field_1}}.

   Are you the right person to discuss {{custom_field_2}}?

   Best regards,
   John
   ```
5. Use variables like `{{first_name}}` for personalization
6. Click "Next: Review"

**Step 3: Review & Launch**
1. Verify all campaign details
2. Select a lead to preview the actual email (with personalization)
3. Review the personalized subject and body
4. Click "Create & Launch Campaign"

✅ Campaign is created!

---

## Sending Your Campaign

### Option A: Send Immediately

After creating the campaign, it will be in "Draft" status.

1. Go to "Campaigns" in navigation
2. Find your campaign in the list
3. Click "View Details"
4. Click the big blue "Send Campaign" button
5. Emails will start sending (1 per second)

**⚠️ Note:** The system respects limits:
- **20 emails per day** (per inbox)
- **100 emails per week** (per inbox)
- Only sends **Monday-Friday** (for MVP)

If your campaign exceeds the daily limit, it will send as many as allowed today, and resume tomorrow.

### Option B: Draft and Send Later

1. Create campaign as normal
2. Go to "Campaigns" page
3. Click your campaign
4. You can send it anytime by clicking "Send Campaign"

---

## Monitoring Your Campaign

### Dashboard

The main dashboard shows real-time metrics:

- **Total Campaigns**: Number of campaigns created
- **Emails Sent**: Total emails sent across all campaigns
- **Opens**: Number of emails opened
- **Replies**: Number of replies received
- **Open Rate**: Percentage of opens
- **Reply Rate**: Percentage of replies
- **Daily Limit**: Emails sent today (20 limit)
- **Weekly Limit**: Emails sent this week (100 limit)

### Campaign Details

Click on any campaign to see:

1. **Campaign Info**
   - Name
   - Status (Draft/Sending/Completed)
   - Created date

2. **Stats**
   - Total leads
   - Emails sent
   - Emails opened
   - Replies received

3. **Email List Table**
   - Email address
   - Send status (Sent/Pending/Failed)
   - Opened? (Yes/No with open count)
   - Delivery time

---

## Understanding Email Tracking

### Open Tracking

When you send an email, a tiny 1×1 pixel is automatically added to the end. When the recipient opens the email:

1. Their email client loads the pixel image
2. Our server logs this as an "open"
3. You see it in the campaign details

**Note:** Tracking requires images to be enabled in the email client (Gmail does this by default).

### Reply Detection

The system automatically:
1. Checks Gmail inbox for new emails every few minutes
2. Matches replies to sent emails
3. Logs them as "Replies"

You can see the reply count in:
- Dashboard (Total Replies card)
- Campaign Details (Replies column)

---

## Best Practices

### Email Content

✅ **DO:**
- Personalize with {{first_name}} and {{company}}
- Keep subject line short (50 characters)
- Keep body concise (3-5 sentences)
- Include clear value proposition
- Use professional tone
- Include your name

❌ **DON'T:**
- Use spammy language ("FREE!!", "LIMITED OFFER")
- Include excessive links
- Use generic templates without personalization
- Send at odd hours
- Blast the same email to everyone

### CSV Preparation

✅ **DO:**
- Use UTF-8 encoding
- Remove duplicates
- Validate email addresses
- Include accurate company names
- Use consistent formatting

❌ **DON'T:**
- Mix different delimiter styles
- Include special characters without escaping
- Have empty email columns
- Use malformed email addresses

### Campaign Strategy

✅ **DO:**
- Start with smaller tests (10-20 emails)
- Track open and reply rates
- Adjust subject lines based on performance
- Wait 24 hours between campaigns to same person
- Monitor bounce/failure rates

❌ **DON'T:**
- Send 100+ emails in first day (builds reputation slowly)
- Reuse same subject lines
- Send multiple emails per day
- Use Gmail addresses as send-from (use your domain)

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl/Cmd + Enter | Submit form |
| Escape | Close modal |
| Click campaign | View details |

---

## Troubleshooting

### "Gmail Credentials Invalid"

**Solution:**
1. Go to myaccount.google.com/apppasswords
2. Generate a **new** app password
3. Make sure it's exactly 16 characters (no spaces)
4. Paste it again in EmailPro

### "Daily Limit Reached"

**Solution:**
- Wait until tomorrow (limits reset at midnight)
- Create a new campaign tomorrow
- Use a different Gmail account (add to Inboxes first)

### Emails Sent but Not Opening/Tracking

**Solution:**
1. Check if recipient opened from email client (not web)
2. Some email clients disable image loading by default
3. This is normal - tracking isn't 100% reliable

### CSV Upload Fails

**Solution:**
1. Make sure file is named with `.csv` extension
2. Check that first row has column headers
3. Ensure required columns exist: first_name, last_name, company, email
4. Try saving from Excel as "CSV (Comma delimited)"

### Campaign Showing 0 Emails Sent

**Solution:**
1. Go to campaign details
2. Click the blue "Send Campaign" button
3. Wait a few seconds - emails send in background
4. Refresh the page to see updates

---

## FAQ

**Q: Can I edit a campaign after creating it?**
A: Not in the MVP. Create a new campaign instead.

**Q: Can I schedule emails for specific times?**
A: Not in MVP v1.0. Coming in v1.1.

**Q: What if I exceed the daily limit?**
A: Remaining emails queue for the next day.

**Q: Can I use multiple Gmail accounts?**
A: Yes! Add multiple inboxes and select which to send from.

**Q: How long does open tracking work?**
A: Indefinitely - you can track opens years later.

**Q: Is my Gmail password stored?**
A: Yes, but only in the database. Use App Passwords, not your actual password.

**Q: Can I export campaign data?**
A: Not in MVP. Use the dashboard screenshots or email me for data export.

**Q: What email providers can I track replies from?**
A: Replies work with any email provider - we monitor your Gmail inbox.

---

## Tips & Tricks

1. **Test First**: Send yourself a test email to verify personalization
2. **Monitor Overnight**: Campaigns continue sending in the background
3. **Check Replies Daily**: Replies are logged as they arrive
4. **Use Custom Fields**: Take advantage of custom_field_1/2/3 for extra data
5. **Keep Templates Simple**: Complex HTML may not render properly
6. **Review Bounce Rate**: Check failed emails in campaign details

---

## Getting Help

1. **Check Status Page**: http://localhost:8000/docs (API status)
2. **Review Logs**: Backend logs show email sending errors
3. **Browser Console**: Frontend errors show in browser console (F12)
4. **See README.md**: Full technical documentation

---

**You're all set!** Start by adding an inbox, then create your first campaign. Good luck! 🚀
