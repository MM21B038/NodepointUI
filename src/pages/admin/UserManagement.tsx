"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Trash2,
  Skull,
} from "lucide-react";
import {
  accountStateLabel,
  createUser,
  fetchAuthScopes,
  fetchUserAllowedScopes,
  filterScopesToCatalog,
  listUsers,
  purgeUser,
  readOnlyScopeIds,
  scheduleUserDeletion,
  updateUser,
  updateUserAllowedScopes,
  type AccountState,
  type AuthScopeOption,
  type AuthUserRecord,
} from "@/database/authStorage";
import ScopeCheckboxList from "@/components/auth/ScopeCheckboxList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import PasswordRequirementsChecklist from "@/components/auth/PasswordRequirementsChecklist";
import {
  isPasswordPolicySatisfied,
  validatePasswordPolicy,
} from "@/lib/passwordPolicy";
import { format } from "date-fns";

function stateBadgeVariant(
  state: AccountState | undefined
): "secondary" | "destructive" | "outline" {
  if (state === "inactive") return "destructive";
  if (state === "pending_deletion") return "outline";
  return "secondary";
}

export default function UserManagement() {
  const { user: currentUser, hasRole } = useAuth();
  const isSuperadmin = hasRole("superadmin");

  const [users, setUsers] = useState<AuthUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [accountStateFilter, setAccountStateFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AuthUserRecord | null>(null);
  const [scheduleDeleteTarget, setScheduleDeleteTarget] =
    useState<AuthUserRecord | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<AuthUserRecord | null>(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [submitting, setSubmitting] = useState(false);
  const [availableScopes, setAvailableScopes] = useState<AuthScopeOption[]>(
    []
  );
  const [accessScopes, setAccessScopes] = useState<string[]>([]);
  const [scopesLoading, setScopesLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: {
        account_state?: AccountState;
        search?: string;
        page_size: number;
      } = { page_size: 100 };
      if (accountStateFilter !== "all") {
        params.account_state = accountStateFilter as AccountState;
      }
      if (search.trim()) params.search = search.trim();
      const { users: list } = await listUsers(params);
      setUsers(list);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [accountStateFilter, search]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!dialogOpen || role !== "user") return;

    let cancelled = false;
    setScopesLoading(true);

    const loadScopes = async () => {
      try {
        const { scopes, fromServer } = await fetchAuthScopes();
        if (cancelled) return;
        setAvailableScopes(scopes);
        if (!fromServer) {
          toast.warning(
            "Could not load scope catalog from server; showing defaults only."
          );
        }

        if (editing?.role === "user") {
          const { allowedScopes, availableScopes: fromUser } =
            await fetchUserAllowedScopes(editing.id);
          if (cancelled) return;
          const catalog =
            fromUser.length > 0 ? fromUser : scopes;
          if (fromUser.length > 0) setAvailableScopes(catalog);
          if (allowedScopes === null) {
            setAccessScopes(catalog.map((s) => s.id));
          } else {
            setAccessScopes(
              filterScopesToCatalog(allowedScopes, catalog)
            );
          }
        } else {
          setAccessScopes(readOnlyScopeIds(scopes));
        }
      } catch (err) {
        if (!cancelled) {
          setAccessScopes([]);
          toast.error(
            err instanceof Error ? err.message : "Failed to load scopes"
          );
        }
      } finally {
        if (!cancelled) setScopesLoading(false);
      }
    };

    void loadScopes();
    return () => {
      cancelled = true;
    };
  }, [dialogOpen, role, editing?.id, editing?.role, editing?.allowed_scopes]);

  const openCreate = () => {
    setEditing(null);
    setUsername("");
    setPassword("");
    setRole("user");
    setDialogOpen(true);
  };

  const openEdit = (u: AuthUserRecord) => {
    setEditing(u);
    setUsername(u.username);
    setPassword("");
    setRole(u.role === "admin" ? "admin" : "user");
    setDialogOpen(true);
  };

  const requiresPassword = !editing;
  const passwordRequiredValid =
    requiresPassword && isPasswordPolicySatisfied(password);
  const passwordOptionalValid =
    !password || isPasswordPolicySatisfied(password);

  const handleSave = async () => {
    const trimmed = username.trim();
    if (!trimmed) {
      toast.error("Username is required");
      return;
    }
    if (requiresPassword && !passwordRequiredValid) {
      toast.error(validatePasswordPolicy(password) ?? "Password is required");
      return;
    }
    if (editing && password && !passwordOptionalValid) {
      toast.error(validatePasswordPolicy(password) ?? "Invalid password");
      return;
    }
    const isEndUser = editing ? editing.role === "user" : role === "user";
    if (isEndUser && accessScopes.length === 0) {
      toast.error("Select at least one access scope for end users");
      return;
    }
    setSubmitting(true);
    try {
      if (editing) {
        if (password) {
          await updateUser(editing.id, { password });
        }
        if (editing.role === "user") {
          const scopes = filterScopesToCatalog(
            accessScopes,
            availableScopes
          );
          if (scopes.length === 0) {
            throw new Error(
              "No valid scopes selected. Reload the dialog or check GET /api/auth/scopes/."
            );
          }
          await updateUserAllowedScopes(editing.id, scopes);
        }
        toast.success("User updated");
      } else {
        const createScopes =
          role === "user"
            ? filterScopesToCatalog(accessScopes, availableScopes)
            : undefined;
        if (role === "user" && (!createScopes || createScopes.length === 0)) {
          throw new Error(
            "No valid scopes selected. Use scopes from the server catalog only."
          );
        }
        await createUser({
          username: trimmed,
          password,
          role: isSuperadmin ? role : "user",
          allowed_scopes: createScopes,
        });
        toast.success("User created");
      }
      setDialogOpen(false);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (u: AuthUserRecord, activate: boolean) => {
    try {
      await updateUser(u.id, { is_active: activate });
      toast.success(activate ? "User activated" : "User deactivated");
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  };

  const handleScheduleDelete = async () => {
    if (!scheduleDeleteTarget) return;
    try {
      await scheduleUserDeletion(scheduleDeleteTarget.id);
      toast.success(
        `${scheduleDeleteTarget.username} scheduled for deletion (30-day grace)`
      );
      setScheduleDeleteTarget(null);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const handlePurge = async () => {
    if (!purgeTarget) return;
    try {
      const result = await purgeUser(purgeTarget.id);
      toast.success(
        `Permanently removed ${result.username} (${result.workspaces_removed ?? 0} workspaces)`
      );
      setPurgeTarget(null);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Purge failed");
    }
  };

  return (
    <div className="mx-auto max-w-5xl w-full space-y-6 py-2">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create accounts, set JWT access scopes, deactivate, or schedule
            deletion.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New user
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search username…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={accountStateFilter} onValueChange={setAccountStateFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Account state" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All states</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="pending_deletion">Pending deletion</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          Apply
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Username</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Keys</TableHead>
              <TableHead className="text-right min-w-[220px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">
                  <div>{u.username}</div>
                  {u.purge_scheduled_at ? (
                    <div className="text-xs text-muted-foreground">
                      Purge {format(new Date(u.purge_scheduled_at), "MMM d, yyyy")}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="capitalize">
                    {u.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={stateBadgeVariant(u.account_state)}
                    className="capitalize"
                  >
                    {accountStateLabel(u.account_state)}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {u.api_keys_active ?? 0}/{u.api_keys_total ?? 0}
                </TableCell>
                <TableCell>
                  {u.role === "superadmin" ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : (
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(u)}
                      >
                        <Pencil className="mr-1 h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!u.can_activate && !u.can_deactivate}
                        onClick={() =>
                          void handleToggleActive(u, Boolean(u.can_activate))
                        }
                      >
                        {u.can_activate ? (
                          <Power className="mr-1 h-3.5 w-3.5" />
                        ) : (
                          <PowerOff className="mr-1 h-3.5 w-3.5" />
                        )}
                        {u.can_activate ? "Activate" : "Deactivate"}
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={
                          !u.can_purge_permanently &&
                          (u.id === currentUser?.id ||
                            u.account_state !== "active")
                        }
                        onClick={() =>
                          u.can_purge_permanently
                            ? setPurgeTarget(u)
                            : setScheduleDeleteTarget(u)
                        }
                      >
                        <Skull className="mr-1 h-3.5 w-3.5" />
                        Purge
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit user" : "New user"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Username</Label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                readOnly={!!editing}
                disabled={!!editing}
                className={editing ? "bg-muted" : undefined}
              />
              {editing ? (
                <p className="text-xs text-muted-foreground">
                  Username cannot be changed after creation.
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>
                {editing ? "New password (optional)" : "Password"}
              </Label>
              <Input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {requiresPassword || password.length > 0 ? (
                <PasswordRequirementsChecklist
                  password={password}
                  showWhenEmpty={requiresPassword}
                />
              ) : null}
            </div>
            {!editing && isSuperadmin ? (
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={role}
                  onValueChange={(v) => setRole(v as "user" | "admin")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            {role === "user" || editing?.role === "user" ? (
              <div className="space-y-2">
                <Label>Access (JWT)</Label>
                <p className="text-sm text-muted-foreground">
                  Sign-in permissions without an API key. Keys you create later
                  cannot exceed this allowlist.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={scopesLoading || availableScopes.length === 0}
                    onClick={() =>
                      setAccessScopes(readOnlyScopeIds(availableScopes))
                    }
                  >
                    Read only
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={scopesLoading || availableScopes.length === 0}
                    onClick={() =>
                      setAccessScopes(availableScopes.map((s) => s.id))
                    }
                  >
                    Read + write
                  </Button>
                </div>
                {scopesLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : (
                  <ScopeCheckboxList
                    availableScopes={availableScopes}
                    selectedScopes={accessScopes}
                    onSelectedScopesChange={setAccessScopes}
                    maxHeightClassName="max-h-48"
                  />
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Admin accounts have full operator access by default.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleSave()}
              disabled={
                submitting ||
                scopesLoading ||
                !username.trim() ||
                ((editing ? editing.role === "user" : role === "user") &&
                  accessScopes.length === 0) ||
                (requiresPassword && !passwordRequiredValid) ||
                Boolean(
                  editing && password.length > 0 && !passwordOptionalValid
                )
              }
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!scheduleDeleteTarget}
        onOpenChange={(open) => !open && setScheduleDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Schedule deletion?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{scheduleDeleteTarget?.username}&quot; enters a 30-day grace
              period and can recover via the recover endpoint. Data is removed
              after the grace period unless recovered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleScheduleDelete()}
            >
              Schedule deletion
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!purgeTarget}
        onOpenChange={(open) => !open && setPurgeTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Purge permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete &quot;{purgeTarget?.username}&quot;, all
              workspaces, documents, and API keys. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handlePurge()}
            >
              Purge permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
