"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { iconComponents, categorizedIcons } from "@/lib/icons";
import { toast } from "sonner";
import { Bot, User, ChevronLeft } from "lucide-react"; // Added ChevronLeft for back button

interface IconSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (botIconName: string, userIconName: string) => void;
  currentBotIconName: string;
  currentUserIconName: string;
}

const IconSelectionDialog: React.FC<IconSelectionDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  currentBotIconName,
  currentUserIconName,
}) => {
  const [selectedBotIcon, setSelectedBotIcon] = useState(currentBotIconName);
  const [selectedUserIcon, setSelectedUserIcon] = useState(currentUserIconName);
  const [selectedCategory, setSelectedCategory] = useState(Object.keys(categorizedIcons)[0]);
  const [viewMode, setViewMode] = useState<'main' | 'botPicker' | 'userPicker'>('main');

  useEffect(() => {
    if (isOpen) {
      setSelectedBotIcon(currentBotIconName);
      setSelectedUserIcon(currentUserIconName);
      setSelectedCategory(Object.keys(categorizedIcons)[0]); // Reset category on open
      setViewMode('main'); // Always start in main view
    }
  }, [isOpen, currentBotIconName, currentUserIconName]);

  const handleSave = () => {
    onSave(selectedBotIcon, selectedUserIcon);
    toast.success("Chat icons updated successfully!");
    onClose();
  };

  // Component for the icon picker view
  const IconPickerView = ({
    type,
    currentIcon,
    onSelectIcon,
    onBack,
  }: {
    type: "bot" | "user";
    currentIcon: string;
    onSelectIcon: (iconName: string) => void;
    onBack: () => void;
  }) => {
    const CurrentIconComponent = currentIcon && iconComponents[currentIcon] ? iconComponents[currentIcon] : (type === "bot" ? Bot : User);
    const defaultLabel = type === "bot" ? "Default (Bot)" : "Default (User)";

    return (
      <div className="flex flex-col flex-grow min-h-0 space-y-4">
        <div className="flex items-center gap-4 p-4 border rounded-md bg-muted/50">
          <Button variant="ghost" size="icon" onClick={onBack} title="Back to main selection">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center justify-center h-12 w-12 rounded-md bg-background border shadow-sm">
            <CurrentIconComponent className="h-6 w-6 text-primary" />
          </div>
          <span className="font-semibold text-lg">{currentIcon || defaultLabel}</span>
        </div>

        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a category" />
          </SelectTrigger>
          <SelectContent className="max-h-[200px]" collisionPadding={10} position="popper">
            {Object.keys(categorizedIcons).map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <ScrollArea className="flex-grow rounded-md border p-2 min-h-0">
          <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-7 lg:grid-cols-8 gap-2 p-2">
            {categorizedIcons[selectedCategory]?.map((iconName) => {
              const IconComponent = iconComponents[iconName];
              if (!IconComponent) return null;
              return (
                <Button
                  key={iconName}
                  variant="outline"
                  size="icon"
                  className={cn(
                    "h-10 w-10 flex items-center justify-center",
                    currentIcon === iconName && "ring-2 ring-primary ring-offset-2"
                  )}
                  onClick={() => onSelectIcon(iconName)}
                  title={iconName}
                >
                  <IconComponent className="h-5 w-5" />
                </Button>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[90vw] sm:max-w-[700px] max-h-[90vh] overflow-y-auto flex flex-col">
        <DialogHeader>
          <DialogTitle>Customize Chat Icons</DialogTitle>
          <DialogDescription>
            {viewMode === 'main'
              ? "Select unique icons for your bot and user in the chat interface."
              : `Select a new icon for the ${viewMode === 'botPicker' ? 'Bot' : 'User'}.`}
          </DialogDescription>
        </DialogHeader>

        {viewMode === 'main' ? (
          <div className="flex-grow flex flex-col md:flex-row gap-6 py-4">
            {/* Bot Icon Selection */}
            <div className="flex flex-col items-center gap-3 flex-1 p-4 border rounded-lg bg-secondary/50">
              <h3 className="text-lg font-semibold">Bot Icon</h3>
              <div className="flex items-center justify-center h-20 w-20 rounded-md bg-background border shadow-md">
                {selectedBotIcon && iconComponents[selectedBotIcon] ? (
                  React.createElement(iconComponents[selectedBotIcon], { className: "h-10 w-10 text-primary" })
                ) : (
                  <Bot className="h-10 w-10 text-muted-foreground" />
                )}
              </div>
              <span className="font-medium text-sm">{selectedBotIcon || "Default (Bot)"}</span>
              <Button variant="outline" onClick={() => setViewMode('botPicker')} className="mt-2">
                Change Bot Icon
              </Button>
            </div>

            {/* User Icon Selection */}
            <div className="flex flex-col items-center gap-3 flex-1 p-4 border rounded-lg bg-secondary/50">
              <h3 className="text-lg font-semibold">User Icon</h3>
              <div className="flex items-center justify-center h-20 w-20 rounded-md bg-background border shadow-md">
                {selectedUserIcon && iconComponents[selectedUserIcon] ? (
                  React.createElement(iconComponents[selectedUserIcon], { className: "h-10 w-10 text-primary" })
                ) : (
                  <User className="h-10 w-10 text-muted-foreground" />
                )}
              </div>
              <span className="font-medium text-sm">{selectedUserIcon || "Default (User)"}</span>
              <Button variant="outline" onClick={() => setViewMode('userPicker')} className="mt-2">
                Change User Icon
              </Button>
            </div>
          </div>
        ) : viewMode === 'botPicker' ? (
          <IconPickerView
            type="bot"
            currentIcon={selectedBotIcon}
            onSelectIcon={setSelectedBotIcon}
            onBack={() => setViewMode('main')}
          />
        ) : ( // userPicker
          <IconPickerView
            type="user"
            currentIcon={selectedUserIcon}
            onSelectIcon={setSelectedUserIcon}
            onBack={() => setViewMode('main')}
          />
        )}

        {viewMode === 'main' && ( // Only show save/cancel in main view
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Save Changes
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default IconSelectionDialog;