"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  deleteApiKey,
  listApiKeys,
  listUsers,
  patchApiKey,
  revokeAndDeleteApiKey,
  type ApiKeyRecord,
  type AuthUserRecord,
} from "@/database/authStorage";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import CreateApiKeyDialog, {
  type CreatedApiKeyPayload,
} from "@/components/auth/CreateApiKeyDialog";
import ApiKeySecretDialog from "@/components/auth/ApiKeySecretDialog";
import { toast } from "sonner";
import { format } from "date-fns";

function keyStatusBadge(k: ApiKeyRecord) {
  const status =
    k.key_status ??
    (k.is_expired ? "expired" : k.is_active === false ? "inactive" : "active");
  return (
    <Badge variant="secondary" className="capitalize text-xs">
      {status}
    </Badge>
  );
}

export default function ApiKeyManagement() {
  const [users, setUsers] = useState<AuthUserRecord[]>([]);
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [filterUserId, setFilterUserId] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [secretPayload, setSecretPayload] =
    useState<CreatedApiKeyPayload | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const userResult = await listUsers({ page_size: 100 });
      const keyResult = await listApiKeys({
        user_id: filterUserId !== "all" ? Number(filterUserId) : undefined,
      });
      setUsers(userResult.users);
      setKeys(keyResult.apiKeys);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [filterUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRevoke = async (k: ApiKeyRecord) => {
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

  const handleDeactivate = async (k: ApiKeyRecord) => {
    try {
      await patchApiKey(k.id, { is_active: false });
      toast.success(`Deactivated "${k.name}"`);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Deactivate failed");
    }
  };

  const ownerLabel = (k: ApiKeyRecord) =>
    k.username ?? k.user_username ?? (k.user_id != null ? `#${k.user_id}` : "—");

  return (
    <div className="mx-auto max-w-5xl w-full space-y-6 py-2">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">API keys</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage keys for yourself and managed users. Deactivate before delete.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterUserId} onValueChange={setFilterUserId}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter user" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All users</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={String(u.id)}>
                  {u.username}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New key
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : keys.length === 0 ? (
        <p className="text-sm text-muted-foreground">No API keys found.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>User</TableHead>
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
                <TableCell className="text-sm">{ownerLabel(k)}</TableCell>
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
                      onClick={() => void handleDeactivate(k)}
                    >
                      Deactivate
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => void handleRevoke(k)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <CreateApiKeyDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        users={users.filter((u) => u.account_state === "active" || !u.account_state)}
        defaultUserId={
          filterUserId !== "all" ? Number(filterUserId) : undefined
        }
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
    </div>
  );
}
