# AI Assessment Platform

A premium AI-powered assessment platform built with Apple Design Principles, featuring a clean, minimalist UI with glassmorphism effects.

## Features

### 🎨 Apple-Inspired Design
- **Color Palette**: Pure White (#FFFFFF), Deep Black (#1D1D1F), Electric Blue (#007AFF)
- **Glassmorphism**: Backdrop blur effects for overlays and sidebars
- **Smooth Animations**: Framer Motion for fluid transitions
- **Minimalist UI**: High use of white space and rounded corners
- **Fully Responsive**: Perfect on mobile, tablet, and desktop

### 📱 Responsive Design
- **Mobile-First**: Optimized for phones (320px+)
- **Tablet-Friendly**: Adaptive layouts for tablets
- **Desktop-Ready**: Beautiful on large screens
- **Zero Dead Space**: Content adapts to fill available space
- **Touch-Optimized**: 44x44px minimum tap targets

### 📊 Dashboard
- Recent assessments display with clean cards
- Date, Subject, Topic, and Grade at a glance
- Eye icon reveals AI-generated feedback in glassmorphic popover
- Profile sidebar with student information

### ✍️ Progressive Flow Form
- Step-by-step assessment creation
- Subject selection
- Multiple topic selection
- Question count (10, 20, 40)
- Style selection (Exam/Test)
- AI-calculated time estimate

### 🎯 Zen Mode Assessment Interface
- Distraction-free design
- One question at a time
- Large, clean MCQ options
- Persistent countdown timer
- Question navigation
- Warning color when time is low

### 🤖 AI-Powered Generation
- Integration with Gemini 2.5 Flash API
- Intelligent question generation
- Exam-style or textbook-style questions
- Detailed feedback for each answer
- Automatic time calculation

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Database**: Supabase (configured)
- **AI**: Gemini 2.5 Flash API

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Gemini AI Configuration
GEMINI_API_KEY=your_gemini_api_key
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
ai-assessment-platform/
├── app/
│   ├── api/
│   │   ├── generate-assessment/   # AI question generation endpoint
│   │   └── save-result/            # Save assessment results
│   ├── assessment/                 # Assessment taking page
│   ├── globals.css                 # Global styles + responsive utilities
│   ├── layout.tsx                  # Root layout with viewport config
│   └── page.tsx                    # Dashboard page
├── components/
│   ├── AssessmentCard.tsx          # Assessment display card (responsive)
│   ├── Dashboard.tsx               # Main dashboard (adaptive grid)
│   ├── FlowForm.tsx                # Progressive form (mobile-first)
│   ├── ProfileSidebar.tsx          # Student profile (full-width mobile)
│   ├── ThemeProvider.tsx           # Theme context
│   └── ThemeToggle.tsx             # Dark/Light mode toggle
├── lib/
│   └── supabase.ts                 # Supabase client
├── types/
│   └── index.ts                    # TypeScript definitions
├── RESPONSIVE.md                   # Responsive design documentation
├── RESPONSIVE_SUMMARY.md           # Quick responsive reference
├── TESTING_GUIDE.md                # Device testing guide
└── public/                         # Static assets
```

## Key Features Implementation

### Micro-Interactions
- MCQ options glow blue on selection
- Options scale up by 2% on hover
- Smooth transitions throughout

### Timer Warning
- Blue timer turns orange when < 2 minutes
- Pulsing animation for urgency
- Calm design to avoid stress

### Glassmorphism
- `backdrop-filter: blur(40px)`
- Applied to sidebars and popovers
- Works in dark and light mode

### Database Schema

The application uses Supabase with the following tables:

- `assessments`: Stores assessment metadata
- `assessment_results`: Student results and scores
- `questions`: Generated questions per assessment

SQL schema is included in `lib/supabase.ts`

## API Integration

### Gemini AI Integration

The app is configured to use Gemini 2.5 Flash for question generation. To enable:

1. Get API key from [Google AI Studio](https://aistudio.google.com/)
2. Add to `.env.local`
3. Uncomment the API call in `app/api/generate-assessment/route.ts`

### Current Mock Mode

The app runs in mock mode by default with sample questions for development.

## Customization

### Colors

Edit `tailwind.config.js`:

```js
colors: {
  'apple-white': '#FFFFFF',
  'apple-black': '#1D1D1F',
  'apple-blue': '#007AFF',
  // Add your colors
}
```

### Subjects & Topics

Edit in `components/FlowForm.tsx`:

```typescript
const subjects = ['Mathematics', 'Physics', ...]
const topicsBySubject = { ... }
```

## Deployment

### Vercel (Recommended)

```bash
npm run build
vercel --prod
```

### Other Platforms

```bash
npm run build
npm start
```
 - ✅ Full support
- Firefox (latest) - ✅ Full support
- Safari (iOS 12+) - ✅ Full support including glassmorphism
- Mobile browsers - ✅ Optimized for touch

**Responsive Breakpoints:**
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: 1024px+

**Note:** Glassmorphism (`backdrop-filter`) requires modern browsers. Fallback solid backgrounds provided.
- Firefox (latest)
- Safari (latest)
- Backdrop-filter support required for glassmorphism

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.

---

Built with ❤️ using Apple Design Principles
