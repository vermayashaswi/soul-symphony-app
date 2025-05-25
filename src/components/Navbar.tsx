import { useState } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "@/hooks/use-theme";
import { useTranslation } from "@/contexts/TranslationContext";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MoonIcon, SunIcon, UserIcon } from "@radix-ui/react-icons";
import {
  ArrowRightOnRectangleIcon,
  Cog6ToothIcon,
  QuestionMarkCircleIcon,
} from "@heroicons/react/24/outline";
import { SouloLogo } from "./SouloLogo";
import { SubscriptionStatus } from '@/components/subscription/SubscriptionStatus';

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const { currentLanguage, changeLanguage } = useTranslation();
  const { signOut, user } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between items-center">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <SouloLogo className="h-8 w-8" />
              <span className="font-bold text-xl">Soulo</span>
            </Link>
          </div>

          <div className="hidden md:flex items-center space-x-8">
            <Link to="/journal" className="text-sm font-medium hover:underline">
              Journal
            </Link>
            <Link to="/insights" className="text-sm font-medium hover:underline">
              Insights
            </Link>
            <Link to="/chat" className="text-sm font-medium hover:underline">
              Chat
            </Link>
            <Link to="/settings" className="text-sm font-medium hover:underline">
              Settings
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            <SubscriptionStatus />
            
            <Select
              value={currentLanguage}
              onValueChange={(value) => changeLanguage(value)}
            >
              <SelectTrigger className="w-[120px] text-sm">
                <SelectValue placeholder="Theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="fr">Français</SelectItem>
                <SelectItem value="de">Deutsch</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="icon"
              onClick={() =>
                setTheme(theme === "light" ? "dark" : "light")
              }
            >
              <SunIcon className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <MoonIcon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>

            <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.user_metadata?.avatar_url} />
                    <AvatarFallback>
                      <UserIcon className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuItem disabled>
                  <div className="flex flex-col space-y-1 leading-none">
                    <span>{user?.email}</span>
                    <span className="line-clamp-1 text-sm text-muted-foreground">
                      {user?.user_metadata?.full_name}
                    </span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Cog6ToothIcon className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                  <Link to="/settings" />
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <QuestionMarkCircleIcon className="mr-2 h-4 w-4" />
                  <span>Support</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <ArrowRightOnRectangleIcon className="mr-2 h-4 w-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </nav>
  );
}
