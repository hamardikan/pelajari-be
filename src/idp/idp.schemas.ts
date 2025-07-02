import { z } from 'zod';

// Job Competency Framework Schema (Dokumen 1)
const jobCompetencyFrameworkSchema = z.object({
  jobTitle: z.string()
    .min(2, 'Job title must be at least 2 characters')
    .max(100, 'Job title must not exceed 100 characters')
    .trim(),
  managerialCompetencies: z.array(z.object({
    name: z.string().min(1, 'Competency name is required'),
    expectedLevel: z.enum(['Basic', 'Intermediate', 'Advanced'], {
      errorMap: () => ({ message: 'Expected level must be Basic, Intermediate, or Advanced' }),
    }),
    description: z.string().optional(),
  })).min(1, 'At least one managerial competency is required'),
  functionalCompetencies: z.array(z.object({
    name: z.string().min(1, 'Competency name is required'),
    expectedLevel: z.enum(['Basic', 'Intermediate', 'Advanced'], {
      errorMap: () => ({ message: 'Expected level must be Basic, Intermediate, or Advanced' }),
    }),
    description: z.string().optional(),
  })).min(1, 'At least one functional competency is required'),
});

// Employee Data Schema (Dokumen 2)
const employeeDataSchema = z.object({
  employeeId: z.string()
    .uuid('Employee ID must be a valid UUID')
    .optional(),
  employeeName: z.string()
    .min(2, 'Employee name must be at least 2 characters')
    .max(100, 'Employee name must not exceed 100 characters')
    .trim(),
  currentJobTitle: z.string()
    .min(2, 'Current job title must be at least 2 characters')
    .max(100, 'Current job title must not exceed 100 characters')
    .trim(),
  performanceSummary: z.string()
    .min(10, 'Performance summary must be at least 10 characters')
    .max(2000, 'Performance summary must not exceed 2000 characters'),
  kpiScore: z.number()
    .min(0, 'KPI score must be at least 0')
    .max(100, 'KPI score must not exceed 100'),
  assessmentResults: z.object({
    potentialScore: z.number()
      .min(0, 'Potential score must be at least 0')
      .max(100, 'Potential score must not exceed 100'),
    summary: z.string()
      .min(10, 'Assessment summary must be at least 10 characters')
      .max(2000, 'Assessment summary must not exceed 2000 characters'),
    competencyScores: z.array(z.object({
      competencyName: z.string().min(1, 'Competency name is required'),
      score: z.number().min(0, 'Score must be at least 0').max(100, 'Score must not exceed 100'),
    })).optional(),
  }),
});

// Gap Analysis Input Schema
const gapAnalysisInputSchema = z.object({
  frameworkData: jobCompetencyFrameworkSchema,
  employeeData: employeeDataSchema,
});

// Employee ID parameter schema
const employeeIdParamsSchema = z.object({
  employeeId: z.string().uuid('Employee ID must be a valid UUID'),
});

// IDP ID parameter schema
const idpIdParamsSchema = z.object({
  idpId: z.string().uuid('IDP ID must be a valid UUID'),
});

// IDP approval schema
const approveIDPSchema = z.object({
  managerId: z.string().uuid('Manager ID must be a valid UUID'),
  comments: z.string()
    .max(1000, 'Comments must not exceed 1000 characters')
    .optional(),
});

// IDP progress update schema
const updateIDPProgressSchema = z.object({
  programId: z.string().uuid('Program ID must be a valid UUID'),
  status: z.enum(['Not Started', 'In Progress', 'Completed'], {
    errorMap: () => ({ message: 'Status must be Not Started, In Progress, or Completed' }),
  }),
  notes: z.string()
    .max(500, 'Notes must not exceed 500 characters')
    .optional(),
  completionPercentage: z.number()
    .min(0, 'Completion percentage must be at least 0')
    .max(100, 'Completion percentage must not exceed 100')
    .optional(),
});

// Nine Box Grid classification schema
const nineBoxClassificationSchema = z.enum([
  'Low Performer',
  'Inconsistent Performer', 
  'High Performer',
  'Emerging Talent',
  'Core Player',
  'High Professional',
  'Rising Star',
  'Key Player',
  'Top Talent'
], {
  errorMap: () => ({ message: 'Invalid Nine Box Grid classification' }),
});

// Development program schema
const developmentProgramSchema = z.object({
  name: z.string().min(1, 'Program name is required'),
  type: z.enum(['Coaching', 'Mentoring', 'Training', 'Job Rotation', 'Special Assignment', 'Online Course'], {
    errorMap: () => ({ message: 'Invalid program type' }),
  }),
  description: z.string().min(10, 'Program description must be at least 10 characters'),
  duration: z.string().min(1, 'Duration is required'),
  targetCompetencies: z.array(z.string()).min(1, 'At least one target competency is required'),
  provider: z.string().optional(),
  cost: z.number().min(0, 'Cost must be non-negative').optional(),
});

// Type exports for use in handlers and services
export type JobCompetencyFrameworkData = z.infer<typeof jobCompetencyFrameworkSchema>;
export type EmployeeData = z.infer<typeof employeeDataSchema>;
export type GapAnalysisInputData = z.infer<typeof gapAnalysisInputSchema>;
export type EmployeeIdParams = z.infer<typeof employeeIdParamsSchema>;
export type IdpIdParams = z.infer<typeof idpIdParamsSchema>;
export type ApproveIDPData = z.infer<typeof approveIDPSchema>;
export type UpdateIDPProgressData = z.infer<typeof updateIDPProgressSchema>;
export type NineBoxClassification = z.infer<typeof nineBoxClassificationSchema>;
export type DevelopmentProgramData = z.infer<typeof developmentProgramSchema>;

// Schema collection for easy import
const idpSchemas = {
  jobCompetencyFramework: jobCompetencyFrameworkSchema,
  employeeData: employeeDataSchema,
  gapAnalysisInput: gapAnalysisInputSchema,
  employeeIdParams: employeeIdParamsSchema,
  idpIdParams: idpIdParamsSchema,
  approveIDP: approveIDPSchema,
  updateIDPProgress: updateIDPProgressSchema,
  nineBoxClassification: nineBoxClassificationSchema,
  developmentProgram: developmentProgramSchema,
};

export {
  jobCompetencyFrameworkSchema,
  employeeDataSchema,
  gapAnalysisInputSchema,
  employeeIdParamsSchema,
  idpIdParamsSchema,
  approveIDPSchema,
  updateIDPProgressSchema,
  nineBoxClassificationSchema,
  developmentProgramSchema,
  idpSchemas,
}; 