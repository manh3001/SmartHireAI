export type OnboardingSignals = {
  hasCV: boolean;
  hasBio: boolean;
  hasApplication: boolean;
  hasCompany: boolean;
  hasJob: boolean;
};

export type OnboardingStep = { key: string; label: string; href: string; done: boolean };
export type Onboarding = {
  steps: OnboardingStep[];
  completed: number;
  total: number;
  allDone: boolean;
};

type StepDef = { key: string; label: string; href: string; signal: keyof OnboardingSignals };

const CANDIDATE_STEPS: StepDef[] = [
  { key: "cv", label: "Tạo CV", href: "/dashboard", signal: "hasCV" },
  { key: "bio", label: "Điền giới thiệu hồ sơ", href: "/settings/profile", signal: "hasBio" },
  { key: "apply", label: "Ứng tuyển tin đầu tiên", href: "/jobs", signal: "hasApplication" },
];

const RECRUITER_STEPS: StepDef[] = [
  { key: "company", label: "Tạo hồ sơ công ty", href: "/company/edit", signal: "hasCompany" },
  { key: "job", label: "Đăng tin tuyển dụng đầu tiên", href: "/jobs/new", signal: "hasJob" },
];

export function computeOnboarding(
  role: "CANDIDATE" | "RECRUITER",
  signals: OnboardingSignals,
): Onboarding {
  const defs = role === "RECRUITER" ? RECRUITER_STEPS : CANDIDATE_STEPS;
  const steps: OnboardingStep[] = defs.map((d) => ({
    key: d.key,
    label: d.label,
    href: d.href,
    done: signals[d.signal],
  }));
  const completed = steps.filter((s) => s.done).length;
  const total = steps.length;
  return { steps, completed, total, allDone: completed === total };
}
