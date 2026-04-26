"""
Email Sending Platform - FastAPI Backend
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks, Request, Depends
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, and_, func
from sqlalchemy.orm import sessionmaker, Session
import os, math, uuid, asyncio, smtplib, imaplib
import email as email_lib
from datetime import datetime, timedelta, date
from typing import List, Optional
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pydantic import BaseModel, validator

from models import (Base, Lead, Campaign, Email, InboxConfig, OpenTracking,
                    Reply, DailyLimit, WeeklyLimit,
                    FollowUp, FollowUpVariation, FollowUpEmail)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://postgres:postgres123@localhost:5432/email_platform"
)

app = FastAPI(title="Email Sending Platform API", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)

DAILY_LIMIT = 20
WEEKLY_LIMIT = 100

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ============================================================================
# PYDANTIC SCHEMAS
# ============================================================================

class InboxConfigRequest(BaseModel):
    inbox_name: str
    email_address: str
    app_password: str

class InboxConfigResponse(BaseModel):
    id: int
    inbox_name: str
    email_address: str
    created_at: datetime
    class Config:
        from_attributes = True

class LeadData(BaseModel):
    first_name: str
    last_name: str
    company: str
    email: str
    job_title: Optional[str] = None
    custom_field_1: Optional[str] = None
    custom_field_2: Optional[str] = None
    custom_field_3: Optional[str] = None

    @validator('email')
    def validate_email(cls, v):
        if '@' not in v:
            raise ValueError('Invalid email address')
        return v

class VariationIn(BaseModel):
    subject: str
    body: str

class FollowUpVariationIn(BaseModel):
    body: str   # subject is auto Re: <original>

class FollowUpIn(BaseModel):
    send_after_days: int
    variations: List[FollowUpVariationIn]   # 1-4

class TemplateIn(BaseModel):
    variations: List[VariationIn]           # 1-4
    followups: Optional[List[FollowUpIn]] = []

class CampaignRequest(BaseModel):
    campaign_name: str
    inbox_id: int
    templates: List[TemplateIn]             # 1-5
    leads: List[LeadData]

class CampaignResponse(BaseModel):
    id: int
    campaign_name: str
    inbox_id: int
    total_leads: int
    sent_count: int
    opened_count: int
    replied_count: int
    status: str
    created_at: datetime
    class Config:
        from_attributes = True

class EmailDetailResponse(BaseModel):
    id: int
    recipient_email: str
    subject: str
    status: str
    sent_at: Optional[datetime]
    opened_at: Optional[datetime]
    is_opened: bool
    open_count: int
    template_index: Optional[int]
    variation_index: Optional[int]
    is_bounced: bool = False
    bounce_type: Optional[str] = None
    class Config:
        from_attributes = True

class AnalyticsResponse(BaseModel):
    total_campaigns: int
    total_emails_sent: int
    total_opens: int
    total_replies: int
    open_rate: float
    reply_rate: float
    daily_limit_used: int
    daily_limit_remaining: int
    weekly_limit_used: int
    weekly_limit_remaining: int
    last_7_days_sent: int

# ============================================================================
# EMAIL SERVICE
# ============================================================================

class EmailService:
    def __init__(self, email_address: str, app_password: str):
        self.email_address = email_address
        self.app_password = app_password
        self.smtp_server = "smtp.gmail.com"
        self.smtp_port = 587

    def send_email(self, to_email: str, subject: str, body: str,
                   tracking_id: str,
                   base_url: str = "http://localhost:8000") -> tuple:
        """Returns (success, message_id)"""
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = self.email_address
            msg["To"] = to_email
            pixel = f"{base_url}/api/track/open/{tracking_id}"
            html = f"{body}<br/><img src='{pixel}' width='1' height='1' style='display:none'/>"
            msg.attach(MIMEText(body, "plain"))
            msg.attach(MIMEText(html, "html"))
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as s:
                s.starttls()
                s.login(self.email_address, self.app_password)
                s.send_message(msg)
                mid = msg.get("Message-ID") or f"<{uuid.uuid4()}@emailpro>"
            return True, mid
        except Exception as e:
            print(f"SMTP error → {to_email}: {e}")
            return False, None

    def send_followup(self, to_email: str, subject: str, body: str,
                      original_message_id: str) -> bool:
        """Send in-thread reply using In-Reply-To header."""
        try:
            thread_subject = subject if subject.lower().startswith("re:") else f"Re: {subject}"
            msg = MIMEMultipart("alternative")
            msg["Subject"] = thread_subject
            msg["From"] = self.email_address
            msg["To"] = to_email
            msg["In-Reply-To"] = original_message_id
            msg["References"] = original_message_id
            msg.attach(MIMEText(body, "plain"))
            msg.attach(MIMEText(body.replace("\n", "<br/>"), "html"))
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as s:
                s.starttls()
                s.login(self.email_address, self.app_password)
                s.send_message(msg)
            return True
        except Exception as e:
            print(f"Follow-up SMTP error → {to_email}: {e}")
            return False

# ============================================================================
# UTILITY
# ============================================================================

def render(template: str, lead) -> str:
    d = {
        'first_name': lead.first_name, 'last_name': lead.last_name,
        'company': lead.company, 'email': lead.email,
        'job_title': lead.job_title or '',
        'custom_field_1': lead.custom_field_1 or '',
        'custom_field_2': lead.custom_field_2 or '',
        'custom_field_3': lead.custom_field_3 or '',
    }
    for k, v in d.items():
        template = template.replace(f"{{{{{k}}}}}", v)
    return template

def get_daily_used(db: Session, inbox_id: int) -> int:
    rec = db.query(DailyLimit).filter(
        and_(DailyLimit.date == date.today(), DailyLimit.inbox_id == inbox_id)
    ).first()
    return rec.emails_sent if rec else 0

def get_weekly_used(db: Session, inbox_id: int) -> int:
    ws = date.today() - timedelta(days=date.today().weekday())
    rec = db.query(WeeklyLimit).filter(
        and_(WeeklyLimit.week_start == ws, WeeklyLimit.inbox_id == inbox_id)
    ).first()
    return rec.emails_sent if rec else 0

def add_to_limits(db: Session, inbox_id: int, count: int):
    today = date.today()
    ws = today - timedelta(days=today.weekday())
    d = db.query(DailyLimit).filter(
        and_(DailyLimit.date == today, DailyLimit.inbox_id == inbox_id)
    ).first()
    if not d:
        d = DailyLimit(date=today, inbox_id=inbox_id, emails_sent=0)
        db.add(d)
    d.emails_sent += count
    w = db.query(WeeklyLimit).filter(
        and_(WeeklyLimit.week_start == ws, WeeklyLimit.inbox_id == inbox_id)
    ).first()
    if not w:
        w = WeeklyLimit(week_start=ws, inbox_id=inbox_id, emails_sent=0)
        db.add(w)
    w.emails_sent += count
    db.commit()

def daily_remaining(db: Session, inbox_id: int) -> int:
    return max(0, DAILY_LIMIT - get_daily_used(db, inbox_id))

def assign_variation(lead_idx: int, total_leads: int, num_variations: int) -> int:
    """
    Positional even split.
    chunk_size = ceil(total / num_variations)
    variation = min(lead_idx // chunk_size, num_variations - 1)
    """
    chunk = math.ceil(total_leads / num_variations)
    return min(lead_idx // chunk, num_variations - 1)

# ============================================================================
# BACKGROUND: SEND ORIGINAL CAMPAIGN
# ============================================================================

async def send_campaign_async(campaign_id: int, inbox_id: int,
                               email_address: str, app_password: str,
                               emails_to_send: int):
    db = SessionLocal()
    try:
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        if not campaign:
            return

        service = EmailService(email_address, app_password)
        templates = campaign.email_templates or []
        # Single template — use first entry
        tpl = templates[0] if templates else {}
        tpl_variations = tpl.get("variations", [])
        if not tpl_variations:
            tpl_variations = [{"subject": campaign.email_subject, "body": campaign.email_body}]

        leads = db.query(Lead).filter(Lead.campaign_id == campaign_id).all()
        total_leads = len(leads)
        num_vars = len(tpl_variations)

        sent_count = 0
        for lead_idx, lead in enumerate(leads[:emails_to_send]):
            # Positional variation split across all leads
            v_idx = assign_variation(lead_idx, total_leads, num_vars)
            variation = tpl_variations[v_idx]

            rendered_subject = render(variation["subject"], lead)
            rendered_body = render(variation["body"], lead)
            tracking_id = str(uuid.uuid4())

            success, message_id = service.send_email(
                lead.email, rendered_subject, rendered_body, tracking_id
            )

            is_hard_bounce = not success and message_id is None
            email_rec = Email(
                campaign_id=campaign_id,
                lead_id=lead.id,
                recipient_email=lead.email,
                subject=rendered_subject,
                body=rendered_body,
                tracking_id=tracking_id,
                message_id=message_id,
                template_index=0,
                variation_index=v_idx,
                sent_at=datetime.utcnow() if success else None,
                status="sent" if success else "failed",
                is_bounced=is_hard_bounce,
                bounce_type="hard" if is_hard_bounce else None,
                bounced_at=datetime.utcnow() if is_hard_bounce else None,
            )
            db.add(email_rec)
            if success:
                sent_count += 1
            await asyncio.sleep(1)

        db.commit()

        campaign.sent_count = sent_count
        campaign.status = "completed"
        campaign.completed_at = datetime.utcnow()
        db.commit()

        add_to_limits(db, inbox_id, sent_count)

        # Activate scheduled follow-ups now that completed_at is known
        followups = db.query(FollowUp).filter(
            and_(FollowUp.campaign_id == campaign_id, FollowUp.status == "waiting")
        ).all()
        for fu in followups:
            fu.scheduled_send_at = campaign.completed_at + timedelta(days=fu.send_after_days)
            fu.status = "scheduled"
        db.commit()

    except Exception as e:
        print(f"send_campaign_async error: {e}")
        db.rollback()
    finally:
        db.close()

# ============================================================================
# BACKGROUND: SEND ONE FOLLOW-UP BATCH
# ============================================================================

async def send_followup_async(followup_id: int, inbox_id: int,
                               email_address: str, app_password: str,
                               budget: int):
    """
    Send up to `budget` pending follow-up emails for this follow-up,
    skipping leads who have replied.
    """
    db = SessionLocal()
    try:
        fu = db.query(FollowUp).filter(FollowUp.id == followup_id).first()
        if not fu:
            return

        service = EmailService(email_address, app_password)
        variations = fu.variations   # list of FollowUpVariation ordered by variation_index

        # Build exclusion set: replied leads + bounced leads
        replied_emails = {
            r.from_email.lower()
            for r in db.query(Reply).join(Email).filter(
                Email.campaign_id == fu.campaign_id
            ).all()
        }
        bounced_emails = {
            e.recipient_email.lower()
            for e in db.query(Email).filter(
                and_(Email.campaign_id == fu.campaign_id, Email.is_bounced == True)
            ).all()
        }
        excluded = replied_emails | bounced_emails

        # Get pending follow-up emails for this follow-up
        pending = db.query(FollowUpEmail).filter(
            and_(FollowUpEmail.followup_id == followup_id,
                 FollowUpEmail.status == "pending")
        ).all()

        # Filter out replied and bounced leads
        eligible = [p for p in pending if p.recipient_email.lower() not in excluded]

        # Assign follow-up variations positionally across eligible leads
        total_eligible = len(eligible)
        num_fu_vars = len(variations)

        sent_count = 0
        for pos, fu_email in enumerate(eligible[:budget]):
            v_idx = assign_variation(pos, total_eligible, num_fu_vars)
            fu_var = variations[v_idx]

            # Get original email for threading
            orig = db.query(Email).filter(
                Email.id == fu_email.original_email_id
            ).first()
            if not orig or not orig.message_id:
                fu_email.status = "failed"
                continue

            rendered_body = render(fu_var.body, orig.lead)
            subject = f"Re: {orig.subject}"

            success = service.send_followup(
                to_email=fu_email.recipient_email,
                subject=subject,
                body=rendered_body,
                original_message_id=orig.message_id
            )

            fu_email.followup_variation_index = v_idx
            fu_email.subject = subject
            fu_email.body = rendered_body
            fu_email.status = "sent" if success else "failed"
            fu_email.sent_at = datetime.utcnow() if success else None

            if success:
                sent_count += 1
            await asyncio.sleep(1)

        db.commit()

        # Check if all done
        still_pending = db.query(FollowUpEmail).filter(
            and_(FollowUpEmail.followup_id == followup_id,
                 FollowUpEmail.status == "pending")
        ).count()

        fu.sent_count = (fu.sent_count or 0) + sent_count
        if still_pending == 0:
            fu.status = "completed"
            fu.completed_at = datetime.utcnow()
        else:
            fu.status = "scheduled"   # still has pending — will retry next check
        db.commit()

        add_to_limits(db, inbox_id, sent_count)

    except Exception as e:
        print(f"send_followup_async error: {e}")
        db.rollback()
    finally:
        db.close()

# ============================================================================
# API ENDPOINTS
# ============================================================================

@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

# ── Inboxes ───────────────────────────────────────────────────────────────────

@app.get("/api/inboxes")
async def get_inboxes(db: Session = Depends(get_db)):
    return [InboxConfigResponse.from_orm(i) for i in db.query(InboxConfig).all()]

@app.post("/api/inboxes")
async def add_inbox(data: InboxConfigRequest, db: Session = Depends(get_db)):
    svc = EmailService(data.email_address, data.app_password)
    try:
        with smtplib.SMTP(svc.smtp_server, svc.smtp_port) as s:
            s.starttls()
            s.login(data.email_address, data.app_password)
    except Exception as e:
        raise HTTPException(400, f"Invalid Gmail credentials: {e}")
    if db.query(InboxConfig).filter(InboxConfig.email_address == data.email_address).first():
        raise HTTPException(400, "Inbox already configured")
    inbox = InboxConfig(inbox_name=data.inbox_name,
                        email_address=data.email_address,
                        app_password=data.app_password)
    db.add(inbox)
    db.commit()
    db.refresh(inbox)
    return InboxConfigResponse.from_orm(inbox)

# ── Campaigns ─────────────────────────────────────────────────────────────────

@app.post("/api/campaigns")
async def create_campaign(data: CampaignRequest, db: Session = Depends(get_db)):
    if not db.query(InboxConfig).filter(InboxConfig.id == data.inbox_id).first():
        raise HTTPException(404, "Inbox not found")
    if not data.templates:
        raise HTTPException(400, "At least one template required")

    # Serialize templates to JSON
    tpl_json = []
    for t in data.templates:
        tpl_json.append({
            "variations": [{"subject": v.subject, "body": v.body} for v in t.variations],
            "followups": [
                {
                    "send_after_days": f.send_after_days,
                    "variations": [{"body": fv.body} for fv in f.variations],
                }
                for f in (t.followups or [])
            ],
        })

    campaign = Campaign(
        campaign_name=data.campaign_name,
        inbox_id=data.inbox_id,
        email_subject=data.templates[0].variations[0].subject,
        email_body=data.templates[0].variations[0].body,
        email_templates=tpl_json,
        total_leads=len(data.leads),
        status="draft",
    )
    db.add(campaign)
    db.flush()

    for ld in data.leads:
        db.add(Lead(
            campaign_id=campaign.id,
            first_name=ld.first_name, last_name=ld.last_name,
            company=ld.company, email=ld.email,
            job_title=ld.job_title,
            custom_field_1=ld.custom_field_1,
            custom_field_2=ld.custom_field_2,
            custom_field_3=ld.custom_field_3,
        ))

    # Create FollowUp + FollowUpVariation records — single template, no t_idx needed
    single_tpl = data.templates[0] if data.templates else None
    for fu_in in (single_tpl.followups if single_tpl else []):
        fu = FollowUp(
            campaign_id=campaign.id,
            target_template_index=0,
            send_after_days=fu_in.send_after_days,
            status="waiting",
        )
        db.add(fu)
        db.flush()
        for vi, fv in enumerate(fu_in.variations):
            db.add(FollowUpVariation(
                followup_id=fu.id,
                variation_index=vi,
                body=fv.body,
            ))

    db.commit()
    db.refresh(campaign)
    return CampaignResponse.from_orm(campaign)

@app.get("/api/campaigns")
async def list_campaigns(db: Session = Depends(get_db)):
    return [CampaignResponse.from_orm(c) for c in db.query(Campaign).all()]

@app.get("/api/campaigns/{campaign_id}")
async def get_campaign(campaign_id: int, db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(404, "Campaign not found")

    emails = db.query(Email).filter(Email.campaign_id == campaign_id).all()
    followups = db.query(FollowUp).filter(FollowUp.campaign_id == campaign_id).all()

    fu_data = []
    for fu in followups:
        fu_emails = db.query(FollowUpEmail).filter(FollowUpEmail.followup_id == fu.id).all()
        fu_data.append({
            "id": fu.id,
            "target_template_index": fu.target_template_index,
            "send_after_days": fu.send_after_days,
            "scheduled_send_at": fu.scheduled_send_at.isoformat() if fu.scheduled_send_at else None,
            "status": fu.status,
            "sent_count": fu.sent_count,
            "variations": [{"variation_index": v.variation_index, "body": v.body}
                           for v in fu.variations],
            "emails": [{"id": e.id, "recipient_email": e.recipient_email,
                        "status": e.status, "sent_at": e.sent_at.isoformat() if e.sent_at else None,
                        "followup_variation_index": e.followup_variation_index}
                       for e in fu_emails],
        })

    return {
        **CampaignResponse.from_orm(campaign).dict(),
        "email_templates": campaign.email_templates or [],
        "emails": [EmailDetailResponse.from_orm(e).dict() for e in emails],
        "followups": fu_data,
    }

@app.post("/api/campaigns/{campaign_id}/send")
async def send_campaign(campaign_id: int, background_tasks: BackgroundTasks,
                        db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(404, "Campaign not found")
    if campaign.status != "draft":
        raise HTTPException(400, "Campaign already sent or sending")

    inbox = db.query(InboxConfig).filter(InboxConfig.id == campaign.inbox_id).first()
    if not inbox:
        raise HTTPException(404, "Inbox not found")

    rem = daily_remaining(db, inbox.id)
    if rem == 0:
        raise HTTPException(429, "Daily limit reached")

    leads_count = db.query(func.count(Lead.id)).filter(Lead.campaign_id == campaign_id).scalar()
    to_send = min(leads_count, rem)

    # Pre-create FollowUpEmail records (pending) so we know who gets follow-ups
    # These are created now so the budget check on page load can count them
    followups = db.query(FollowUp).filter(FollowUp.campaign_id == campaign_id).all()
    # We don't know Email IDs yet (not sent) — link after sending in background task

    background_tasks.add_task(
        send_campaign_async,
        campaign_id=campaign_id,
        inbox_id=inbox.id,
        email_address=inbox.email_address,
        app_password=inbox.app_password,
        emails_to_send=to_send,
    )

    campaign.status = "sending"
    campaign.started_at = datetime.utcnow()
    db.commit()

    return {"status": "sending", "emails_scheduled": to_send,
            "message": f"Sending {to_send} emails. Follow-ups will be scheduled after completion."}

# ── Check due follow-ups (called on every page load) ─────────────────────────


@app.get("/api/campaigns/{campaign_id}/followups/{followup_id}/emails")
async def get_followup_emails(campaign_id: int, followup_id: int,
                               db: Session = Depends(get_db)):
    fu = db.query(FollowUp).filter(
        and_(FollowUp.id == followup_id, FollowUp.campaign_id == campaign_id)
    ).first()
    if not fu:
        raise HTTPException(404, "Follow-up not found")
    items = db.query(FollowUpEmail).filter(FollowUpEmail.followup_id == followup_id).all()
    return [{"id": e.id, "recipient_email": e.recipient_email,
             "followup_variation_index": e.followup_variation_index,
             "status": e.status,
             "sent_at": e.sent_at.isoformat() if e.sent_at else None}
            for e in items]

# ============================================================================
# REPLY + BOUNCE DETECTION (Option B — targeted IMAP search)
# ============================================================================

def sync_replies_and_bounces(inbox: InboxConfig, campaign_id: int, db: Session) -> dict:
    """
    Connects to Gmail via IMAP and:
    1. Searches for replies FROM known lead emails (subject contains Re:)
    2. Searches for hard/soft bounce NDRs FROM mailer-daemon or postmaster
    Records results into Reply and Email tables.
    Returns summary dict.
    """
    stats = {"replies": 0, "hard_bounces": 0, "soft_bounces": 0, "errors": []}

    # Get all sent email addresses for this campaign
    sent_emails = db.query(Email).filter(
        and_(Email.campaign_id == campaign_id, Email.status == "sent")
    ).all()

    if not sent_emails:
        return stats

    # Map recipient_email -> Email record for fast lookup
    email_map = {e.recipient_email.lower(): e for e in sent_emails}
    # Map original subject -> Email record for bounce matching
    subject_map = {e.subject.lower(): e for e in sent_emails}

    # Already recorded reply addresses to avoid duplicates
    already_replied = {
        r.from_email.lower()
        for r in db.query(Reply).join(Email).filter(
            Email.campaign_id == campaign_id
        ).all()
    }
    # Already bounced email IDs
    already_bounced = {
        e.id for e in sent_emails if e.is_bounced
    }

    try:
        with imaplib.IMAP4_SSL("imap.gmail.com") as mail:
            mail.login(inbox.email_address, inbox.app_password)

            # ── 1. Check INBOX for replies from leads ────────────────────────
            mail.select("INBOX")

            for lead_email in email_map.keys():
                if lead_email in already_replied:
                    continue
                try:
                    # Search for emails FROM this specific lead address
                    _, data = mail.search(None, f'FROM "{lead_email}"')
                    msg_ids = data[0].split()
                    if not msg_ids:
                        continue

                    for msg_id in msg_ids[-5:]:   # check last 5 from this sender
                        try:
                            _, msg_data = mail.fetch(msg_id, "(RFC822)")
                            msg = email_lib.message_from_bytes(msg_data[0][1])
                            subject = msg.get("Subject", "")
                            from_addr = email_lib.utils.parseaddr(msg.get("From", ""))[1].lower()

                            # Must be a Re: reply and from a known lead
                            if not subject.lower().startswith("re:"):
                                continue
                            if from_addr not in email_map:
                                continue

                            orig_email = email_map[from_addr]
                            if orig_email.id in already_bounced:
                                continue

                            # Get body
                            body = ""
                            if msg.is_multipart():
                                for part in msg.walk():
                                    if part.get_content_type() == "text/plain":
                                        try:
                                            body = part.get_payload(decode=True).decode("utf-8", errors="replace")
                                        except Exception:
                                            body = ""
                                        break
                            else:
                                try:
                                    body = msg.get_payload(decode=True).decode("utf-8", errors="replace") if msg.get_payload(decode=True) else ""
                                except Exception:
                                    body = ""

                            db.add(Reply(
                                email_id=orig_email.id,
                                from_email=from_addr,
                                reply_subject=subject,
                                reply_body=body[:1000],
                                reply_timestamp=datetime.utcnow(),
                                is_from_recipient=True,
                            ))
                            already_replied.add(from_addr)
                            stats["replies"] += 1

                        except Exception as e:
                            stats["errors"].append(f"reply parse error: {str(e)[:80]}")
                            continue

                except Exception as e:
                    stats["errors"].append(f"reply search error for {lead_email}: {str(e)[:80]}")
                    continue

            # ── 2. Check for bounce NDRs (mailer-daemon / postmaster) ────────
            # Search FROM mailer-daemon
            for bounce_sender in ['"mailer-daemon"', '"postmaster"']:
                try:
                    _, data = mail.search(None, f"FROM {bounce_sender}")
                    msg_ids = data[0].split()
                    if not msg_ids:
                        continue

                    for msg_id in msg_ids[-20:]:   # last 20 NDR emails
                        try:
                            _, msg_data = mail.fetch(msg_id, "(RFC822)")
                            msg = email_lib.message_from_bytes(msg_data[0][1])
                            subject = msg.get("Subject", "").lower()

                            # Get full body to find the bounced address
                            full_text = ""
                            if msg.is_multipart():
                                for part in msg.walk():
                                    ct = part.get_content_type()
                                    if ct in ("text/plain", "message/delivery-status"):
                                        try:
                                            chunk = part.get_payload(decode=True)
                                            if chunk:
                                                full_text += chunk.decode("utf-8", errors="replace")
                                        except Exception:
                                            pass
                            else:
                                try:
                                    chunk = msg.get_payload(decode=True)
                                    full_text = chunk.decode("utf-8", errors="replace") if chunk else ""
                                except Exception:
                                    pass

                            # Determine bounce type from subject / status codes
                            # Hard bounce: 5xx codes, "does not exist", "invalid", "no such user"
                            # Soft bounce: 4xx codes, "mailbox full", "temporarily"
                            hard_keywords = [
                                "550", "551", "552", "553", "554",
                                "does not exist", "no such user", "invalid address",
                                "user unknown", "address rejected", "mailbox not found",
                                "delivery failed", "undeliverable"
                            ]
                            soft_keywords = [
                                "421", "450", "451", "452",
                                "mailbox full", "over quota", "temporarily",
                                "try again later", "service unavailable"
                            ]

                            combined = (subject + " " + full_text).lower()
                            is_hard = any(kw in combined for kw in hard_keywords)
                            is_soft = any(kw in combined for kw in soft_keywords)

                            if not is_hard and not is_soft:
                                continue

                            bounce_type_str = "hard" if is_hard else "soft"

                            # Try to find which lead email bounced
                            # Look for any of our lead emails mentioned in the NDR body
                            matched_email = None
                            for lead_addr in email_map.keys():
                                if lead_addr in full_text.lower() or lead_addr in subject:
                                    matched_email = email_map[lead_addr]
                                    break

                            if not matched_email:
                                continue
                            if matched_email.id in already_bounced:
                                continue

                            matched_email.is_bounced = True
                            matched_email.bounce_type = bounce_type_str
                            matched_email.bounced_at = datetime.utcnow()
                            already_bounced.add(matched_email.id)

                            if is_hard:
                                stats["hard_bounces"] += 1
                            else:
                                stats["soft_bounces"] += 1

                        except Exception as e:
                            stats["errors"].append(f"bounce parse error: {str(e)[:80]}")
                            continue

                except Exception as e:
                    stats["errors"].append(f"bounce search error: {str(e)[:80]}")
                    continue

            db.commit()

    except Exception as e:
        stats["errors"].append(f"IMAP connection error: {str(e)[:120]}")

    return stats


# ── Manual trigger endpoint ───────────────────────────────────────────────────

@app.post("/api/campaigns/{campaign_id}/check-replies")
async def check_replies_endpoint(campaign_id: int, db: Session = Depends(get_db)):
    """Manually trigger reply + bounce sync for a campaign."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(404, "Campaign not found")
    inbox = db.query(InboxConfig).filter(InboxConfig.id == campaign.inbox_id).first()
    if not inbox:
        raise HTTPException(404, "Inbox not found")

    stats = sync_replies_and_bounces(inbox, campaign_id, db)
    return {"status": "ok", **stats}


# ── Auto-check on follow-up due ───────────────────────────────────────────────

@app.post("/api/followups/check-due")
async def check_due_followups(background_tasks: BackgroundTasks,
                               db: Session = Depends(get_db)):
    """
    Called on every app page load.
    1. For each campaign that has scheduled follow-ups: sync replies + bounces first.
    2. Find all due follow-ups and fire them within daily budget.
       Priority: original pending emails first, then follow-ups split equally.
    """
    now = datetime.utcnow()

    # Find all due scheduled follow-ups
    due = db.query(FollowUp).filter(
        and_(
            FollowUp.status == "scheduled",
            FollowUp.scheduled_send_at <= now,
        )
    ).all()

    # Also include follow-ups still in "scheduled" state with pending emails
    # (partially sent from a previous run due to daily limit)
    partial = db.query(FollowUp).filter(
        FollowUp.status == "scheduled"
    ).join(FollowUpEmail).filter(
        FollowUpEmail.status == "pending"
    ).all()

    all_due = {fu.id: fu for fu in due + partial}

    if not all_due:
        return {"checked": True, "due_count": 0, "message": "No follow-ups due"}

    # ── Step 1: sync replies + bounces for all affected campaigns ─────────────
    affected_campaign_ids = {fu.campaign_id for fu in all_due.values()}
    sync_summary = {}
    for cid in affected_campaign_ids:
        campaign = db.query(Campaign).filter(Campaign.id == cid).first()
        if not campaign:
            continue
        inbox = db.query(InboxConfig).filter(InboxConfig.id == campaign.inbox_id).first()
        if not inbox:
            continue
        stats = sync_replies_and_bounces(inbox, cid, db)
        sync_summary[cid] = stats

    # ── Step 2: build exclusion sets (replied + bounced) per campaign ─────────
    def get_excluded(campaign_id: int) -> set:
        replied = {
            r.from_email.lower()
            for r in db.query(Reply).join(Email).filter(
                Email.campaign_id == campaign_id
            ).all()
        }
        bounced = {
            e.recipient_email.lower()
            for e in db.query(Email).filter(
                and_(Email.campaign_id == campaign_id, Email.is_bounced == True)
            ).all()
        }
        return replied | bounced

    # ── Step 3: fire follow-ups within budget ─────────────────────────────────
    results = []
    processed_inboxes = set()   # track budget per inbox across multiple follow-ups

    for fu in all_due.values():
        campaign = db.query(Campaign).filter(Campaign.id == fu.campaign_id).first()
        if not campaign:
            continue
        inbox = db.query(InboxConfig).filter(InboxConfig.id == campaign.inbox_id).first()
        if not inbox:
            continue

        rem = daily_remaining(db, inbox.id)
        if rem == 0:
            results.append({"followup_id": fu.id, "status": "skipped",
                            "reason": "daily limit reached"})
            continue

        # Priority: pending original emails consume budget first
        pending_originals = db.query(func.count(Email.id)).join(Campaign).filter(
            and_(Campaign.inbox_id == inbox.id, Email.status == "pending")
        ).scalar() or 0
        followup_budget = max(0, rem - min(pending_originals, rem))

        if followup_budget == 0:
            results.append({"followup_id": fu.id, "status": "skipped",
                            "reason": "budget consumed by pending originals"})
            continue

        # Split budget equally among all due follow-ups for this inbox
        due_for_inbox = [
            f for f in all_due.values()
            if db.query(Campaign).filter(Campaign.id == f.campaign_id).first() and
               db.query(Campaign).filter(Campaign.id == f.campaign_id).first().inbox_id == inbox.id
        ]
        per_fu_budget = max(1, followup_budget // len(due_for_inbox))

        # Build / update FollowUpEmail pending records excluding replied+bounced
        excluded = get_excluded(fu.campaign_id)

        existing_ids = {
            fe.original_email_id
            for fe in db.query(FollowUpEmail).filter(
                FollowUpEmail.followup_id == fu.id
            ).all()
        }

        if not existing_ids:
            # First time — create pending records
            q = db.query(Email).filter(
                and_(Email.campaign_id == fu.campaign_id, Email.status == "sent")
            )
            if fu.target_template_index is not None:
                q = q.filter(Email.template_index == fu.target_template_index)
            target_emails = q.all()

            created = 0
            for orig in target_emails:
                if orig.recipient_email.lower() in excluded:
                    continue
                db.add(FollowUpEmail(
                    followup_id=fu.id,
                    original_email_id=orig.id,
                    recipient_email=orig.recipient_email,
                    subject=f"Re: {orig.subject}",
                    body="",
                    status="pending",
                ))
                created += 1
            db.commit()

            if created == 0:
                fu.status = "completed"
                fu.completed_at = datetime.utcnow()
                db.commit()
                results.append({"followup_id": fu.id, "status": "skipped",
                                "reason": "all leads replied or bounced"})
                continue
        else:
            # Already created — mark replied/bounced ones as skipped
            pending_fes = db.query(FollowUpEmail).filter(
                and_(
                    FollowUpEmail.followup_id == fu.id,
                    FollowUpEmail.status == "pending"
                )
            ).all()
            for fe in pending_fes:
                if fe.recipient_email.lower() in excluded:
                    fe.status = "skipped"
            db.commit()

        fu.status = "sending"
        db.commit()

        background_tasks.add_task(
            send_followup_async,
            followup_id=fu.id,
            inbox_id=inbox.id,
            email_address=inbox.email_address,
            app_password=inbox.app_password,
            budget=per_fu_budget,
        )

        results.append({
            "followup_id": fu.id,
            "budget": per_fu_budget,
            "status": "queued",
            "sync": sync_summary.get(fu.campaign_id, {}),
        })

    return {"checked": True, "due_count": len(all_due), "results": results}

# ── Tracking ──────────────────────────────────────────────────────────────────

@app.get("/api/track/open/{tracking_id}")
async def track_open(tracking_id: str, request: Request,
                     db: Session = Depends(get_db)):
    try:
        rec = db.query(Email).filter(Email.tracking_id == tracking_id).first()
        if rec:
            if not rec.is_opened:
                rec.is_opened = True
                rec.opened_at = datetime.utcnow()
                rec.campaign.opened_count += 1
            rec.open_count += 1
            db.add(OpenTracking(
                email_id=rec.id,
                user_agent=request.headers.get("user-agent", ""),
                ip_address=request.client.host if request.client else "",
            ))
            db.commit()
        return JSONResponse({"status": "tracked"})
    except Exception as e:
        print(f"track_open error: {e}")
        return JSONResponse({"status": "error"})

# ── Analytics ─────────────────────────────────────────────────────────────────

@app.get("/api/analytics")
async def get_analytics(db: Session = Depends(get_db)):
    total_campaigns = db.query(func.count(Campaign.id)).scalar() or 0
    total_sent = db.query(func.count(Email.id)).filter(Email.status == "sent").scalar() or 0
    total_opens = db.query(func.count(Email.id)).filter(Email.is_opened == True).scalar() or 0
    total_replies = db.query(func.count(Reply.id)).scalar() or 0
    open_rate = round(total_opens / total_sent * 100, 2) if total_sent else 0
    reply_rate = round(total_replies / total_sent * 100, 2) if total_sent else 0

    today = date.today()
    daily_rec = db.query(DailyLimit).filter(DailyLimit.date == today).first()
    daily_used = daily_rec.emails_sent if daily_rec else 0
    ws = today - timedelta(days=today.weekday())
    weekly_rec = db.query(WeeklyLimit).filter(WeeklyLimit.week_start == ws).first()
    weekly_used = weekly_rec.emails_sent if weekly_rec else 0
    seven_ago = today - timedelta(days=7)
    last7 = db.query(func.count(Email.id)).filter(
        and_(Email.status == "sent",
             Email.sent_at >= datetime.combine(seven_ago, datetime.min.time()))
    ).scalar() or 0

    return AnalyticsResponse(
        total_campaigns=total_campaigns, total_emails_sent=total_sent,
        total_opens=total_opens, total_replies=total_replies,
        open_rate=open_rate, reply_rate=reply_rate,
        daily_limit_used=daily_used,
        daily_limit_remaining=max(0, DAILY_LIMIT - daily_used),
        weekly_limit_used=weekly_used,
        weekly_limit_remaining=max(0, WEEKLY_LIMIT - weekly_used),
        last_7_days_sent=last7,
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)