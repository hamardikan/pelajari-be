# Pelajari Platform - UX Workflows & UI Design Guide

## Design System Overview

### Color Palette
- **Primary Teal**: `#2B4C5C` - Navigation, headers, primary buttons
- **Sage Green**: `#A8C4A2` - Success states, completed items
- **Muted Blue**: `#7BA7BC` - Secondary buttons, links
- **Warm Amber**: `#F4A261` - CTA buttons, important notifications
- **Clean White**: `#FFFFFF` - Backgrounds, cards
- **Dark Charcoal**: `#2C3E50` - Text, icons

### Design Principles
- **Mobile-first responsive design**
- **Organic, nature-inspired elements**
- **Soft rounded corners (8-12px)**
- **Generous white space**
- **Gentle shadows and transitions**
- **Growth-themed progress indicators**

---

## 1. Authentication Flow

### 1.1 Welcome/Landing Screen
**UI Description:**
- Clean white background with subtle sage green gradient at top
- Large "Pelajari" logo centered with brain-leaf icon
- Tagline: "Grow Your Skills, Naturally"
- Two rounded buttons:
  - "Get Started" (Warm amber, full width)
  - "I have an account" (Teal outline, full width)

**UX Flow:**
```
Landing → Registration/Login → Dashboard
```

### 1.2 Registration Screen
**UI Description:**
- Progress indicator at top (3 steps: Details → Role → Welcome)
- Form with floating labels and soft rounded inputs
- Nature-themed validation (green checkmarks like leaves)
- "Continue" button (amber) becomes active when form is valid

**UX Flow:**
```
Step 1: Basic Info (Name, Email, Password)
↓
Step 2: Role Selection (Employee/Manager) with visual cards
↓ 
Step 3: Welcome message with next steps
↓
Auto-login → Dashboard
```

### 1.3 Login Screen
**UI Description:**
- Simplified form with email/password
- "Remember me" toggle with leaf-inspired switch design
- Forgot password link in muted blue
- Social login options if available (rounded, soft shadows)

---

## 2. Main Navigation & Dashboard

### 2.1 Bottom Navigation (Mobile)
**UI Description:**
- Fixed bottom navigation with 5 tabs
- Organic icon design with rounded shapes
- Active state: Teal background with white icon
- Inactive: Charcoal icons

**Navigation Items:**
1. **Home** (Dashboard) - House icon
2. **Learn** - Book with leaf icon  
3. **Practice** - Two people talking icon
4. **Progress** - Growth chart icon
5. **Profile** - Person icon

### 2.2 Dashboard Home
**UI Description:**
- Welcome header with user name and notification bell
- Weather-card style layout with soft shadows
- Quick stats cards in grid layout
- Recent activity feed with timeline design
- Floating action button for quick actions (amber)

**Content Sections:**
```
Welcome Banner
├── Good morning, [Name]
├── Today's learning goal progress
└── Streak counter

Quick Stats Grid (2x2)
├── Modules Completed
├── Current Streak  
├── Practice Sessions
└── Skill Level

Continue Learning Section
├── Resume last module
└── Recommended next steps

Recent Activity Timeline
├── Completed assessment
├── New module available
└── Manager feedback
```

---

## 3. Document Upload & Learning Module Creation

### 3.1 Document Upload Flow
**UI Description:**
- Drag & drop area with dashed border and leaf pattern
- File type icons (PDF, DOCX) with nature-inspired designs
- Upload progress with growing plant animation
- Success state with gentle green glow

**UX Flow:**
```
Dashboard → Upload Button → File Selection
↓
Drag & Drop Interface or File Browser
↓
File Validation & Preview
↓
Metadata Form (Title, Description, Tags)
↓
Processing Screen (AI generation status)
↓
Success → View Generated Module
```

### 3.2 Document Processing Screen
**UI Description:**
- Large circular progress indicator with sprouting plant animation
- Status text: "AI is analyzing your document..."
- Estimated time remaining
- Background pattern of subtle leaves
- Cancel option (if needed)

### 3.3 Module Creation Success
**UI Description:**
- Success animation (checkmark with leaf flourish)
- Module preview card with:
  - Generated title
  - Summary snippet
  - Flashcard count
  - Assessment count
- Action buttons:
  - "Start Learning" (amber)
  - "Preview Content" (teal outline)
  - "Share" (blue outline)

---

## 4. Learning Experience

### 4.1 Module Library
**UI Description:**
- Search bar with rounded corners and soft shadow
- Filter chips (Difficulty, Topic, Duration)
- Module cards in Pinterest-style masonry layout
- Each card shows:
  - Title and description
  - Difficulty badge (color-coded)
  - Duration estimate
  - Progress bar if started
  - Bookmark icon

