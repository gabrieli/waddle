export interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
}

type ValidationRule = (result: TestResult) => boolean;

const hasValidName: ValidationRule = (result) => 
  Boolean(result.name && result.name.trim().length > 0);

const hasPositiveDuration: ValidationRule = (result) => 
  result.duration >= 0;

const hasValidStatus: ValidationRule = (result) => {
  const validStatuses: Array<TestResult['status']> = ['passed', 'failed', 'skipped'];
  return validStatuses.includes(result.status);
};

const isPassingTest: ValidationRule = (result) => 
  result.status !== 'failed';

const validationRules: ValidationRule[] = [
  hasValidName,
  hasPositiveDuration,
  hasValidStatus,
  isPassingTest
];

export function validateTestResult(result: TestResult): boolean {
  return validationRules.every(rule => rule(result));
}