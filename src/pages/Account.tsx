"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import LogoutButton from "@/components/auth/LogoutButton";
import {
  changePassword,
  deleteApiKey,
  fetchDeletionStatus,
  fetchMeAllowedScopes,
  listApiKeys,
  patchApiKey,
  revokeAndDeleteApiKey,
  scheduleAccountDeletion,
  type ApiKeyRecord,
} from "@/database/authStorage";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import CreateApiKeyDialog, {
  type CreatedApiKeyPayload,
} from "@/components/auth/CreateApiKeyDialog";
import ApiKeySecretDialog from "@/components/auth/ApiKeySecretDialog";
import PasswordRequirementsChecklist from "@/components/auth/PasswordRequirementsChecklist";
import {
  isPasswordPolicySatisfied,
  validatePasswordPolicy,
} from "@/lib/passwordPolicy";
import { toast } from "sonner";
import { format } from "date-fns";

function keyStatusBadge(k: ApiKeyRecord) {
  const status =
    k.key_status ??
    (k.is_expired ? "expired" : k.is_active === false ? "inactive" : "active");
  const variant =
    status === "active"
      ? "secondary"
      : status === "expired"
        ? "outline"
        : "destructive";
  return (
    <Badge variant={variant} className="capitalize text-xs">
      {status}
    </Badge>
  );
}

export default function Account() {
  const { user, logout } = useAuth();
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [jwtScopes, setJwtScopes] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [secretPayload, setSecretPayload] =
    useState<CreatedApiKeyPayload | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deletionStatus, setDeletionStatus] = useState<{
    pending?: boolean;
    purgeAt?: string | null;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [keyResult, scopes, status] = await Promise.all([
        listApiKeys(),
        fetchMeAllowedScopes(),
        fetchDeletionStatus().catch(() => null),
      ]);
      setKeys(keyResult.apiKeys);
      setJwtScopes(scopes.allowedScopes);
      if (status) {
        setDeletionStatus({
          pending:
            Boolean(status.pending_deletion) ||
            status.account_state === "pending_deletion",
          purgeAt: status.purge_scheduled_at ?? null,
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load account");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleChangePassword = async () => {
    if (!isPasswordPolicySatisfied(newPassword)) {
      toast.error(validatePasswordPolicy(newPassword) ?? "Invalid password");
      return;
    }
    setChangingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      toast.success("Password updated");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Password change failed");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleScheduleDeletion = async () => {
    if (!deletePassword) {
      toast.error("Enter your password to confirm");
      return;
    }
    setDeletingAccount(true);
    try {
      await scheduleAccountDeletion(deletePassword);
      toast.success("Account scheduled for deletion (30-day grace period)");
      setDeleteDialogOpen(false);
      logout();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed");
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleRevokeKey = async (k: ApiKeyRecord) => {
    try {
      if (k.key_status === "inactive" || k.is_active === false) {
        await deleteApiKey(k.id);
      } else {
        await revokeAndDeleteApiKey(k.id);
      }
      toast.success(`Removed "${k.name}"`);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Remove failed");
    }
  };

  const handleDeactivateKey = async (k: ApiKeyRecord) => {
    try {
      await patchApiKey(k.id, { is_active: false });
      toast.success(`Deactivated "${k.name}"`);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Deactivate failed");
    }
  };

  return (
    <div className="mx-auto max-w-4xl w-full space-y-8 py-2">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Account</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Signed in as <strong>{user?.username}</strong>{" "}
            <Badge variant="secondary" className="ml-1 capitalize">
              {user?.role}
            </Badge>
          </p>
        </div>
        <LogoutButton variant="outline" />
      </div>

      {deletionStatus?.pending ? (
        <p className="text-sm text-amber-600 dark:text-amber-500 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          This account is scheduled for deletion
          {deletionStatus.purgeAt
            ? ` on ${format(new Date(deletionStatus.purgeAt), "MMM d, yyyy")}`
            : ""}
          . Use{" "}
          <a href="/recover" className="underline font-medium">
            account recovery
          </a>{" "}
          to cancel.
        </p>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">JWT access scopes</h2>
        <p className="text-sm text-muted-foreground">
          Permissions applied when you sign in (no API key required).
        </p>
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : jwtScopes === null ? (
          <p className="text-sm text-muted-foreground">
            Unrestricted (role default).
          </p>
        ) : jwtScopes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No scoped endpoints.</p>
        ) : (
          <p className="text-xs font-mono text-muted-foreground">
            {jwtScopes.join(", ")}
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Change password</h2>
        <div className="grid gap-3 max-w-md">
          <div className="space-y-2">
            <Label>Current password</Label>
            <Input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>New password</Label>
            <Input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <PasswordRequirementsChecklist password={newPassword} />
          </div>
          <Button
            type="button"
            disabled={
              changingPassword ||
              !currentPassword ||
              !isPasswordPolicySatisfied(newPassword)
            }
            onClick={() => void handleChangePassword()}
          >
            {changingPassword ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Update password"
            )}
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">API keys</h2>
          <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New key
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Deactivate a key before removing it permanently.
        </p>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : keys.length === 0 ? (
          <p className="text-sm text-muted-foreground">No API keys yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Scopes</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="w-[120px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((k) => (
                <TableRow key={k.id}>
                  <TableCell className="font-medium">{k.name}</TableCell>
                  <TableCell>{keyStatusBadge(k)}</TableCell>
                  <TableCell className="text-xs max-w-[200px] truncate">
                    {(k.allowed_scopes ?? k.scopes)?.join(", ") ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {k.expires_at
                      ? format(new Date(k.expires_at), "MMM d, yyyy")
                      : "—"}
                  </TableCell>
                  <TableCell className="flex gap-1">
                    {k.is_active !== false &&
                    k.key_status !== "inactive" &&
                    k.key_status !== "expired" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={() => void handleDeactivateKey(k)}
                      >
                        Deactivate
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => void handleRevokeKey(k)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section className="space-y-2 border-t pt-6">
        <h2 className="text-lg font-semibold text-destructive">Danger zone</h2>
        <p className="text-sm text-muted-foreground">
          Schedule account deletion with a 30-day recovery window. Data is removed
          after the grace period.
        </p>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setDeleteDialogOpen(true)}
        >
          Schedule account deletion
        </Button>
      </section>

      <CreateApiKeyDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(payload) => {
          setSecretPayload(payload);
          void load();
        }}
      />
      {secretPayload ? (
        <ApiKeySecretDialog
          open
          onOpenChange={(open) => !open && setSecretPayload(null)}
          name={secretPayload.name}
          apiKey={secretPayload.apiKey}
        />
      ) : null}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Schedule account deletion?</AlertDialogTitle>
            <AlertDialogDescription>
              Your account enters a 30-day grace period. You can recover it with
              your username and password. After that, data is permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label>Confirm password</Label>
            <Input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void handleScheduleDeletion();
              }}
              disabled={deletingAccount}
            >
              {deletingAccount ? "Scheduling…" : "Schedule deletion"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