**UX Flow:**
```
Browse Modules → Filter/Search → Select Module
↓
Module Preview → Start Learning
↓
Learning Session → Progress Tracking
```

### 4.2 Module Detail View
**UI Description:**
- Hero section with module title and description
- Tabbed content: Overview, Content, Reviews
- Key info cards: Duration, Difficulty, Prerequisites
- Learning path visualization
- Start button (prominent amber)

### 4.3 Learning Session Interface
**UI Description:**
- Progress bar at top (organic, growing vine style)
- Content card with rounded corners and soft shadow
- Navigation: Previous/Next with arrow buttons
- Section indicators (dots with leaf shapes)
- Floating help button
- Exit confirmation modal

**Content Types:**
1. **Reading Sections**: Clean typography, good line spacing
2. **Flashcards**: Card flip animation, swipe gestures
3. **Assessments**: Radio buttons with custom styling
4. **Evaluations**: Text area with character counter

### 4.4 Flashcards Interface
**UI Description:**
- Large card centered on screen
- Tap to flip animation (3D card flip)
- Swipe gestures: Right (know it), Left (review again)
- Progress indicator showing cards remaining
- Action buttons: "I know this" (green), "Review later" (amber)

### 4.5 Assessment Interface
**UI Description:**
- Question card with clean typography
- Multiple choice options as rounded buttons
- Selected state with teal background
- Progress: "Question 3 of 10"
- Submit button only active when answered
- Review screen with detailed feedback

---

## 5. Individual Development Plan (IDP)

### 5.1 IDP Creation Wizard
**UI Description:**
- Step-by-step wizard with organic progress indicator
- Each step as a separate screen with smooth transitions
- File upload areas with drag & drop
- Form validation with gentle animations

**UX Flow:**
```
IDP Menu → Start Assessment
↓
Step 1: Upload Competency Framework (PDF/Form)
↓
Step 2: Upload Employee Data (PDF/Form)  
↓
Step 3: Review Information
↓
AI Processing Screen
↓
Gap Analysis Results
↓
Development Plan Generation
```

### 5.2 Gap Analysis Upload
**UI Description:**
- Two upload zones side by side (mobile: stacked)
- Clear labels: "Competency Framework" & "Employee Assessment"
- File preview with PDF thumbnails
- Alternative: "Fill form manually" option
- Validation checks with green/red indicators

### 5.3 Gap Analysis Processing
**UI Description:**
- Animated brain icon with pulsing effect
- Status updates: "Analyzing competencies...", "Identifying gaps...", "Generating recommendations..."
- Progress steps with checkmarks
- Estimated completion time
- Background with floating learning icons

### 5.4 Gap Analysis Results
**UI Description:**
- Executive summary card at top
- Competency gap visualization (chart/graph)
- Expandable sections for each competency
- Priority indicators (High/Medium/Low) with color coding
- Action buttons: "Generate IDP", "Download Report", "Share with Manager"

**Content Layout:**
```
Summary Card
├── Overall Gap Score (circular progress)
├── Key findings
└── Recommended focus areas

Gap Details
├── Competency 1 (expandable)
│   ├── Current vs Required level
│   ├── Gap description
│   └── Recommendations
├── Competency 2
└── ...

Next Steps
├── Generate Development Plan button
└── Schedule manager meeting
```

### 5.5 Development Plan View
**UI Description:**
- Timeline-style layout showing development journey
- Each goal as a card with:
  - Competency name
  - Current → Target level progression
  - Associated programs/courses
  - Timeline
  - Progress tracking
- Manager approval section
- Progress update buttons

---

## 6. Roleplay Practice System

### 6.1 Scenario Selection
**UI Description:**
- Category filters as chips (Communication, Leadership, etc.)
- Scenario cards with:
  - Title and description
  - Difficulty level (beginner/intermediate/advanced)
  - Duration estimate
  - Target competencies as tags
  - User rating/reviews
- Preview button for scenario details

### 6.2 Scenario Preview
**UI Description:**
- Scenario description card
- Your role vs AI role comparison
- Objectives checklist
- Success criteria
- Difficulty and duration info
- "Start Practice" button (prominent amber)
- Previous session scores if available

### 6.3 Roleplay Interface
**UI Description:**
- Chat-style interface with messages
- User messages: Right-aligned, teal background
- AI messages: Left-aligned, light gray background
- Message input with voice note option
- Session timer in header
- End session button in top corner
- Typing indicators for AI responses

