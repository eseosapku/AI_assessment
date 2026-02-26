# Quick Setup Guide

## Step 1: Install Dependencies

Open terminal and run:

```bash
cd c:\Users\MSI\AI_Assessment
npm install
```

This will install all required packages including Next.js, React, Tailwind CSS, Framer Motion, and more.

## Step 2: Configure Environment (Optional)

For full functionality, set up these services:

### Supabase (Database)
1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Copy your project URL and anon key
4. Create `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_url_here
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key_here
   ```

### Gemini AI (Question Generation)
1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Get your API key
3. Add to `.env.local`:
   ```
   GEMINI_API_KEY=your_key_here
   ```

**Note**: The app works in mock mode without these, perfect for testing!

## Step 3: Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Step 4: Explore the Features

### Dashboard
- View sample assessments
- Click the eye icon to see AI feedback
- Click your profile icon (top right) to see student info
- Toggle dark/light mode

### Create Assessment
1. Click "Start New Assessment"
2. Select a subject
3. Choose multiple topics
4. Pick question count (10, 20, or 40)
5. Select style (Exam or Test)
6. Review and start

### Take Assessment
- Navigate through questions
- Select answers (options glow blue)
- Watch the countdown timer
- Submit when complete

## Project Structure

```
📁 AI_Assessment/
├── 📁 app/                     # Next.js app directory
│   ├── 📁 api/                 # Backend API routes
│   ├── 📁 assessment/          # Assessment page
│   ├── globals.css             # Global styles
│   ├── layout.tsx              # Root layout
│   └── page.tsx                # Home/Dashboard
├── 📁 components/              # React components
│   ├── AssessmentCard.tsx      # Card with feedback
│   ├── Dashboard.tsx           # Main dashboard
│   ├── FlowForm.tsx            # Progressive form
│   ├── ProfileSidebar.tsx      # Student profile
│   ├── ThemeProvider.tsx       # Theme management
│   └── ThemeToggle.tsx         # Dark mode toggle
├── 📁 lib/                     # Utilities
├── 📁 types/                   # TypeScript types
├── package.json                # Dependencies
├── tailwind.config.js          # Tailwind setup
└── README.md                   # Documentation
```

## Key Apple Design Elements

✨ **Glassmorphism**: Frosted glass effect on sidebars
🎨 **Color Palette**: White, Black, Electric Blue
🔄 **Smooth Animations**: Framer Motion transitions
⚡ **Micro-interactions**: Hover effects, scaling
🎯 **Minimalist**: Clean, spacious layout

## Customization Quick Tips

### Change Colors
Edit `tailwind.config.js`:
```js
colors: {
  'apple-blue': '#007AFF', // Change this!
}
```

### Add Subjects/Topics
Edit `components/FlowForm.tsx`:
```typescript
const subjects = ['Your Subject', ...]
```

### Modify Assessment Time
Edit `app/api/generate-assessment/route.ts`:
```typescript
const timePerQuestion = 1.5 // Change multiplier
```

## Production Deployment

### Build for Production
```bash
npm run build
npm start
```

### Deploy to Vercel
```bash
npm install -g vercel
vercel
```

## Troubleshooting

**Port 3000 already in use?**
```bash
# Use different port
npm run dev -- -p 3001
```

**Dark mode not working?**
- Clear browser cache
- Check localStorage is enabled

**API errors?**
- App works in mock mode by default
- Check .env.local configuration

## Next Steps

1. ✅ Run `npm install`
2. ✅ Run `npm run dev`
3. ✅ Open http://localhost:3000
4. 🎨 Customize colors/content
5. 🚀 Deploy to Vercel

## Support

- Check README.md for detailed docs
- Review code comments for implementation details
- All components are fully typed with TypeScript

---

**Enjoy your premium AI Assessment Platform!** 🎓
