# Deploy to Render (Easiest - Free Tier)

## Step 1: Push to GitHub

```bash
# Initialize git repository
git init
git add .
git commit -m "FERC Pipeline Valuation App - Initial commit"

# Create a new repository on GitHub.com, then:
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

## Step 2: Deploy on Render

1. Go to **https://render.com** and sign up (free, no credit card)
2. Click **"New +"** → **"Web Service"**
3. Click **"Connect GitHub"** and authorize Render
4. Select your repository
5. Configure the service:
   - **Name:** `pipeline-valuation-app` (or your choice)
   - **Region:** Choose closest to you
   - **Branch:** `main`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** **Free**
6. Click **"Create Web Service"**

## Step 3: Wait for Deployment

- Render will install dependencies and start your app
- Takes 2-5 minutes
- Your app will be live at: `https://your-app-name.onrender.com`

## Important Notes

⚠️ **Free tier limitations:**
- App "spins down" after 15 minutes of inactivity
- First load after inactivity takes 30-60 seconds
- 750 hours/month free (plenty for demos)

✅ **Pros:**
- Zero configuration needed
- Automatic HTTPS
- Auto-deploys on every git push
- No credit card required

## Alternative: Deploy to Railway (Also Free)

1. Go to **https://railway.app**
2. Sign up with GitHub
3. Click **"New Project"** → **"Deploy from GitHub repo"**
4. Select your repository
5. Railway auto-detects Node.js and deploys
6. Done! Get your URL from the dashboard

---

## Share with Your Friend

Once deployed, just send them the URL:
- **Render:** `https://your-app-name.onrender.com`
- **Railway:** `https://your-app-name.up.railway.app`

No installation needed - they just open the link in their browser!
