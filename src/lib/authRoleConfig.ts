import {
  KeyRound,
  Layers,
  MessageSquare,
  Shield,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";

export type AuthRole = "user" | "admin";

export interface AuthRolePerk {
  icon: LucideIcon;
  text: string;
}

export interface AuthRoleDefinition {
  role: AuthRole;
  label: string;
  headline: string;
  tagline: string;
  signupBlurb: string;
  loginBlurb: string;
  icon: LucideIcon;
  perks: AuthRolePerk[];
  /** Tailwind utility groups keyed by surface */
  surfaces: {
    card: string;
    cardSelected: string;
    cardHover: string;
    banner: string;
    iconWrap: string;
    iconWrapSelected: string;
    perk: string;
    ring: string;
    glow: string;
    button: string;
    segmentActive: string;
    fieldFocus: string;
  };
}

export const AUTH_ROLE_USER: AuthRoleDefinition = {
  role: "user",
  label: "User",
  headline: "Workspace member",
  tagline: "For everyday knowledge work",
  signupBlurb:
    "Browse workspaces, explore graphs, and chat with documents in scopes you are assigned to.",
  loginBlurb: "Continue to your workspaces and knowledge base.",
  icon: User,
  perks: [
    { icon: Layers, text: "Access assigned workspaces" },
    { icon: MessageSquare, text: "Grounded chat over your corpus" },
    { icon: Users, text: "Collaborate within your groups" },
  ],
  surfaces: {
    card:
      "border-brand-workspace/20 bg-gradient-to-br from-brand-workspace/[0.06] via-background/40 to-transparent",
    cardSelected:
      "border-brand-workspace/50 bg-gradient-to-br from-brand-workspace/[0.12] via-brand-workspace/[0.04] to-transparent shadow-lg shadow-brand-workspace/10",
    cardHover: "hover:border-brand-workspace/35 hover:shadow-md hover:shadow-brand-workspace/5",
    banner:
      "border-brand-workspace/20 bg-gradient-to-r from-brand-workspace/[0.12] via-brand-workspace/[0.05] to-transparent",
    iconWrap: "bg-brand-workspace/10 text-brand-workspace",
    iconWrapSelected: "bg-brand-workspace/20 text-brand-workspace ring-2 ring-brand-workspace/30",
    perk: "bg-brand-workspace/[0.08] text-brand-workspace border-brand-workspace/15",
    ring: "ring-brand-workspace/40",
    glow: "from-brand-workspace/20 via-brand-workspace/5 to-transparent",
    button:
      "bg-brand-workspace hover:bg-brand-workspace/90 text-white shadow-brand-workspace/25",
    segmentActive: "text-brand-workspace",
    fieldFocus: "focus-visible:border-brand-workspace/50 focus-visible:ring-brand-workspace/20",
  },
};

export const AUTH_ROLE_ADMIN: AuthRoleDefinition = {
  role: "admin",
  label: "Admin",
  headline: "Administrator",
  tagline: "For platform operators",
  signupBlurb:
    "Manage users, API keys, and organization settings. Superadmin accounts are provisioned on the server.",
  loginBlurb: "Administrator and superadmin accounts only.",
  icon: Shield,
  perks: [
    { icon: Users, text: "Manage users and roles" },
    { icon: KeyRound, text: "Issue and revoke API keys" },
    { icon: Shield, text: "Configure org-wide access" },
  ],
  surfaces: {
    card:
      "border-brand-group/20 bg-gradient-to-br from-brand-group/[0.07] via-background/40 to-transparent",
    cardSelected:
      "border-brand-group/50 bg-gradient-to-br from-brand-group/[0.14] via-brand-group/[0.05] to-transparent shadow-lg shadow-brand-group/10",
    cardHover: "hover:border-brand-group/35 hover:shadow-md hover:shadow-brand-group/5",
    banner:
      "border-brand-group/20 bg-gradient-to-r from-brand-group/[0.14] via-brand-group/[0.05] to-transparent",
    iconWrap: "bg-brand-group/10 text-brand-group",
    iconWrapSelected: "bg-brand-group/20 text-brand-group ring-2 ring-brand-group/30",
    perk: "bg-brand-group/[0.08] text-brand-group border-brand-group/15",
    ring: "ring-brand-group/40",
    glow: "from-brand-group/20 via-brand-group/5 to-transparent",
    button: "bg-brand-group hover:bg-brand-group/90 text-white shadow-brand-group/25",
    segmentActive: "text-brand-group",
    fieldFocus: "focus-visible:border-brand-group/50 focus-visible:ring-brand-group/20",
  },
};

export const AUTH_ROLES: Record<AuthRole, AuthRoleDefinition> = {
  user: AUTH_ROLE_USER,
  admin: AUTH_ROLE_ADMIN,
};

export function getAuthRole(role: AuthRole): AuthRoleDefinition {
  return AUTH_ROLES[role];
}

export const AUTH_ROLE_ORDER: AuthRole[] = ["user", "admin"];