**UX Features:**
- Real-time AI responses
- Message history scrolling
- Quick response suggestions
- Voice input capability
- Session pause/resume

### 6.4 Practice Session End
**UI Description:**
- Session summary with total duration
- Overall score with circular progress indicator
- Competency breakdown with radar chart
- Strengths list with green checkmarks
- Areas for improvement with amber suggestions
- Detailed feedback in expandable cards
- Action buttons: "Practice Again", "Try New Scenario", "View Full Report"

---

## 7. Progress Tracking & Analytics

### 7.1 Progress Dashboard
**UI Description:**
- Growth-themed visual design
- Tree or plant metaphor for skill development
- Multiple views: Weekly, Monthly, All-time
- Interactive charts and graphs
- Achievement badges and milestones

**Content Sections:**
```
Growth Overview
├── Learning streak (days)
├── Modules completed
├── Practice sessions
└── Skill level progression

Competency Radar Chart
├── Visual representation of skills
├── Before vs After comparison
└── Target level indicators

Recent Achievements
├── Badge collection
├── Milestone celebrations
└── Completion certificates

Goals & Targets
├── Current focus areas
├── Progress toward goals
└── Upcoming deadlines
```

### 7.2 Detailed Analytics
**UI Description:**
- Time spent learning (calendar heatmap)
- Module completion rates
- Assessment scores over time
- Roleplay performance trends
- Competency development charts
- Export options for reports

---

## 8. Profile & Settings

### 8.1 User Profile
**UI Description:**
- Profile header with avatar upload
- Quick stats summary
- Skills and competencies list
- Learning preferences
- Achievement showcase
- Account settings access

### 8.2 Settings Screen
**UI Description:**
- Organized in cards/sections
- Toggle switches for notifications
- Language and timezone settings
- Privacy controls
- Data export options
- Help and support links

---

## 9. Manager Dashboard (Additional Features)

### 9.1 Team Overview
**UI Description:**
- Team member grid/list view
- Individual progress summaries
- IDP approval queue
- Team performance metrics
- Quick actions for each team member

### 9.2 IDP Management
**UI Description:**
- Pending approvals list
- IDP review interface
- Comment and feedback tools
- Approval workflow
- Progress monitoring dashboard

---

## 10. Responsive Design Considerations

### Mobile (320px - 768px)
- Single column layouts
- Bottom navigation
- Swipe gestures for cards
- Collapsible sections
- Touch-friendly button sizing (44px minimum)

### Tablet (768px - 1024px)
- Two-column layouts where appropriate
- Side navigation option
- Larger content cards
- Split-screen capabilities

### Desktop (1024px+)
- Multi-column dashboards
- Sidebar navigation
- Hover states and tooltips
- Keyboard navigation support

---

## 11. Accessibility Features

### Design Considerations
- High contrast color combinations
- Focus indicators with teal outline
- Screen reader friendly markup
- Keyboard navigation support
- Touch target sizing (minimum 44px)
- Alternative text for all images
- Loading states with descriptive text

### Inclusive Design
- Simple, clear language
- Visual progress indicators
- Multiple input methods (touch, voice, keyboard)
- Offline capability for core features
- Progressive enhancement approach

---

## 12. Animation & Micro-interactions

### Loading States
- Growing plant animations for processing
- Skeleton screens with pulsing effect
- Progress bars with organic movement
- Particle effects for achievements

### Transitions
- Smooth page transitions (slide/fade)
- Card hover effects (gentle lift)
- Button press feedback
- Modal slide-up animations
- Tab switching with horizontal slide

### Feedback Animations
- Success: Green checkmark with leaf flourish
- Error: Gentle shake with red highlight
- Processing: Pulsing brain icon
- Achievement: Confetti with nature elements

---

## 13. State Management & Data Flow

### Key App States
- Authentication state
- User profile data
- Learning progress
- Current module/session
- IDP data
- Roleplay session state

### Data Synchronization
- Offline capability for reading content
- Background sync when connection restored
- Optimistic updates for user actions
- Error handling with retry mechanisms

---

## 14. Performance Considerations

### Mobile Optimization
- Lazy loading for content
- Image optimization and compression
- Chunked JavaScript loading
- Service worker for caching
- Minimal bundle sizes

### Progressive Web App Features
- Install prompt
- Offline functionality
- Background sync
- Push notifications (with permission)
- App-like experience

This comprehensive guide provides the foundation for building a mobile-first, accessible, and engaging learning platform that aligns with the natural, growth-oriented design theme of Pelajari.