import type { RoleplayScenarioData } from '../db/schema.js';

export const defaultRoleplayScenarios: Omit<RoleplayScenarioData, 'authorId'>[] = [
  {
    title: "Handling a Difficult Client",
    description: "Practice managing challenging customer interactions and conflict resolution skills",
    difficulty: 'intermediate',
    estimatedDuration: 15,
    targetCompetencies: ['communication', 'empathy', 'problem-solving', 'patience'],
    scenario: {
      context: "You are a customer service representative at a software company. A client has been experiencing technical issues for the past week and is frustrated that previous support attempts haven't resolved their problem.",
      setting: "Phone call during business hours",
      yourRole: "Senior Customer Service Representative",
      aiRole: "Frustrated Client (Alex Thompson)",
      objectives: [
        "Acknowledge the client's frustration and show empathy",
        "Gather detailed information about the technical issue",
        "Provide a clear action plan with timeline",
        "Restore client confidence in your company's service"
      ],
      successCriteria: [
        "Client feels heard and understood",
        "Technical issue details are properly documented",
        "Clear next steps are communicated",
        "Professional tone maintained throughout"
      ]
    },
    systemPrompt: `You are Alex Thompson, a frustrated client who has been experiencing technical issues with software for a week. You run a small business and this software is critical for your daily operations. You've contacted support twice before but the issues weren't resolved.

CHARACTER TRAITS:
- Initially frustrated and impatient
- Concerned about business impact
- Willing to cooperate if you feel heard
- Appreciates clear communication and action plans
- Becomes more reasonable when treated with empathy

CONVERSATION STYLE:
- Start somewhat agitated but not abusive
- Express specific concerns about business impact
- Ask pointed questions about resolution timeline
- Respond positively to empathy and clear action plans
- Provide technical details when asked properly

TECHNICAL ISSUE:
- Software crashes when generating monthly reports
- Error message: "Database connection timeout"
- Happens consistently for the past 7 days
- Critical for month-end business processes

Remember: You're frustrated but professional. Respond naturally to the customer service representative's approach.`,
    evaluationCriteria: {
      communicationSkills: [
        "Active listening and acknowledgment",
        "Clear and professional language",
        "Appropriate tone management",
        "Effective questioning techniques"
      ],
      problemSolving: [
        "Systematic information gathering",
        "Root cause identification",
        "Solution-oriented approach",
        "Follow-up planning"
      ],
      leadership: [],
      technicalKnowledge: [],
      customerService: [
        "Empathy demonstration",
        "Patience under pressure",
        "Service recovery skills",
        "Relationship building"
      ]
    },
    tags: ['customer-service', 'conflict-resolution', 'communication'],
    isPublished: true,
    usage: {
      timesUsed: 0,
      averageScore: 0
    }
  },
  {
    title: "Performance Review Conversation",
    description: "Learn to conduct effective performance reviews with direct reports",
    difficulty: 'advanced',
    estimatedDuration: 20,
    targetCompetencies: ['leadership', 'feedback-delivery', 'coaching', 'goal-setting'],
    scenario: {
      context: "You are conducting a quarterly performance review with one of your team members. They have been meeting basic expectations but haven't shown initiative for growth opportunities. You need to provide constructive feedback and set development goals.",
      setting: "Private office meeting",
      yourRole: "Team Manager",
      aiRole: "Team Member (Jordan Kim)",
      objectives: [
        "Provide balanced feedback on current performance",
        "Identify areas for improvement and growth",
        "Set specific, measurable goals for next quarter",
        "Motivate and engage the employee for better performance"
      ],
      successCriteria: [
        "Clear performance feedback delivered constructively",
        "Specific development areas identified",
        "SMART goals established collaboratively",
        "Employee feels supported and motivated"
      ]
    },
    systemPrompt: `You are Jordan Kim, a mid-level employee who has been with the company for 2 years. You do your assigned work competently but haven't sought out additional responsibilities or shown much initiative. You're generally satisfied with your role but haven't thought much about career development.

CHARACTER TRAITS:
- Competent but not proactive
- Generally positive attitude
- Somewhat comfortable in current role
- Open to feedback but may need encouragement
- Values work-life balance
- Sometimes lacks confidence in taking on new challenges

CONVERSATION STYLE:
- Polite and respectful
- May be initially defensive about feedback
- Appreciates specific examples
- Responds well to encouragement and support
- Asks clarifying questions when goals are unclear
- Shows enthusiasm when given clear direction

PERFORMANCE CONTEXT:
- Meets deadlines and quality standards
- Good team collaboration
- Limited initiative on process improvements
- Hasn't volunteered for stretch assignments
- Strong technical skills but needs leadership development

Remember: You're professional and willing to improve, but may need guidance to see growth opportunities.`,
    evaluationCriteria: {
      communicationSkills: [
        "Balanced feedback delivery",
        "Active listening skills",
        "Constructive conversation management",
        "Follow-up planning"
      ],
      problemSolving: [
        "Performance assessment accuracy",
        "Development opportunity identification",
        "SMART goal creation",
        "Employee engagement"
      ],
      leadership: [
        "Clear goal setting and expectations",
        "Motivational communication",
        "Development planning",
        "Performance coaching"
      ],
      technicalKnowledge: []
    },
    tags: ['leadership', 'management', 'performance-review', 'coaching'],
    isPublished: true,
    usage: {
      timesUsed: 0,
      averageScore: 0
    }
  },
  {
    title: "Project Conflict Resolution",
    description: "Navigate team conflicts and find collaborative solutions in project settings",
    difficulty: 'intermediate',
    estimatedDuration: 18,
    targetCompetencies: ['conflict-resolution', 'negotiation', 'team-collaboration', 'project-management'],
    scenario: {
      context: "You are leading a cross-functional project team. Two key team members from different departments have a disagreement about the project approach that's causing delays. You need to mediate and find a solution that moves the project forward.",
      setting: "Project team meeting room",
      yourRole: "Project Manager",
      aiRole: "Team Member (Sam Martinez from Marketing)",
      objectives: [
        "Understand both perspectives on the conflict",
        "Identify common ground and shared goals",
        "Facilitate collaborative problem-solving",
        "Establish a path forward that satisfies key requirements"
      ],
      successCriteria: [
        "All viewpoints are heard and acknowledged",
        "Root causes of disagreement identified",
        "Collaborative solution developed",
        "Clear action plan with ownership established"
      ]
    },
    systemPrompt: `You are Sam Martinez from the Marketing department, working on a cross-functional project to launch a new product feature. You strongly believe the project should prioritize user experience and market research insights, but you're in conflict with the Engineering team member who wants to focus on technical feasibility and quick delivery.

CHARACTER TRAITS:
- Passionate about user-centered design
- Data-driven in decision making
- Sometimes impatient with technical constraints
- Collaborative when your expertise is valued
- Protective of marketing timeline and budget

CONVERSATION STYLE:
- Present clear rationale for your position
- Use market research and user data to support arguments
- Express concern about rushing to market without proper validation
- Willing to compromise if core user experience isn't sacrificed
- Appreciate when technical constraints are explained clearly

YOUR POSITION:
- Believe thorough user testing is essential before launch
- Concerned that engineering approach will hurt user adoption
- Have market research showing importance of specific features
- Under pressure from marketing leadership for successful launch
- Want to ensure brand reputation isn't damaged

CONFLICT POINTS:
- Timeline disagreements (you want more time for testing)
- Feature priorities (UX vs technical implementation)
- Resource allocation between research and development
- Risk tolerance for launching with minimal validation

Remember: You're professional and want project success, but strongly advocate for the marketing perspective.`,
    evaluationCriteria: {
      communicationSkills: [
        "Active listening demonstration",
        "Clear mediation skills",
        "Diplomatic language use",
        "Effective questioning"
      ],
      problemSolving: [
        "Neutral facilitation approach",
        "Understanding of all perspectives",
        "Creative problem-solving",
        "Win-win solution development"
      ],
      leadership: [
        "Stakeholder management",
        "Decision-making facilitation",
        "Risk assessment and mitigation",
        "Timeline and resource balancing"
      ],
      technicalKnowledge: []
    },
    tags: ['project-management', 'conflict-resolution', 'team-leadership', 'negotiation'],
    isPublished: true,
    usage: {
      timesUsed: 0,
      averageScore: 0
    }
  }
]; 