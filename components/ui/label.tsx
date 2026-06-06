import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import * as React from 'react';
import { Pressable } from 'react-native';

interface LabelProps {
  nativeID: string;
  htmlFor?: string;
  onPress?: () => void;
  children: React.ReactNode;
  className?: string;
}

export function Label({
  nativeID,
  onPress,
  children,
  className,
}: LabelProps) {
  return (
    <Pressable onPress={onPress}>
      <Text
        nativeID={nativeID}
        className={cn('text-sm font-medium text-foreground', className)}
      >
        {children}
      </Text>
    </Pressable>
  );
}
