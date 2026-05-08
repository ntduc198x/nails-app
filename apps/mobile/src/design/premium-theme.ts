export type PremiumThemeMode = "light" | "dark";

function createShadow(color: string, opacityCard: number, opacityFloating: number) {
  return {
    card: {
      shadowColor: color,
      shadowOpacity: opacityCard,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 3,
    },
    floating: {
      shadowColor: color,
      shadowOpacity: opacityFloating,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },
  };
}

export function createPremiumTheme(mode: PremiumThemeMode = "light") {
  if (mode === "dark") {
    return {
      colors: {
        background: "#120f0c",
        surface: "#1b1713",
        surfaceMuted: "#221c16",
        surfaceRaised: "#262018",
        border: "#3c3024",
        borderStrong: "#594534",
        text: "#f7efe6",
        textSoft: "#d8c7b5",
        textMuted: "#b49984",
        accent: "#f1d0ae",
        accentSoft: "#3a2a1d",
        accentWarm: "#f0b37a",
        successBg: "#16251a",
        successText: "#7ad79a",
        warningBg: "#2b2216",
        warningText: "#f2bc74",
        dangerBg: "#2d1815",
        dangerText: "#f29a8f",
      },
      radius: {
        sm: 12,
        md: 18,
        lg: 24,
        xl: 30,
        pill: 999,
      },
      spacing: {
        xs: 6,
        sm: 10,
        md: 14,
        lg: 18,
        xl: 24,
        xxl: 30,
      },
      shadow: createShadow("#000000", 0.24, 0.32),
    } as const;
  }

  return {
  colors: {
    background: "#fff8f1",
    surface: "#ffffff",
    surfaceMuted: "#fff1e1",
    surfaceRaised: "#fff9f3",
    border: "#ead8c5",
    borderStrong: "#d7bfa8",
    text: "#2d241d",
    textSoft: "#786453",
    textMuted: "#a38974",
    accent: "#3a2d23",
    accentSoft: "#f6e4d2",
    accentWarm: "#cf8649",
    successBg: "#ebfaef",
    successText: "#2f9d61",
    warningBg: "#fff3df",
    warningText: "#c87a23",
    dangerBg: "#fff0ec",
    dangerText: "#d45f57",
  },
  radius: {
    sm: 12,
    md: 18,
    lg: 24,
    xl: 30,
    pill: 999,
  },
  spacing: {
    xs: 6,
    sm: 10,
    md: 14,
    lg: 18,
    xl: 24,
    xxl: 30,
  },
  shadow: {
    ...createShadow("#2a1e14", 0.06, 0.12),
  },
  } as const;
}

export const premiumTheme = createPremiumTheme();
