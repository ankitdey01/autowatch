import { Switch } from '@/components/ui/switch';
import { Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as React from 'react';
import {
  Alert,
  Animated,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type SpeechRecognitionEventName = 'result' | 'start' | 'end' | 'error';

type SpeechRecognitionEventHandler = (event?: any) => void;

type SpeechRecognitionApi = {
  ExpoSpeechRecognitionModule?: {
    abort: () => void;
    requestPermissionsAsync: () => Promise<{ granted: boolean }>;
    start: (options: Record<string, unknown>) => Promise<void>;
  };
  useSpeechRecognitionEvent: (
    eventName: SpeechRecognitionEventName,
    handler: SpeechRecognitionEventHandler
  ) => void;
};

const speechRecognition = (() => {
  try {
    return require('expo-speech-recognition') as SpeechRecognitionApi;
  } catch (error) {
    console.warn('Speech recognition native module is unavailable:', error);
    return null;
  }
})();

const ExpoSpeechRecognitionModule = speechRecognition?.ExpoSpeechRecognitionModule;
const useSpeechRecognitionEvent =
  speechRecognition?.useSpeechRecognitionEvent ??
  ((_eventName: SpeechRecognitionEventName, _handler: SpeechRecognitionEventHandler) => {});

const SCREEN_OPTIONS = {
  title: 'Autowatch',
  headerTransparent: false,
  headerStyle: {
    backgroundColor: '#000000',
  },
  headerShadowVisible: false,
  headerTintColor: '#ffffff',
};

const LISTENING_RESTART_DELAY_MS = 150;
const LISTENING_ERROR_RESTART_DELAY_MS = 1200;
const COMMAND_DEDUPE_WINDOW_MS = 1000;

export default function Screen() {
  const [time, setTime] = React.useState(0);
  const [isRunning, setIsRunning] = React.useState(false);
  const [autoMode, setAutoMode] = React.useState(false);
  const [isListening, setIsListening] = React.useState(false);
  const intervalRef = React.useRef<number | null>(null);
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  const dotAnim = React.useRef(new Animated.Value(0)).current;
  const autoModeRef = React.useRef(autoMode);
  const isListeningRef = React.useRef(isListening);
  const isRunningRef = React.useRef(isRunning);
  const isStartingRef = React.useRef(false);
  const restartTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCommandRef = React.useRef<{ command: 'start' | 'stop'; timestamp: number } | null>(
    null
  );

  React.useEffect(() => {
    autoModeRef.current = autoMode;
  }, [autoMode]);

  React.useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  React.useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  const clearRestartTimeout = React.useCallback(() => {
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
  }, []);

  const scheduleListeningRestart = React.useCallback(
    (delay = 500) => {
      if (!autoModeRef.current) {
        return;
      }

      clearRestartTimeout();
      restartTimeoutRef.current = setTimeout(() => {
        startListening();
      }, delay);
    },
    [clearRestartTimeout]
  );

  const startListening = React.useCallback(async () => {
    if (isListeningRef.current || isStartingRef.current) {
      return;
    }

    if (!ExpoSpeechRecognitionModule) {
      Alert.alert(
        'Development Build Required',
        'Voice commands need a native Android build that includes expo-speech-recognition. Rebuild and reinstall the app, then try Auto Mode again.',
        [{ text: 'OK' }]
      );
      setAutoMode(false);
      return;
    }

    isStartingRef.current = true;

    try {
      const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!result.granted) {
        Alert.alert(
          'Permission Required',
          'Microphone permission is required for voice commands.',
          [{ text: 'OK' }]
        );
        setAutoMode(false);
        return;
      }

      await ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        continuous: true,
        maxAlternatives: 1,
        contextualStrings: ['start', 'stop'],
        androidIntentOptions: {
          EXTRA_LANGUAGE_MODEL: 'web_search',
        },
      });
    } catch (error) {
      console.warn('Unable to start speech recognition:', error);
      setIsListening(false);
      scheduleListeningRestart(LISTENING_ERROR_RESTART_DELAY_MS);
    } finally {
      isStartingRef.current = false;
    }
  }, [scheduleListeningRestart]);

  const stopListening = React.useCallback(() => {
    clearRestartTimeout();
    isStartingRef.current = false;

    try {
      ExpoSpeechRecognitionModule?.abort();
    } catch (error) {
      console.warn('Unable to stop speech recognition:', error);
    }

    setIsListening(false);
  }, [clearRestartTimeout]);

  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript.toLowerCase() || '';
    const command = transcript.match(/\b(start|stop)\b/)?.[1] as
      | 'start'
      | 'stop'
      | undefined;

    if (!command) {
      return;
    }

    const now = Date.now();
    const lastCommand = lastCommandRef.current;
    if (
      lastCommand?.command === command &&
      now - lastCommand.timestamp < COMMAND_DEDUPE_WINDOW_MS
    ) {
      return;
    }

    lastCommandRef.current = {
      command,
      timestamp: now,
    };

    if (command === 'start') {
      if (!isRunningRef.current) {
        isRunningRef.current = true;
        setIsRunning(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } else if (command === 'stop') {
      if (isRunningRef.current) {
        isRunningRef.current = false;
        setIsRunning(false);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    }
  });

  useSpeechRecognitionEvent('start', () => {
    setIsListening(true);
  });

  useSpeechRecognitionEvent('end', () => {
    setIsListening(false);

    scheduleListeningRestart(LISTENING_RESTART_DELAY_MS);
  });

  useSpeechRecognitionEvent('error', (event) => {
    const shouldRestart =
      autoModeRef.current &&
      !['aborted', 'not-allowed', 'service-not-allowed'].includes(event.error);
    const restartDelay =
      event.error === 'client' || event.error === 'busy'
        ? LISTENING_ERROR_RESTART_DELAY_MS
        : LISTENING_RESTART_DELAY_MS;

    console.warn('Speech recognition error:', event.error, event.message);
    setIsListening(false);

    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      setAutoMode(false);
      return;
    }

    if (shouldRestart) {
      scheduleListeningRestart(restartDelay);
    }
  });

  React.useEffect(() => {
    if (autoMode) {
      startListening();
    } else {
      stopListening();
    }

    return () => {
      stopListening();
    };
  }, [autoMode, startListening, stopListening]);

  const handleAutoModeToggle = (checked: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAutoMode(checked);
  };

  const onAutoModeLabelPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAutoMode((prev) => !prev);
  };

  React.useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTime((prevTime) => prevTime + 10);
      }, 10);

      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.015,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(dotAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(dotAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      pulseAnim.stopAnimation();
      dotAnim.stopAnimation();
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
      Animated.timing(dotAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [dotAnim, isRunning, pulseAnim]);

  const formatTime = (milliseconds: number) => {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    const centiseconds = Math.floor((milliseconds % 1000) / 10);

    return {
      main: `${minutes.toString().padStart(2, '0')}:${seconds
        .toString()
        .padStart(2, '0')}`,
      sub: `.${centiseconds.toString().padStart(2, '0')}`,
    };
  };

  const handleStartStop = () => {
    setIsRunning((prev) => !prev);
  };

  const handleReset = () => {
    setIsRunning(false);
    setTime(0);
  };

  const { main, sub } = formatTime(time);
  const dotOpacity = dotAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.15, 1],
  });
  const statusLabel = isRunning ? 'RUNNING' : time > 0 ? 'PAUSED' : 'READY';

  return (
    <>
      <Stack.Screen options={SCREEN_OPTIONS} />
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />

        <View style={styles.header}>
          <Text style={styles.headerLabel}>STOPWATCH</Text>
          <Animated.View
            style={[styles.liveDot, { opacity: isRunning ? dotOpacity : 0.1 }]}
          />
        </View>

        <View style={styles.timerContainer}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <View style={styles.timeRow}>
              <Text style={styles.timeMain}>{main}</Text>
              <Text style={styles.timeSub}>{sub}</Text>
            </View>
          </Animated.View>
          <View style={styles.timeDivider} />
          <Text style={styles.timeUnit}>{statusLabel}</Text>
        </View>

        <View style={styles.autoSection}>
          <View style={styles.autoRow}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={onAutoModeLabelPress}
              style={styles.autoLeft}
            >
              <Text style={styles.autoLabel}>AUTO MODE</Text>
              <Text style={styles.autoSub}>Voice controlled</Text>
            </TouchableOpacity>
            <Switch
              checked={autoMode}
              onCheckedChange={handleAutoModeToggle}
              nativeID="auto-mode"
              className={autoMode ? 'bg-white' : 'bg-neutral-900'}
            />
          </View>

          {autoMode && (
            <View style={styles.voiceBadge}>
              <Animated.View
                style={[styles.voicePulse, { opacity: isListening ? dotOpacity : 0.25 }]}
              />
              <Text style={styles.voiceBadgeText}>
                {isListening ? 'Listening for "start" / "stop"' : 'Voice standby'}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[
              styles.btnSecondary,
              time === 0 && !isRunning && styles.btnDisabled,
            ]}
            onPress={handleReset}
            disabled={time === 0 && !isRunning}
            activeOpacity={0.6}
          >
            <Text
              style={[
                styles.btnSecondaryText,
                time === 0 && !isRunning && styles.btnDisabledText,
              ]}
            >
              RESET
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btnPrimary, isRunning && styles.btnStop]}
            onPress={handleStartStop}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.btnPrimaryText,
                isRunning && styles.btnStopText,
              ]}
            >
              {isRunning ? 'STOP' : 'START'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomRule} />
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'space-between',
    paddingBottom: 40,
    paddingHorizontal: 28,
    paddingTop: 20,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  headerLabel: {
    color: '#333333',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 4,
  },
  liveDot: {
    backgroundColor: '#ffffff',
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  timerContainer: {
    alignItems: 'flex-start',
    paddingVertical: 20,
  },
  timeRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
  },
  timeMain: {
    color: '#ffffff',
    fontSize: 76,
    fontWeight: '100',
    letterSpacing: 0,
    lineHeight: 84,
  },
  timeSub: {
    color: '#444444',
    fontSize: 36,
    fontWeight: '200',
    letterSpacing: 0,
    lineHeight: 44,
    marginBottom: 8,
    marginLeft: 2,
  },
  timeDivider: {
    backgroundColor: '#222222',
    height: 1,
    marginBottom: 12,
    marginTop: 16,
    width: 32,
  },
  timeUnit: {
    color: '#333333',
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 4,
  },
  autoSection: {
    gap: 12,
  },
  autoRow: {
    alignItems: 'center',
    borderBottomColor: '#111111',
    borderBottomWidth: 1,
    borderTopColor: '#111111',
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 18,
  },
  autoLeft: {
    gap: 3,
  },
  autoLabel: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 3,
  },
  autoSub: {
    color: '#333333',
    fontSize: 11,
    letterSpacing: 1,
  },
  voiceBadge: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  voicePulse: {
    backgroundColor: '#ffffff',
    borderRadius: 2.5,
    height: 5,
    width: 5,
  },
  voiceBadgeText: {
    color: '#333333',
    fontSize: 11,
    letterSpacing: 1.5,
  },
  buttonRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  btnPrimary: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    flex: 1,
    height: 56,
    justifyContent: 'center',
  },
  btnStop: {
    backgroundColor: '#111111',
    borderColor: '#ffffff',
    borderWidth: 1,
  },
  btnPrimaryText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 4,
  },
  btnStopText: {
    color: '#ffffff',
  },
  btnSecondary: {
    alignItems: 'center',
    borderColor: '#222222',
    borderWidth: 1,
    height: 56,
    justifyContent: 'center',
    width: 88,
  },
  btnDisabled: {
    borderColor: '#111111',
  },
  btnSecondaryText: {
    color: '#555555',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 3,
  },
  btnDisabledText: {
    color: '#222222',
  },
  bottomRule: {
    backgroundColor: '#111111',
    height: 1,
  },
});
