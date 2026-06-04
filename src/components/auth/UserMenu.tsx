"use client";

import { Link } from "react-router-dom";
import { LogOut, KeyRound, Shield, User } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLogout } from "@/hooks/useLogout";
import { isAdminRole } from "@/database/authStorage";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

export default function UserMenu() {
  const { user } = useAuth();
  const signOut = useLogout();
  if (!user) return null;

  const admin = isAdminRole(user.role);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <User className="h-4 w-4" />
          <span className="max-w-[120px] truncate">{user.username}</span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {user.role}
          </Badge>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">{user.username}</span>
            <span className="text-xs text-muted-foreground capitalize">
              {user.role}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/account" className="cursor-pointer">
            <KeyRound className="mr-2 h-4 w-4" />
            Account & API keys
          </Link>
        </DropdownMenuItem>
        {admin ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/admin/users" className="cursor-pointer">
                <Shield className="mr-2 h-4 w-4" />
                Manage users
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/admin/api-keys" className="cursor-pointer">
                <KeyRound className="mr-2 h-4 w-4" />
                Manage API keys
              </Link>
            </DropdownMenuItem>
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive cursor-pointer"
          onSelect={(e) => {
            e.preventDefault();
            signOut();
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
