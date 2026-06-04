export interface PasswordPolicyRule {
  id: string;
  label: string;
  met: boolean;
}

export function getPasswordPolicyChecks(password: string): PasswordPolicyRule[] {
  return [
    {
      id: "length",
      label: "At least 8 characters",
      met: password.length >= 8,
    },
    {
      id: "upper",
      label: "At least one uppercase letter (A–Z)",
      met: /[A-Z]/.test(password),
    },
    {
      id: "lower",
      label: "At least one lowercase letter (a–z)",
      met: /[a-z]/.test(password),
    },
    {
      id: "digit",
      label: "At least one number (0–9)",
      met: /[0-9]/.test(password),
    },
    {
      id: "special",
      label: "At least one special character (!@#$…)",
      met: /[^A-Za-z0-9]/.test(password),
    },
  ];
}

export function isPasswordPolicySatisfied(password: string): boolean {
  return getPasswordPolicyChecks(password).every((r) => r.met);
}

/** Matches docs/API.md password policy for register and password changes. */
export function validatePasswordPolicy(password: string): string | null {
  const failed = getPasswordPolicyChecks(password).find((r) => !r.met);
  return failed ? failed.label : null;
}
