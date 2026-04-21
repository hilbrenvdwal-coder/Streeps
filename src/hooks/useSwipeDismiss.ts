import { useMemo, useRef } from 'react';
import { Animated, Dimensions, Easing, PanResponder } from 'react-native';

const SCREEN_W = Dimensions.get('window').width;

/**
 * Swipe-to-dismiss hook for full-screen overlays.
 * - Detects horizontal swipe from the left edge.
 * - Returns `swipeX` (for translateX), `scrimOpacity` (for scrim fade),
 *   and `panHandlers` to attach to the overlay root.
 *
 * If `overlayAnim` is provided, the scrim opacity multiplies with it so
 * that opening/closing transitions compose correctly with swipe-progress.
 */
export function useSwipeDismiss(onDismiss: () => void, overlayAnim?: Animated.Value) {
  const swipeX = useRef(new Animated.Value(0)).current;
  const scrimOpacity = useMemo(() => {
    if (!overlayAnim) return swipeX.interpolate({ inputRange: [0, SCREEN_W * 0.3, SCREEN_W], outputRange: [1, 1, 0], extrapolate: 'clamp' });
    return Animated.multiply(
      overlayAnim,
      swipeX.interpolate({ inputRange: [0, SCREEN_W * 0.3, SCREEN_W], outputRange: [1, 1, 0], extrapolate: 'clamp' })
    );
  }, [overlayAnim, swipeX]);
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => gs.dx > 10 && gs.moveX < 80 && Math.abs(gs.dy) < 25,
      onPanResponderMove: (_, gs) => { if (gs.dx > 0) swipeX.setValue(gs.dx); },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx > 80 || gs.vx > 0.5) {
          const remaining = SCREEN_W - gs.dx;
          const velocity = Math.max(gs.vx, 0.5);
          const duration = Math.min(remaining / velocity, 300);
          const anims: Animated.CompositeAnimation[] = [
            Animated.timing(swipeX, { toValue: SCREEN_W, duration, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          ];
          if (overlayAnim) {
            anims.push(Animated.timing(overlayAnim, { toValue: 0, duration, easing: Easing.out(Easing.ease), useNativeDriver: true }));
          }
          Animated.parallel(anims).start(() => {
            swipeX.setValue(0);
            onDismiss();
          });
        } else {
          Animated.spring(swipeX, { toValue: 0, damping: 20, stiffness: 300, useNativeDriver: true }).start();
        }
      },
    })
  ).current;
  return { swipeX, scrimOpacity, panHandlers: pan.panHandlers };
}

export default useSwipeDismiss;
