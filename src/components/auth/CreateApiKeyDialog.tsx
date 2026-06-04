"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ScopeCheckboxList from "@/components/auth/ScopeCheckboxList";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createApiKey,
  fetchAuthScopes,
  type AuthScopeOption,
  type AuthUserRecord,
} from "@/database/authStorage";

export interface CreatedApiKeyPayload {
  name: string;
  apiKey: string;
}

interface CreateApiKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (payload: CreatedApiKeyPayload) => void;
  users?: AuthUserRecord[];
  defaultUserId?: number;
}

export default function CreateApiKeyDialog({
  open,
  onOpenChange,
  onCreated,
  users,
  defaultUserId,
}: CreateApiKeyDialogProps) {
  const [name, setName] = useState("");
  const [expiry, setExpiry] = useState<string | undefined>(undefined);
  const [scopes, setScopes] = useState<string[]>([]);
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [availableScopes, setAvailableScopes] = useState<AuthScopeOption[]>(
    []
  );
  const [expiryPresets, setExpiryPresets] = useState<AuthScopeOption[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metaReady, setMetaReady] = useState(false);

  useEffect(() => {
    if (!open) {
      setName("");
      setScopes([]);
      setError(null);
      setExpiry(undefined);
      setUserId(undefined);
      setMetaReady(false);
      setAvailableScopes([]);
      setExpiryPresets([]);
      return;
    }

    let cancelled = false;
    setLoadingMeta(true);
    setMetaReady(false);
    setError(null);

    void fetchAuthScopes()
      .then(({ scopes: s, expiryPresets: e }) => {
        if (cancelled) return;
        setAvailableScopes(s);
        setExpiryPresets(e);
        setExpiry(e[0]?.id);
        if (users?.length) {
          const defaultId =
            defaultUserId != null
              ? String(defaultUserId)
              : String(users[0].id);
          setUserId(defaultId);
        }
        setMetaReady(true);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Failed to load scopes"
        );
        setMetaReady(true);
      })
      .finally(() => {
        if (!cancelled) setLoadingMeta(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, defaultUserId, users]);

  const handleSubmit = async () => {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required");
      return;
    }
    if (!expiry) {
      setError("Select an expiry");
      return;
    }
    if (scopes.length === 0) {
      setError("Select at least one scope");
      return;
    }
    setSubmitting(true);
    try {
      const body: {
        name: string;
        scopes: string[];
        expiry_preset: string;
        user_id?: number;
      } = { name: trimmed, scopes, expiry_preset: expiry };
      if (users?.length && userId) {
        body.user_id = Number(userId);
      }
      const result = await createApiKey(body);
      onCreated({
        name: result.name,
        apiKey: result.key,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create key");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create API key</DialogTitle>
          <DialogDescription>
            Scoped keys for automation. The secret is shown once.
          </DialogDescription>
        </DialogHeader>

        {loadingMeta && !metaReady ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="key-name">Name</Label>
              <Input
                id="key-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="CI pipeline"
              />
            </div>
            {users && users.length > 0 && userId ? (
              <div className="space-y-2">
                <Label>User</Label>
                <Select value={userId} onValueChange={setUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.username} ({u.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            {expiryPresets.length > 0 && expiry ? (
              <div className="space-y-2">
                <Label>Expiry</Label>
                <Select value={expiry} onValueChange={setExpiry}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select expiry" />
                  </SelectTrigger>
                  <SelectContent>
                    {expiryPresets.map((preset) => (
                      <SelectItem key={preset.id} value={preset.id}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No expiry presets available.
              </p>
            )}
            <div className="space-y-2">
              <Label>Scopes</Label>
              <ScopeCheckboxList
                availableScopes={availableScopes}
                selectedScopes={scopes}
                onSelectedScopesChange={setScopes}
              />
            </div>
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting || loadingMeta || !metaReady || !expiry}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating…
              </>
            ) : (
              "Create"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
