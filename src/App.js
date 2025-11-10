import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert, Image, SafeAreaView, Platform, Animated } from 'react-native';
import MapScreen from './screens/MapScreen';

// --- Componente de Tela de Splash ---
const SplashScreen = ({ onAnimationFinish }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 0, duration: 1000, delay: 500, useNativeDriver: true }),
    ]).start(() => {
      if (onAnimationFinish) {
        onAnimationFinish();
      }
    });
  }, [fadeAnim, onAnimationFinish]);

  return (
    <View style={styles.splashContainer}>
      <Animated.Image
        source={require('./assets/logo.png')}
        style={[styles.splashLogo, { opacity: fadeAnim }]}
        resizeMode="contain"
      />
    </View>
  );
};

// --- Componente de Cabeçalho (Estilo Padrão) ---
const AppHeader = () => (
  <SafeAreaView style={styles.headerContainer}>
    <View style={styles.header}>
      <Image source={require('./assets/logo.png')} style={styles.headerLogo} resizeMode="contain" />
    </View>
  </SafeAreaView>
);

export default function App() {
  const [isAppReady, setIsAppReady] = useState(false);

  if (!isAppReady) {
    return <SplashScreen onAnimationFinish={() => setIsAppReady(true)} />;
  }

  return (
    <View style={styles.container}>
      <AppHeader />
      <MapScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  splashContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' },
  splashLogo: { width: '80%', height: '80%' },
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  headerContainer: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 4 },
  header: { height: 60, justifyContent: 'center', alignItems: 'center', paddingTop: Platform.OS === 'android' ? 10 : 0 },
  headerLogo: { height: '70%', width: '40%' },
});