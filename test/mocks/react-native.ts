export const Alert = { alert: () => undefined }
export const Linking = { openURL: () => Promise.resolve() }
export const Platform = { OS: "ios" }
export const Pressable = "Pressable"
export const SafeAreaView = "SafeAreaView"
export const ScrollView = "ScrollView"
export const Share = { share: () => Promise.resolve({ action: "sharedAction" }) }
export const StatusBar = "StatusBar"
export const StyleSheet = { create: <T,>(styles: T) => styles }
export const Text = "Text"
export const TextInput = "TextInput"
export const View = "View"
