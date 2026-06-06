import { cn } from '@/lib/utils';
import * as React from 'react';
import { Pressable, View } from 'react-native';

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  nativeID?: string;
  className?: string;
}

export function Switch({
  checked,
  onCheckedChange,
  disabled = false,
  nativeID,
  className,
}: SwitchProps) {
  return (
    <Pressable
      nativeID={nativeID}
      disabled={disabled}
      onPress={() => onCheckedChange(!checked)}
      className={cn(
        'h-8 w-14 rounded-full transition-colors',
        checked ? 'bg-primary' : 'bg-input',
        disabled && 'opacity-50',
        className
      )}
    >
      <View
        className={cn(
          'h-7 w-7 rounded-full bg-background shadow-sm transition-transform',
          checked ? 'translate-x-6' : 'translate-x-0.5',
          'my-0.5'
        )}
      />
    </Pressable>
  );
}
