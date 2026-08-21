/**
 * SocialVault — point d'entrée du design system.
 *
 *   import { Button, Card, AccountCard } from '@/design-system';
 *
 * Les feuilles de style (tokens.css puis socialvault.css) sont importées
 * une seule fois dans le layout, et le contenu doit être englobé par un
 * élément portant la classe `sv-root`.
 */

export { default as Icon, ICON_PATHS } from '@/design-system/components/Icon';
export type { IconName, IconProps } from '@/design-system/components/Icon';

export { default as Button } from '@/design-system/components/Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from '@/design-system/components/Button';

export { Card, CardHeader, CardBody, CardFooter } from '@/design-system/components/Card';
export type { CardProps } from '@/design-system/components/Card';

export { Input, Textarea, Checkbox } from '@/design-system/components/Input';
export type { InputProps, TextareaProps, CheckboxProps } from '@/design-system/components/Input';

export { default as Select } from '@/design-system/components/Select';
export type { SelectProps, SelectOption } from '@/design-system/components/Select';

export { Badge, PlatformBadge } from '@/design-system/components/Badge';
export type { BadgeProps, BadgeTone } from '@/design-system/components/Badge';

export { Avatar, AvatarGroup } from '@/design-system/components/Avatar';
export type { AvatarProps, AvatarSize } from '@/design-system/components/Avatar';

export { default as AccountCard } from '@/design-system/components/AccountCard';
export type { SocialAccount } from '@/design-system/components/AccountCard';

export { default as MarketplaceCard } from '@/design-system/components/MarketplaceCard';
export type { MarketplaceListing } from '@/design-system/components/MarketplaceCard';

export { default as Filters } from '@/design-system/components/Filters';
export type { FiltersProps, FiltersValue } from '@/design-system/components/Filters';

export { default as Tabs } from '@/design-system/components/Tabs';
export type { TabsProps, TabItem } from '@/design-system/components/Tabs';

export { default as Table } from '@/design-system/components/Table';
export type { TableProps, Column } from '@/design-system/components/Table';

export { default as Modal } from '@/design-system/components/Modal';
export type { ModalProps } from '@/design-system/components/Modal';

export { default as Dropdown } from '@/design-system/components/Dropdown';
export type { DropdownProps, DropdownItem } from '@/design-system/components/Dropdown';

export { default as Pagination } from '@/design-system/components/Pagination';
export type { PaginationProps } from '@/design-system/components/Pagination';

export { default as Alert } from '@/design-system/components/Alert';
export type { AlertTone } from '@/design-system/components/Alert';

export { ToastProvider, useToast } from '@/design-system/components/Toast';
export type { Toast, ToastTone } from '@/design-system/components/Toast';

export { default as Navbar } from '@/design-system/components/Navbar';
export type { NavbarProps, NavLink } from '@/design-system/components/Navbar';

export { default as Hero } from '@/design-system/components/Hero';
export type { HeroProps } from '@/design-system/components/Hero';

export { default as Footer } from '@/design-system/components/Footer';
export type { FooterProps, FooterColumn } from '@/design-system/components/Footer';

export { StatCard, Progress, Sparkline, ActivityFeed } from '@/design-system/components/Dashboard';
export type { StatCardProps, ActivityItem } from '@/design-system/components/Dashboard';

export { SV_PLATFORMS, platformColor, platformLabel, platformStyle } from '@/design-system/platforms';
export type { SvPlatform } from '@/design-system/platforms';
