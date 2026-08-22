import { clamp01, hexToHsv, hsvToHex, hueToHex } from '@budgetaiapp/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, PanResponder, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

/** Rich wallet-card tones — hue comes from the slider, saturation/value stay fixed. */
const CARD_SATURATION = 0.72;
const CARD_VALUE = 0.9;

const HUE_HEIGHT = 32;
const HUE_THUMB_SIZE = 24;

type HueColorPickerProps = {
  color: string;
  onChange: (hex: string) => void;
};

function thumbPosition(ratio: number, track: number, thumb: number) {
  const center = clamp01(ratio) * track;

  return Math.min(track - thumb, Math.max(0, center - thumb / 2));
}

export function cardColorFromHue(h: number): string {
  return hsvToHex(h, CARD_SATURATION, CARD_VALUE);
}

export default function HueColorPicker({ color, onChange }: HueColorPickerProps) {
  const [hue, setHue] = useState(() => hexToHsv(color).h);
  const [trackWidth, setTrackWidth] = useState(0);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    if (isDraggingRef.current) {
      return;
    }

    setHue(hexToHsv(color).h);
  }, [color]);

  const applyHue = useCallback(
    (nextHue: number) => {
      const normalized = ((nextHue % 360) + 360) % 360;

      setHue(normalized);
      onChange(cardColorFromHue(normalized));
    },
    [onChange],
  );

  const updateFromPoint = useCallback(
    (x: number) => {
      if (trackWidth <= 0) {
        return;
      }

      applyHue(clamp01(x / trackWidth) * 360);
    },
    [applyHue, trackWidth],
  );

  const huePan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          isDraggingRef.current = true;
          updateFromPoint(event.nativeEvent.locationX);
        },
        onPanResponderMove: (event) => {
          updateFromPoint(event.nativeEvent.locationX);
        },
        onPanResponderRelease: () => {
          isDraggingRef.current = false;
        },
        onPanResponderTerminate: () => {
          isDraggingRef.current = false;
        },
      }),
    [updateFromPoint],
  );

  function handleLayout(event: LayoutChangeEvent) {
    setTrackWidth(event.nativeEvent.layout.width);
  }

  const hueThumbLeft = thumbPosition(hue / 360, trackWidth, HUE_THUMB_SIZE);

  return (
    <View style={styles.hueWrap} onLayout={handleLayout}>
      {trackWidth > 0 ? (
        <Svg width={trackWidth} height={HUE_HEIGHT}>
          <Defs>
            <LinearGradient id="hueStrip" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor="#FF0000" />
              <Stop offset="16.666%" stopColor="#FFFF00" />
              <Stop offset="33.333%" stopColor="#00FF00" />
              <Stop offset="50%" stopColor="#00FFFF" />
              <Stop offset="66.666%" stopColor="#0000FF" />
              <Stop offset="83.333%" stopColor="#FF00FF" />
              <Stop offset="100%" stopColor="#FF0000" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" rx={HUE_HEIGHT / 2} fill="url(#hueStrip)" />
        </Svg>
      ) : null}

      <View style={StyleSheet.absoluteFill} {...huePan.panHandlers} />

      {trackWidth > 0 ? (
        <View
          pointerEvents="none"
          style={[
            styles.hueThumb,
            {
              left: hueThumbLeft,
              borderColor: hueToHex(hue),
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hueWrap: {
    height: HUE_HEIGHT,
    borderRadius: HUE_HEIGHT / 2,
    overflow: 'hidden',
  },
  hueThumb: {
    position: 'absolute',
    top: (HUE_HEIGHT - HUE_THUMB_SIZE) / 2,
    width: HUE_THUMB_SIZE,
    height: HUE_THUMB_SIZE,
    borderRadius: HUE_THUMB_SIZE / 2,
    borderWidth: 3,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 3,
    elevation: 3,
  },
});
