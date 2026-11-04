# EcoAtmo Web Application

This is a complete implementation of the EcoAtmo website built with **Flask**, **SQLite**, and **HTML/CSS**.

## Quick Setup Instructions

1. **Install Flask**:
   ```bash
   pip install flask
   ```

2. **Run the Application**:
   ```bash
   python app.py
   ```

3. **Access in Browser**:
   Open [http://127.0.0.1:5000](http://127.0.0.1:5000)

## Deploying to Render

The repository includes a Render Blueprint in `../render.yaml`. Push the repository to GitHub, then in Render choose **New +** > **Blueprint** and connect that repository. The Blueprint runs Flask with Gunicorn, generates a production secret key, and mounts persistent storage for contact messages. A paid web-service plan is required for persistent disks and may incur charges.

After deployment, set `ADMIN_USERNAME` and `ADMIN_PASSWORD` in the Render service's environment settings to enable the protected contact inbox. Set the SMTP variables below if you want contact submissions emailed to you. Do not commit credentials.

## Air-Quality Estimates

The air-quality page uses model-based U.S. AQI, PM2.5, and PM10 estimates from the [Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api). No API key is required. Estimates may differ from measurements at local monitoring stations.

## Contact Email Notifications

Contact submissions are always saved to SQLite. To email each submission to the site inbox, configure SMTP environment variables before starting the app:

```powershell
$env:SMTP_HOST = "smtp.example.com"
$env:SMTP_PORT = "587"
$env:SMTP_USERNAME = "your-smtp-username"
$env:SMTP_PASSWORD = "your-provider-app-password"
$env:CONTACT_EMAIL = "inbox@example.com"
python app.py
```

SMTP uses STARTTLS by default. For an SSL-only SMTP service, set `SMTP_USE_SSL` to `true` and use the provider's SSL port (commonly `465`). `SMTP_FROM` can optionally override the sender address; by default the SMTP username is used. Use an app password or SMTP credential from your mail provider, and do not commit real credentials to the repository. Without these settings, messages remain saved in the database, but no email is sent.

## Viewing Contact Messages

The contact inbox is available at [http://127.0.0.1:5000/admin/messages](http://127.0.0.1:5000/admin/messages) and requires HTTP Basic authentication. Set admin credentials before starting Flask:

```powershell
$env:ADMIN_USERNAME = "your-admin-name"
$credential = Get-Credential -UserName $env:ADMIN_USERNAME -Message "Enter a new admin password"
$env:ADMIN_PASSWORD = $credential.GetNetworkCredential().Password
python app.py
```

Use the credential prompt to enter the password privately. The inbox displays the newest 50 submissions per page; older messages remain in SQLite. Do not expose this development server to the public internet. If deploying the inbox, use HTTPS and a production server.

## Project Structure
- `app.py`: Backend Flask routes and SQLite integration.
- `static/css/style.css`: Custom layout and styles matching the exact UI theme.
- `templates/`: HTML templates with template inheritance (`base.html`, `index.html`, `about.html`, `services.html`, `contact.html`).
