import { registerRootComponent } from "expo";
import { ExpoRoot } from "expo-router";

// Work around Expo Router app-root resolution failures during export/update in this monorepo.
export function App() {
  const ctx = require.context("./app");
  return <ExpoRoot context={ctx} />;
}

registerRootComponent(App);
