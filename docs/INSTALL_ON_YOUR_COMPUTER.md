# How to Install and Run the OPM Platform on Your Computer

This guide assumes **zero** prior technical experience.
Follow each step exactly, in order, and you will have a working application.

---

## What You're About to Do

```
  Step 1          Step 2            Step 3           Step 4
  Install a       Download the      Run a setup      Open the app
  free tool       project files     script (1 click) in your browser
  (Node.js)       from GitHub

  ┌─────────┐    ┌─────────────┐   ┌────────────┐   ┌──────────────┐
  │         │    │             │   │            │   │              │
  │  ⬇ 📦  │ ►  │  ⬇ 📁      │ ► │  ▶ ⚙️     │ ► │  🌐 Browser  │
  │         │    │             │   │            │   │              │
  │ nodejs  │    │ OPM project │   │ setup.sh   │   │ localhost    │
  │ .org    │    │ from GitHub │   │ or         │   │ :5173        │
  │         │    │             │   │ setup.bat  │   │              │
  └─────────┘    └─────────────┘   └────────────┘   └──────────────┘

  ~5 minutes      ~2 minutes        ~2 minutes       Done!
```

**Total time: about 10 minutes.**

---

## Step 1: Install Node.js

Node.js is a free tool that allows your computer to run web applications.
You only need to install it once.

### On Windows:
1. Open your web browser
2. Go to **https://nodejs.org**
3. Click the big green button that says **"LTS"** (this means "stable version")
4. A file will download (something like `node-v22.x.x-x64.msi`)
5. Double-click the downloaded file
6. Click **Next** through all the screens (keep the default settings)
7. Click **Install**, then **Finish**
8. **Restart your computer** (important!)

### On Mac:
1. Open your web browser
2. Go to **https://nodejs.org**
3. Click the big green button that says **"LTS"**
4. A file will download (something like `node-v22.x.x.pkg`)
5. Double-click the downloaded file
6. Click **Continue** through all the screens
7. Click **Install** (you may need to enter your Mac password)
8. Click **Close**

### How to verify it worked:
1. Open **Terminal** (Mac) or **Command Prompt** (Windows)
   - **Mac**: Press `Cmd + Space`, type `Terminal`, press Enter
   - **Windows**: Press the Windows key, type `cmd`, press Enter
2. Type: `node -v` and press Enter
3. You should see something like: `v22.11.0`
4. If you see a version number, Node.js is installed correctly!

---

## Step 2: Download the Project Files

### Method A: Download as ZIP (Easiest)
1. Go to your GitHub repository: **https://github.com/abitalibtidi/opm**
2. Click the green **"Code"** button
3. Click **"Download ZIP"**
4. Find the downloaded ZIP file (usually in your Downloads folder)
5. **Extract/Unzip** the file:
   - **Windows**: Right-click the ZIP → **Extract All** → **Extract**
   - **Mac**: Double-click the ZIP file
6. You should now have a folder called `OPM-main` (or similar)
7. Move this folder somewhere easy to find (e.g., your Desktop)

### Method B: Using Git (If you have Git installed)
1. Open **Terminal** (Mac) or **Command Prompt** (Windows)
2. Navigate to where you want the files:
   - Type: `cd Desktop` and press Enter
3. Type the following and press Enter:
   ```
   git clone https://github.com/abitalibtidi/opm.git
   ```
4. A folder called `opm` will appear on your Desktop

---

## Step 3: Run the Setup Script

### On Mac:
1. Open **Terminal** (Press `Cmd + Space`, type `Terminal`, press Enter)
2. Navigate to the project folder. Type:
   ```
   cd ~/Desktop/OPM-main
   ```
   (Replace `OPM-main` with whatever the folder is actually called.
   Tip: type `cd ` then drag the folder from Finder into Terminal.)
3. Run the setup:
   ```
   bash setup.sh
   ```
4. Wait 1-2 minutes while it installs everything
5. You should see: **"SETUP COMPLETE!"**

