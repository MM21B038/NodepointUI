import {
  Bot, Brain, Cpu, Cloud, Code, Database, Server, Settings, Sparkles, Terminal, Wifi, Zap, MessageCircle, Network, GitGraph,
  User, Users, UserRound, UserPlus, UserMinus, UserCheck, UserX, Smile, Frown, Meh, PersonStanding,
  Building, Briefcase, Banknote, DollarSign, Euro, Factory, Gem, Handshake, Megaphone, PieChart, Presentation, Scale, Store, Trophy, Wallet,
  ScrollText, Lightbulb, Star, Sun, Moon, CloudRain, CloudSnow, CloudLightning, CloudFog, CloudSun, CloudMoon,
  Heart,
  Folder, File, FileText, FileCode, FileJson, FileWarning, FileX, FileCheck, FileQuestion, FileSearch, FileArchive, FileAudio, FileImage, FileVideo,
  Calendar, Clock,
  MapPin, Globe, Compass,
  Home,
  Loader2, RefreshCw, Plus, ChevronDown, FolderCog, FileStack, ArrowDown, Info, Play, Upload, Trash2, FileType, X, Tag, Send,
} from "lucide-react";
import React from "react";

// Map of icon names to their components
export const iconComponents: Record<string, React.FC<React.SVGProps<SVGSVGElement>>> = {
  Bot, Brain, Cpu, Cloud, Code, Database, Server, Settings, Sparkles, Terminal, Wifi, Zap, MessageCircle, Network, GitGraph,
  User, Users, UserRound, UserPlus, UserMinus, UserCheck, UserX, Smile, Frown, Meh, PersonStanding,
  Building, Briefcase, Banknote, DollarSign, Euro, Factory, Gem, Handshake, Megaphone, PieChart, Presentation, Scale, Store, Trophy, Wallet,
  ScrollText, Lightbulb, Star, Sun, Moon, CloudRain, CloudSnow, CloudLightning, CloudFog, CloudSun, CloudMoon,
  Heart,
  Folder, File, FileText, FileCode, FileJson, FileWarning, FileX, FileCheck, FileQuestion, FileSearch, FileArchive, FileAudio, FileImage, FileVideo,
  Calendar, Clock,
  MapPin, Globe, Compass,
  Home,
  Loader2, RefreshCw, Plus, ChevronDown, FolderCog, FileStack, ArrowDown, Info, Play, Upload, Trash2, FileType, X, Tag, Send,
};

// Categorized list of icon names
export const categorizedIcons = {
  "Animals": [
    // Removed all animal icons to resolve import errors.
  ],
  "AI & Tech": [
    "Bot", "Brain", "Cpu", "Cloud", "Code", "Database", "Server", "Settings", "Sparkles", "Terminal", "Wifi", "Zap", "MessageCircle", "Network", "GitGraph", "Lightbulb"
  ],
  "People & Avatars": [
    "User", "Users", "UserRound", "UserPlus", "UserMinus", "UserCheck", "UserX", "Smile", "Frown", "Meh", "PersonStanding"
  ],
  "Business & Org": [
    "Building", "Briefcase", "Banknote", "DollarSign", "Euro", "Factory", "Gem", "Handshake", "Megaphone", "PieChart", "Presentation", "Scale", "Store", "Trophy", "Wallet"
  ],
  "Objects & Tools": [
    "Star", "Loader2", "RefreshCw", "Plus", "Settings", "ChevronDown", "FolderCog", "FileStack", "ArrowDown", "Info", "Play", "Upload", "Trash2", "FileType", "X", "Tag", "Send"
  ],
  "Nature & Places": [
    "MapPin", "Globe", "Compass", "Sun", "Moon", "CloudRain", "CloudSnow", "CloudLightning", "CloudFog", "CloudSun", "CloudMoon", "Home"
  ],
  "Travel & Transport": [
    // Removed problematic transport icons to resolve import errors.
    // If you need specific transport icons, please verify their exact names in lucide-react documentation.
  ],
  "Education & Books": [
    "ScrollText"
  ],
  "Emotions & Health": [
    "Heart"
  ],
  "Files & Folders": [
    "Folder", "File", "FileText", "FileCode", "FileJson", "FileWarning", "FileX", "FileCheck", "FileQuestion", "FileSearch", "FileArchive", "FileAudio", "FileImage", "FileVideo"
  ],
  "Time & Date": [
    "Calendar", "Clock"
  ]
};