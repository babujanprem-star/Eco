from flask import Flask, abort, jsonify, make_response, render_template, request, redirect, url_for, flash
from email.message import EmailMessage
from datetime import datetime
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import urlopen
import json
import math
import os
import secrets
import smtplib
import sqlite3
import ssl

app = Flask(__name__)
if os.environ.get("ENVIRONMENT") == "production" and not os.environ.get("SECRET_KEY"):
    raise RuntimeError("SECRET_KEY must be configured in production.")
app.secret_key = os.environ.get("SECRET_KEY") or secrets.token_hex(32)
DATABASE_PATH = os.environ.get(
    "DATABASE_PATH",
    os.path.join(app.root_path, "database.db"),
)

def init_sqlite_db():
    conn = sqlite3.connect(DATABASE_PATH)
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS contacts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                message TEXT NOT NULL,
                submitted_at TEXT NOT NULL
            )
        """)
        conn.commit()
    finally:
        conn.close()

init_sqlite_db()

def send_contact_notification(name, sender_email, message, submitted_at):
    smtp_host = os.environ.get("SMTP_HOST")
    recipient = os.environ.get("CONTACT_EMAIL")
    smtp_username = os.environ.get("SMTP_USERNAME")
    smtp_password = os.environ.get("SMTP_PASSWORD")
    sender_address = os.environ.get("SMTP_FROM") or smtp_username

    if not smtp_host or not recipient or not sender_address:
        app.logger.warning("Contact email notification is not configured.")
        return "not_configured"

    if bool(smtp_username) != bool(smtp_password):
        app.logger.warning("SMTP username and password must both be configured.")
        return "not_configured"

    try:
        email_message = EmailMessage()
        email_message["Subject"] = "New EcoAtmo contact message"
        email_message["From"] = sender_address
        email_message["To"] = recipient
        email_message.set_content(
            f"A new message was sent through the EcoAtmo contact form.\n\n"
            f"Name: {name}\n"
            f"Email: {sender_email}\n"
            f"Submitted: {submitted_at}\n\n"
            f"Message:\n{message}\n"
        )

        smtp_port = int(os.environ.get("SMTP_PORT", "587"))
        use_ssl = os.environ.get("SMTP_USE_SSL", "false").lower() in {"1", "true", "yes"}
        use_starttls = os.environ.get("SMTP_STARTTLS", "true").lower() in {"1", "true", "yes"}
        if use_ssl:
            smtp = smtplib.SMTP_SSL(
                smtp_host,
                smtp_port,
                timeout=10,
                context=ssl.create_default_context(),
            )
        else:
            smtp = smtplib.SMTP(smtp_host, smtp_port, timeout=10)

        with smtp:
            smtp.ehlo()
            if use_starttls and not use_ssl:
                smtp.starttls(context=ssl.create_default_context())
                smtp.ehlo()
            if smtp_username and smtp_password:
                smtp.login(smtp_username, smtp_password)
            smtp.send_message(email_message)
        return "sent"
    except (OSError, ValueError, smtplib.SMTPException):
        app.logger.exception("Contact email notification delivery failed.")
        return "failed"

@app.route('/')
def home():
    return render_template('index.html', active_page='home')

@app.route('/air-quality')
def air_quality():
    return render_template('air_quality.html', active_page='air_quality')

@app.route('/api/air-quality')
def estimated_air_quality():
    try:
        latitude = float(request.args.get("latitude", ""))
        longitude = float(request.args.get("longitude", ""))
    except ValueError:
        return jsonify(error="A valid latitude and longitude are required."), 400

    if (
        not math.isfinite(latitude)
        or not math.isfinite(longitude)
        or not -90 <= latitude <= 90
        or not -180 <= longitude <= 180
    ):
        return jsonify(error="Latitude or longitude is out of range."), 400

    try:
        parameters = urlencode({
            "latitude": latitude,
            "longitude": longitude,
            "current": "us_aqi,pm2_5,pm10",
            "timezone": "auto",
        })
        with urlopen(
            f"https://air-quality-api.open-meteo.com/v1/air-quality?{parameters}",
            timeout=12,
        ) as response:
            payload = json.load(response)
        current = payload.get("current") if isinstance(payload, dict) else None
        if not isinstance(current, dict):
            raise ValueError("Open-Meteo did not return current air-quality estimates.")
        aqi = current.get("us_aqi")
        if not isinstance(aqi, (int, float)) or not math.isfinite(aqi):
            raise ValueError("Open-Meteo did not return a usable AQI estimate.")
        return jsonify({
            "aqi": aqi,
            "measurements": {
                "pm25": current.get("pm2_5"),
                "pm10": current.get("pm10"),
            },
            "measured_at": current.get("time"),
        })
    except HTTPError as error:
        app.logger.error("Open-Meteo request failed with HTTP status %s.", error.code)
        return jsonify(error="The air-quality estimate service is temporarily unavailable."), 502
    except (OSError, ValueError):
        app.logger.exception("Could not retrieve an Open-Meteo air-quality estimate.")
        return jsonify(error="Could not retrieve an air-quality estimate. Please try again."), 502

@app.route('/countries')
def countries():
    return render_template('countries.html', active_page='countries')

@app.route('/about')
def about():
    return render_template('about.html', active_page='about')

@app.route('/services')
def services():
    return render_template('services.html', active_page='services')

@app.route('/contact', methods=['GET', 'POST'])
def contact():
    if request.method == 'POST':
        name = (request.form.get('name') or '').strip()
        email = (request.form.get('email') or '').strip()
        message = (request.form.get('message') or '').strip()

        if not name or not email or not message:
            flash("Please complete all fields before sending your message.", "danger")
            return redirect(url_for('contact'))

        submitted_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        try:
            conn = sqlite3.connect(DATABASE_PATH)
            try:
                conn.execute(
                    "INSERT INTO contacts (name, email, message, submitted_at) VALUES (?, ?, ?, ?)",
                    (name, email, message, submitted_at)
                )
                conn.commit()
            finally:
                conn.close()
        except sqlite3.Error:
            flash("An error occurred. Please try again later.", "danger")
            return redirect(url_for('contact'))

        delivery_status = send_contact_notification(name, email, message, submitted_at)
        if delivery_status == "sent":
            flash("Your message was sent and emailed to the EcoAtmo team. Thank you for contacting us.", "success")
        elif delivery_status == "not_configured":
            flash("Your message was saved, but email delivery is not configured on this server yet.", "warning")
        else:
            flash("Your message was saved, but the EcoAtmo team could not be notified by email.", "warning")

        return redirect(url_for('contact'))

    return render_template('contact.html', active_page='contact')

@app.route('/admin/messages')
def admin_messages():
    admin_username = os.environ.get("ADMIN_USERNAME")
    admin_password = os.environ.get("ADMIN_PASSWORD")
    if not admin_username or not admin_password:
        abort(503, description="The contact inbox is disabled until admin credentials are configured.")

    credentials = request.authorization
    username = (credentials.username or "") if credentials else ""
    password = (credentials.password or "") if credentials else ""
    valid_username = secrets.compare_digest(username, admin_username)
    valid_password = secrets.compare_digest(password, admin_password)
    if not valid_username or not valid_password:
        response = make_response("Authentication required", 401)
        response.headers["WWW-Authenticate"] = 'Basic realm="EcoAtmo contact inbox"'
        return response

    try:
        page = max(int(request.args.get("page", "1")), 1)
    except ValueError:
        page = 1

    page_size = 50
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    try:
        total_messages = conn.execute("SELECT COUNT(*) FROM contacts").fetchone()[0]
        page_count = max((total_messages + page_size - 1) // page_size, 1)
        page = min(page, page_count)
        messages = conn.execute(
            "SELECT id, name, email, message, submitted_at "
            "FROM contacts ORDER BY id DESC LIMIT ? OFFSET ?",
            (page_size, (page - 1) * page_size)
        ).fetchall()
    except sqlite3.Error:
        app.logger.exception("Could not load the contact inbox.")
        abort(500)
    finally:
        conn.close()

    return render_template(
        'admin_messages.html',
        messages=messages,
        page=page,
        page_count=page_count,
        total_messages=total_messages
    )

if __name__ == '__main__':
    debug = os.environ.get("FLASK_DEBUG", "false").lower() in {"1", "true", "yes"}
    app.run(debug=debug, use_reloader=False)