### On Windows:
1. Open File Explorer and navigate to the project folder
2. Find the file called **`setup.bat`**
3. **Double-click** `setup.bat`
4. A black window will open and show progress
5. Wait 1-2 minutes
6. You should see: **"SETUP COMPLETE!"**
7. Press any key to close the window

### If the setup shows an error:
- **"Node.js is NOT installed"** → Go back to Step 1
- **"version 18 or higher is required"** → Download a newer Node.js from https://nodejs.org
- **Other errors** → Close everything, restart your computer, and try Step 3 again

---

## Step 4: Start the Application

### On Mac:
1. In Terminal (still in the project folder), type:
   ```
   bash start.sh
   ```
2. Wait about 5 seconds
3. Your browser should open automatically to the app
4. If it doesn't, manually open your browser and go to:
   **http://localhost:5173**

### On Windows:
1. In the project folder, find **`start.bat`**
2. **Double-click** `start.bat`
3. A black window will open (keep it open — this IS the running server)
4. Your browser should open automatically in about 5 seconds
5. If it doesn't, manually open your browser and go to:
   **http://localhost:5173**

---

## Step 5: Log In

You should now see the OPM login screen in your browser.

Use one of these demo accounts:

| Role | Email | Password |
|------|-------|----------|
| **Admin** (full access) | `admin@opm.local` | `admin123!` |
| **Analyst** (create valuations) | `analyst@opm.local` | `analyst123!` |
| **Reviewer** (view all, audit) | `reviewer@opm.local` | `reviewer123!` |

**Recommended**: Log in as **analyst@opm.local** first to try creating a valuation.

---

## How to Use the App Day-to-Day

### Starting the app (each time you want to use it):
- **Mac**: Open Terminal → `cd` to the project folder → `bash start.sh`
- **Windows**: Double-click `start.bat` in the project folder

### Stopping the app:
- **Mac**: In the Terminal window, press `Ctrl + C`
- **Windows**: Close the black command window

### The app is only accessible while the server is running.
When you close Terminal or the black window, the app stops. This is normal.
Your data is saved in the database and will be there next time you start.

---

## Quick Test: Your First Valuation

Once logged in as `analyst@opm.local`:

1. Click **"New Valuation"**
2. Fill in:
   - Name: `Test Valuation`
   - Company: `Test Company`
   - Date: today's date
3. Click **"Create"**
4. Set **Total Equity Value** to `50000000` (50 million)
5. Set **Volatility** to `60` (%)
6. Set **Risk-Free Rate** to `4.5` (%)
7. Set **Term** to `4` (years)
8. Click **"Save"**
9. Click **"Add Class"** and add:
   - Name: `Common Stock`, Type: `Common`, Shares: `10000000`
10. Click **"Add Class"**
11. Click **"Run OPM Calculation"**
12. Click **"View Results"** to see the output
13. Click **"Export PDF"** or **"Export Excel"** to download a report

---

## Troubleshooting

### "localhost refused to connect"
The server isn't running. Make sure:
- The Terminal / black command window is still open
- You see "OPM Server running on port 3000" in that window
- Try stopping (`Ctrl+C`) and starting again

### "Cannot find module" or other errors on start
Run the setup script again:
- Mac: `bash setup.sh`
- Windows: double-click `setup.bat`

### Browser shows a blank white page
Try a hard refresh:
- **Mac**: `Cmd + Shift + R`
- **Windows**: `Ctrl + Shift + R`

### Port already in use
Another program is using port 3000 or 5173. Either:
- Close other development tools
- Restart your computer and try again

### Everything else
Close all Terminal/command windows, restart your computer,
then run `setup.sh` / `setup.bat` followed by `start.sh` / `start.bat`.

---

## Summary Cheat Sheet

```
  FIRST TIME ONLY:
    1. Install Node.js from https://nodejs.org
    2. Download project from GitHub
    3. Run setup.sh (Mac) or setup.bat (Windows)

  EVERY TIME YOU WANT TO USE THE APP:
    1. Run start.sh (Mac) or start.bat (Windows)
    2. Open browser to http://localhost:5173
    3. Log in and work
    4. Close Terminal / command window when done
```
