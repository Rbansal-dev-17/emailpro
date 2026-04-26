"""
SQLAlchemy Models for Email Sending Platform
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Date, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()


class InboxConfig(Base):
    __tablename__ = "inbox_configs"

    id = Column(Integer, primary_key=True, index=True)
    inbox_name = Column(String(255), nullable=False)
    email_address = Column(String(255), unique=True, nullable=False)
    app_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    campaigns = relationship("Campaign", back_populates="inbox")


class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(Integer, primary_key=True, index=True)
    campaign_name = Column(String(255), nullable=False)
    inbox_id = Column(Integer, ForeignKey("inbox_configs.id"), nullable=False)

    # Legacy single-template columns kept for DB compatibility
    email_subject = Column(String(255), nullable=True)
    email_body = Column(Text, nullable=True)

    # Multi-template+variation JSON structure:
    # [
    #   {
    #     "variations": [{"subject": "...", "body": "..."}, ...],
    #     "followups": [
    #       {
    #         "send_after_days": 3,
    #         "variations": [{"body": "..."}, ...]
    #       }
    #     ]
    #   }
    # ]
    email_templates = Column(JSON, nullable=True)

    total_leads = Column(Integer, default=0)
    sent_count = Column(Integer, default=0)
    opened_count = Column(Integer, default=0)
    replied_count = Column(Integer, default=0)
    status = Column(String(50), default="draft")
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    inbox = relationship("InboxConfig", back_populates="campaigns")
    leads = relationship("Lead", back_populates="campaign", cascade="all, delete-orphan")
    emails = relationship("Email", back_populates="campaign", cascade="all, delete-orphan")
    followups = relationship("FollowUp", back_populates="campaign", cascade="all, delete-orphan")


class Lead(Base):
    __tablename__ = "leads"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=False)
    first_name = Column(String(255), nullable=False)
    last_name = Column(String(255), nullable=False)
    company = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    job_title = Column(String(255), nullable=True)
    custom_field_1 = Column(String(255), nullable=True)
    custom_field_2 = Column(String(255), nullable=True)
    custom_field_3 = Column(String(255), nullable=True)
    is_valid = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    campaign = relationship("Campaign", back_populates="leads")
    email_record = relationship("Email", back_populates="lead", uselist=False, cascade="all, delete-orphan")


class Email(Base):
    __tablename__ = "emails"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=False)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=False)
    recipient_email = Column(String(255), nullable=False)
    subject = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    tracking_id = Column(String(255), unique=True, nullable=False)

    # Thread + variation tracking
    message_id = Column(String(512), nullable=True)
    template_index = Column(Integer, nullable=True, default=0)
    variation_index = Column(Integer, nullable=True, default=0)

    sent_at = Column(DateTime, nullable=True)
    opened_at = Column(DateTime, nullable=True)
    is_opened = Column(Boolean, default=False)
    open_count = Column(Integer, default=0)
    status = Column(String(50), default="pending")
    # Bounce tracking
    is_bounced = Column(Boolean, default=False)
    bounce_type = Column(String(20), nullable=True)   # 'hard' | 'soft' | None
    bounced_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    campaign = relationship("Campaign", back_populates="emails")
    lead = relationship("Lead", back_populates="email_record")
    opens = relationship("OpenTracking", back_populates="email", cascade="all, delete-orphan")
    replies = relationship("Reply", back_populates="email", cascade="all, delete-orphan")
    followup_emails = relationship("FollowUpEmail", back_populates="original_email", cascade="all, delete-orphan")


class FollowUp(Base):
    """
    One follow-up sequence entry per (campaign, template_index, send_after_days).
    Variations stored in FollowUpVariation.
    target_template_index = None means all templates.
    """
    __tablename__ = "followups"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=False)

    # Which template this follow-up targets (None = all)
    target_template_index = Column(Integer, nullable=True)

    send_after_days = Column(Integer, nullable=False)
    # Set after campaign completes: campaign.completed_at + send_after_days
    scheduled_send_at = Column(DateTime, nullable=True)

    # status: waiting (campaign not sent yet) | scheduled | sending | completed | failed
    status = Column(String(50), default="waiting")
    sent_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    campaign = relationship("Campaign", back_populates="followups")
    variations = relationship("FollowUpVariation", back_populates="followup",
                              cascade="all, delete-orphan", order_by="FollowUpVariation.variation_index")
    followup_emails = relationship("FollowUpEmail", back_populates="followup", cascade="all, delete-orphan")


class FollowUpVariation(Base):
    """One variation of a follow-up (subject auto = Re: original, body editable)."""
    __tablename__ = "followup_variations"

    id = Column(Integer, primary_key=True, index=True)
    followup_id = Column(Integer, ForeignKey("followups.id"), nullable=False)
    variation_index = Column(Integer, nullable=False, default=0)
    # Subject is auto Re: <original> — stored for reference
    subject = Column(String(255), nullable=True)
    body = Column(Text, nullable=False)

    followup = relationship("FollowUp", back_populates="variations")


class FollowUpEmail(Base):
    """Individual follow-up email record — one per lead per follow-up."""
    __tablename__ = "followup_emails"

    id = Column(Integer, primary_key=True, index=True)
    followup_id = Column(Integer, ForeignKey("followups.id"), nullable=False)
    original_email_id = Column(Integer, ForeignKey("emails.id"), nullable=False)
    recipient_email = Column(String(255), nullable=False)
    followup_variation_index = Column(Integer, nullable=True, default=0)
    subject = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    # pending | sent | failed
    status = Column(String(50), default="pending")
    sent_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    followup = relationship("FollowUp", back_populates="followup_emails")
    original_email = relationship("Email", back_populates="followup_emails")


class OpenTracking(Base):
    __tablename__ = "open_tracking"

    id = Column(Integer, primary_key=True, index=True)
    email_id = Column(Integer, ForeignKey("emails.id"), nullable=False)
    opened_at = Column(DateTime, default=datetime.utcnow)
    user_agent = Column(String(500), nullable=True)
    ip_address = Column(String(45), nullable=True)

    email = relationship("Email", back_populates="opens")


class Reply(Base):
    __tablename__ = "replies"

    id = Column(Integer, primary_key=True, index=True)
    email_id = Column(Integer, ForeignKey("emails.id"), nullable=False)
    from_email = Column(String(255), nullable=False)
    reply_subject = Column(String(255), nullable=True)
    reply_body = Column(Text, nullable=True)
    reply_timestamp = Column(DateTime, nullable=False)
    is_from_recipient = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    email = relationship("Email", back_populates="replies")


class DailyLimit(Base):
    __tablename__ = "daily_limits"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, unique=True, nullable=False)
    emails_sent = Column(Integer, default=0)
    inbox_id = Column(Integer, ForeignKey("inbox_configs.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class WeeklyLimit(Base):
    __tablename__ = "weekly_limits"

    id = Column(Integer, primary_key=True, index=True)
    week_start = Column(Date, nullable=False)
    emails_sent = Column(Integer, default=0)
    inbox_id = Column(Integer, ForeignKey("inbox_configs.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)