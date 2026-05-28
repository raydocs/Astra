import { useState } from "react"
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera"
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"

import { colors, radii, spacing } from "../theme"

interface SignInScreenProps {
  busy: boolean
  message: string
  onContinueWithApple: () => void
  onContinueWithGoogle: () => void
  onLinkWithCode: (code: string) => void
  onRequestEmailCode: (email: string) => void
  onRedeemEmailCode: (email: string, code: string) => void
  onSignIn: (email: string, password: string) => void
  onTrySample: () => void
}

export function SignInScreen({ busy, message, onContinueWithApple, onContinueWithGoogle, onLinkWithCode, onRequestEmailCode, onRedeemEmailCode, onSignIn, onTrySample }: SignInScreenProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [emailCode, setEmailCode] = useState("")
  const [desktopCode, setDesktopCode] = useState("")
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scanLocked, setScanLocked] = useState(false)
  const [scannerMessage, setScannerMessage] = useState("")
  const [cameraPermission, requestCameraPermission] = useCameraPermissions()

  async function handleOpenScanner() {
    setScannerMessage("")
    const permission = cameraPermission?.granted ? cameraPermission : await requestCameraPermission()
    if (!permission.granted) {
      setScannerMessage("Camera permission is needed to scan a desktop QR code.")
      return
    }
    setScanLocked(false)
    setScannerOpen(true)
  }

  function handleBarcodeScanned(result: BarcodeScanningResult) {
    if (scanLocked || busy) return
    setScanLocked(true)
    setScannerOpen(false)
    setDesktopCode(result.data)
    onLinkWithCode(result.data)
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Astra Mobile Review Companion</Text>
        <Text style={styles.title}>Review the words and sentences you saved on the web.</Text>
        <Text style={styles.copy}>Sign in with your Astra account, or try safe sample cards first.</Text>

        <TextInput
          accessibilityLabel="Email"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={colors.graphite}
          style={styles.input}
          value={email}
        />
        <TextInput
          accessibilityLabel="Password"
          autoCapitalize="none"
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={colors.graphite}
          secureTextEntry
          style={styles.input}
          value={password}
        />

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => onSignIn(email, password)}
          style={[styles.primaryButton, busy && styles.disabled]}
        >
          <Text style={styles.primaryButtonText}>{busy ? "Signing in…" : "Sign in"}</Text>
        </Pressable>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Quick sign-in</Text>
        <Text style={styles.copy}>Use a saved account on this device when available.</Text>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={onContinueWithApple}
          style={[styles.secondaryButton, busy && styles.disabled]}
        >
          <Text style={styles.secondaryButtonText}>{busy ? "Opening…" : "Continue with Apple"}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={onContinueWithGoogle}
          style={[styles.secondaryButton, busy && styles.disabled]}
        >
          <Text style={styles.secondaryButtonText}>{busy ? "Opening…" : "Continue with Google"}</Text>
        </Pressable>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Email code</Text>
        <Text style={styles.copy}>Request a short sign-in code, then enter it here.</Text>
        <TextInput
          accessibilityLabel="Email sign-in code"
          autoCapitalize="characters"
          autoCorrect={false}
          onChangeText={setEmailCode}
          placeholder="Email code"
          placeholderTextColor={colors.graphite}
          style={styles.input}
          value={emailCode}
        />
        <View style={styles.inlineActions}>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => onRequestEmailCode(email)}
            style={[styles.inlineButton, busy && styles.disabled]}
          >
            <Text style={styles.secondaryButtonText}>Get code</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => onRedeemEmailCode(email, emailCode)}
            style={[styles.inlineButton, busy && styles.disabled]}
          >
            <Text style={styles.secondaryButtonText}>Use code</Text>
          </Pressable>
        </View>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Link from desktop</Text>
        <Text style={styles.copy}>Enter a desktop code or link to bring your saved review cards to this phone.</Text>
        <TextInput
          accessibilityLabel="Desktop code or link"
          autoCapitalize="characters"
          autoCorrect={false}
          onChangeText={setDesktopCode}
          placeholder="Desktop code or link"
          placeholderTextColor={colors.graphite}
          style={styles.input}
          value={desktopCode}
        />
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => onLinkWithCode(desktopCode)}
          style={[styles.secondaryButton, busy && styles.disabled]}
        >
          <Text style={styles.secondaryButtonText}>{busy ? "Linking…" : "Link this phone"}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => { void handleOpenScanner() }}
          style={[styles.secondaryButton, busy && styles.disabled]}
        >
          <Text style={styles.secondaryButtonText}>Scan desktop QR</Text>
        </Pressable>

        {scannerOpen ? (
          <View style={styles.scannerCard}>
            <CameraView
              active={!busy && scannerOpen}
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              facing="back"
              onBarcodeScanned={handleBarcodeScanned}
              style={styles.scanner}
            />
            <Text style={styles.scannerHint}>Point your camera at the Astra phone link on desktop.</Text>
            <Pressable accessibilityRole="button" onPress={() => setScannerOpen(false)} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Close scanner</Text>
            </Pressable>
          </View>
        ) : null}

        {scannerMessage ? <Text style={styles.message}>{scannerMessage}</Text> : null}

        <Pressable accessibilityRole="button" onPress={onTrySample} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Try sample cards</Text>
        </Pressable>

        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { flexGrow: 1, justifyContent: "center", padding: spacing.lg },
  card: { backgroundColor: colors.paperElevated, borderColor: colors.border, borderRadius: radii.card, borderWidth: 1, gap: spacing.md, padding: spacing.lg },
  eyebrow: { color: colors.sealRed, fontSize: 12, fontWeight: "800", letterSpacing: 1.1, textTransform: "uppercase" },
  title: { color: colors.ink, fontSize: 34, fontWeight: "500", lineHeight: 38 },
  copy: { color: colors.graphite, fontSize: 16, lineHeight: 24 },
  divider: { backgroundColor: colors.border, height: 1, marginVertical: spacing.xs },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: "800" },
  input: { backgroundColor: colors.paper, borderColor: colors.border, borderRadius: 18, borderWidth: 1, color: colors.ink, minHeight: 48, paddingHorizontal: spacing.md },
  primaryButton: { alignItems: "center", backgroundColor: colors.sealRed, borderRadius: radii.pill, minHeight: 50, justifyContent: "center" },
  primaryButtonText: { color: colors.paperElevated, fontSize: 16, fontWeight: "800" },
  secondaryButton: { alignItems: "center", borderColor: colors.border, borderRadius: radii.pill, borderWidth: 1, minHeight: 50, justifyContent: "center" },
  secondaryButtonText: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  inlineActions: { flexDirection: "row", gap: spacing.sm },
  inlineButton: { alignItems: "center", borderColor: colors.border, borderRadius: radii.pill, borderWidth: 1, flex: 1, minHeight: 50, justifyContent: "center" },
  scanner: { borderRadius: 18, height: 260, overflow: "hidden" },
  scannerCard: { backgroundColor: colors.paper, borderColor: colors.border, borderRadius: 22, borderWidth: 1, gap: spacing.sm, padding: spacing.sm },
  scannerHint: { color: colors.graphite, fontSize: 13, lineHeight: 18, textAlign: "center" },
  disabled: { opacity: 0.5 },
  message: { color: colors.graphite, fontSize: 14, lineHeight: 20 },
})
